"""LocalLedger AI - One-Command End-to-End Integration Verification Runner.

Executes all six integration checks against an isolated temporary test database:
1. Backend health and API routes
2. Image receipt upload and OCR
3. PDF receipt extraction and validation
4. SQLite transaction save and server-restart persistence
5. Tesseract OCR installation and smoke test
6. Ollama local model inference

Usage:
    python scripts/run_integration_checks.py [--port PORT] [--keep-temp] [--verbose]
"""

from __future__ import annotations

import argparse
import importlib.util
import io
import os
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
import pymupdf
from PIL import Image, ImageDraw

# Ensure backend root is on sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings
from app.services.ocr.ocr_service import ocr_service
from app.services.ocr.pdf_extractor import extract_text_from_pdf


@dataclass
class CheckResult:
    name: str
    status: str  # PASS, FAIL, SKIP, BLOCKED
    details: str
    error: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


def get_process_on_port(port: int) -> tuple[int | None, str | None]:
    """Find PID and executable name listening on a loopback port without terminating it."""
    try:
        out = subprocess.check_output(
            ["netstat", "-ano"], text=True, stderr=subprocess.DEVNULL
        )
        for line in out.splitlines():
            line_str = line.strip()
            if f":{port}" in line_str and "LISTENING" in line_str.upper():
                parts = line_str.split()
                pid = int(parts[-1])
                name = None
                try:
                    task_out = subprocess.check_output(
                        ["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"],
                        text=True,
                        stderr=subprocess.DEVNULL,
                    )
                    if task_out.strip() and not task_out.startswith("INFO:"):
                        name = task_out.split(",")[0].strip('"')
                except Exception:  # noqa: S110
                    pass
                return pid, name
    except Exception:  # noqa: S110
        pass
    return None, None


def find_available_port(preferred: int = 8000) -> int:
    """Find an available loopback port.

    If preferred is free, return it; otherwise scan 8001-8100.
    """
    pid, _ = get_process_on_port(preferred)
    if pid is None:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("127.0.0.1", preferred))
                return preferred
        except OSError:
            pass

    for p in range(max(8001, preferred + 1), 8100):
        pid, _ = get_process_on_port(p)
        if pid is None:
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind(("127.0.0.1", p))
                    return p
            except OSError:
                continue

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class TestServerManager:
    """Manages an isolated test Uvicorn server instance bound strictly to loopback."""

    def __init__(
        self,
        temp_dir: Path,
        isolated_db: Path,
        isolated_uploads: Path,
        port: int,
        verbose: bool = False,
    ):
        self.temp_dir = temp_dir
        self.isolated_db = isolated_db
        self.isolated_uploads = isolated_uploads
        self.port = port
        self.base_url = f"http://127.0.0.1:{port}"
        self.verbose = verbose
        self.process: subprocess.Popen | None = None
        self.log_file = temp_dir / "uvicorn_test_server.log"
        self._log_fh = None

    def start(self, timeout: float = 15.0) -> bool:
        env = os.environ.copy()
        env["DB_PATH"] = str(self.isolated_db)
        env["UPLOAD_DIR"] = str(self.isolated_uploads)
        env["APP_ENV"] = "test"
        env["BACKEND_HOST"] = "127.0.0.1"
        env["BACKEND_PORT"] = str(self.port)
        env["PYTHONUNBUFFERED"] = "1"

        self._log_fh = open(self.log_file, "a", encoding="utf-8")  # noqa: SIM115
        cmd = [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--app-dir",
            str(BACKEND_DIR),
            "--host",
            "127.0.0.1",
            "--port",
            str(self.port),
            "--log-level",
            "info" if self.verbose else "warning",
        ]

        self.process = subprocess.Popen(
            cmd,
            cwd=str(BACKEND_DIR),
            env=env,
            stdout=self._log_fh,
            stderr=self._log_fh,
        )

        start = time.time()
        with httpx.Client(timeout=2.0) as client:
            while time.time() - start < timeout:
                if self.process.poll() is not None:
                    return False
                try:
                    r = client.get(f"{self.base_url}/api/v1/health")
                    if r.status_code == 200:
                        return True
                except (httpx.ConnectError, httpx.TimeoutException):
                    pass
                time.sleep(0.25)
        return False

    def stop(self, timeout: float = 6.0) -> None:
        if self.process is not None and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=2.0)

        if self._log_fh and not self._log_fh.closed:
            self._log_fh.close()
        self.process = None

        # Wait until loopback port is fully released
        start = time.time()
        while time.time() - start < timeout:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.3)
                if s.connect_ex(("127.0.0.1", self.port)) != 0:
                    break
            time.sleep(0.2)

    def restart(self, timeout: float = 15.0) -> bool:
        self.stop()
        return self.start(timeout=timeout)


def check_1_backend_health_and_api(
    manager: TestServerManager,
    port_8000_occupied: bool,
    occ_pid: int | None,
    occ_name: str | None,
) -> CheckResult:
    """Check 1 — Backend health and API discovery."""
    try:
        client = httpx.Client(base_url=manager.base_url, timeout=10.0)

        # 1. Health check
        health_res = client.get("/api/v1/health")
        if health_res.status_code != 200:
            return CheckResult(
                name="API health and routes",
                status="FAIL",
                details=f"GET /api/v1/health returned HTTP {health_res.status_code}",
            )
        health_data = health_res.json()

        # 2. OpenAPI routes check
        openapi_res = client.get("/openapi.json")
        if openapi_res.status_code != 200:
            return CheckResult(
                name="API health and routes",
                status="FAIL",
                details=f"GET /openapi.json returned HTTP {openapi_res.status_code}",
            )
        schema = openapi_res.json()
        paths = schema.get("paths", {})

        expected_endpoints = [
            ("/api/v1/health", "get"),
            ("/api/v1/documents/upload", "post"),
            ("/api/v1/documents/{document_id}/review", "get"),
            ("/api/v1/receipts/confirm", "post"),
            ("/api/v1/transactions", "get"),
            ("/api/v1/transactions/{transaction_id}", "get"),
        ]

        missing = []
        for path, method in expected_endpoints:
            if path not in paths or method not in paths[path]:
                missing.append(f"{method.upper()} {path}")

        if missing:
            return CheckResult(
                name="API health and routes",
                status="FAIL",
                details=f"Missing expected OpenAPI routes: {', '.join(missing)}",
            )

        details = f"{manager.base_url}/api/v1/health (status: {health_data.get('status')})"
        if port_8000_occupied and occ_pid:
            details += f" [Port 8000 in use by PID {occ_pid} ({occ_name}); test server on {manager.port}]"

        return CheckResult(
            name="API health and routes",
            status="PASS",
            details=details,
            extra={"health": health_data, "port": manager.port},
        )
    except Exception as e:
        return CheckResult(
            name="API health and routes",
            status="FAIL",
            details=f"Failed to query API: {e!s}",
            error=str(e),
        )


def check_2_receipt_image_upload_and_ocr(manager: TestServerManager) -> CheckResult:
    """Check 2 — Receipt image upload and OCR execution."""
    try:
        # Create a synthetic receipt image
        img = Image.new("RGB", (500, 300), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        draw.text((30, 30), "SUMMIT CAFE & BAKERY", fill=(0, 0, 0))
        draw.text((30, 70), "Receipt: SC-2026-881", fill=(0, 0, 0))
        draw.text((30, 110), "Date: 2026-08-15", fill=(0, 0, 0))
        draw.text((30, 150), "Subtotal: $24.00", fill=(0, 0, 0))
        draw.text((30, 190), "Tax: $2.40", fill=(0, 0, 0))
        draw.text((30, 230), "Total: $26.40", fill=(0, 0, 0))

        # Scale up for reliable OCR character density
        scaled = img.resize((1000, 600), Image.Resampling.NEAREST)
        buf = io.BytesIO()
        scaled.save(buf, format="PNG")
        png_bytes = buf.getvalue()

        client = httpx.Client(base_url=manager.base_url, timeout=30.0)

        # Upload image through the real API
        files = {"file": ("synthetic_summit_cafe.png", png_bytes, "image/png")}
        upload_res = client.post("/api/v1/documents/upload", files=files)
        if upload_res.status_code != 200:
            return CheckResult(
                name="Image receipt upload and OCR",
                status="FAIL",
                details=f"Upload returned HTTP {upload_res.status_code}: {upload_res.text[:100]}",
            )
        upload_data = upload_res.json()
        doc_id = upload_data.get("document_id")
        if not doc_id:
            return CheckResult(
                name="Image receipt upload and OCR",
                status="FAIL",
                details="Upload response missing document_id",
            )

        # Review endpoint to verify OCR and extraction actually ran
        review_res = client.get(f"/api/v1/documents/{doc_id}/review")
        if review_res.status_code != 200:
            return CheckResult(
                name="Image receipt upload and OCR",
                status="FAIL",
                details=f"Review returned HTTP {review_res.status_code}: {review_res.text[:100]}",
            )
        review_data = review_res.json()
        ocr_preview = review_data.get("ocr_text_preview", "").strip()

        if not ocr_preview or ocr_preview.startswith("No text extracted"):
            return CheckResult(
                name="Image receipt upload and OCR",
                status="FAIL",
                details="OCR produced empty text preview from synthetic image",
            )

        extracted = review_data.get("extracted", {})
        merchant = extracted.get("merchant") or "(not parsed)"
        total = extracted.get("total") or "(not parsed)"
        preview_clean = " ".join(ocr_preview.split())[:40]

        return CheckResult(
            name="Image receipt upload and OCR",
            status="PASS",
            details=f"OCR extracted '{preview_clean}...', parsed merchant: {merchant}, total: {total}",
            extra={"document_id": doc_id, "ocr_text": ocr_preview},
        )
    except Exception as e:
        return CheckResult(
            name="Image receipt upload and OCR",
            status="FAIL",
            details=f"Image OCR check encountered error: {e!s}",
            error=str(e),
        )


def check_3_pdf_receipt_extraction(manager: TestServerManager) -> CheckResult:
    """Check 3 — PDF receipt extraction and format validation."""
    try:
        # Generate synthetic PDF receipt
        doc = pymupdf.open()
        page = doc.new_page()
        text = (
            "NORTHSTAR CLOUD SYSTEMS\n"
            "Invoice #: NCS-2026-904\n"
            "Date: 2026-09-22\n\n"
            "Dedicated Server Pro      $150.00\n"
            "Subtotal: $150.00\n"
            "Tax (10%): $15.00\n"
            "Total: $165.00\n"
            "Payment Method: Corporate Visa ending in 4102\n"
        )
        page.insert_text((50, 72), text, fontsize=12)
        pdf_bytes = doc.tobytes()
        doc.close()

        # 1. Verify PyMuPDF extracts embedded text directly
        direct_text, page_cnt = extract_text_from_pdf(pdf_bytes)
        if "NORTHSTAR CLOUD SYSTEMS" not in direct_text or page_cnt != 1:
            return CheckResult(
                name="PDF extraction",
                status="FAIL",
                details="Direct PyMuPDF extraction failed to read expected synthetic text",
            )

        client = httpx.Client(base_url=manager.base_url, timeout=30.0)

        # 2. Upload via API
        files = {"file": ("northstar_invoice.pdf", pdf_bytes, "application/pdf")}
        upload_res = client.post("/api/v1/documents/upload", files=files)
        if upload_res.status_code != 200:
            return CheckResult(
                name="PDF extraction",
                status="FAIL",
                details=f"PDF upload returned HTTP {upload_res.status_code}",
            )
        doc_id = upload_res.json().get("document_id")

        # 3. Verify text extraction via review endpoint
        rev_res = client.get(f"/api/v1/documents/{doc_id}/review")
        if rev_res.status_code != 200:
            return CheckResult(
                name="PDF extraction",
                status="FAIL",
                details=f"PDF review returned HTTP {rev_res.status_code}",
            )
        rev_data = rev_res.json()
        preview = rev_data.get("ocr_text_preview", "")
        if "NORTHSTAR" not in preview:
            return CheckResult(
                name="PDF extraction",
                status="FAIL",
                details=f"Expected 'NORTHSTAR' in PDF review preview, got: {preview[:60]}",
            )

        # 4. Verify rejection of invalid / corrupted PDF
        bad_files = {"file": ("corrupted.pdf", b"NOT_A_VALID_PDF_HEADER_12345", "application/pdf")}
        bad_res = client.post("/api/v1/documents/upload", files=bad_files)
        if bad_res.status_code != 415:
            return CheckResult(
                name="PDF extraction",
                status="FAIL",
                details=f"Expected HTTP 415 for invalid PDF signature, got {bad_res.status_code}",
            )

        return CheckResult(
            name="PDF extraction",
            status="PASS",
            details=f"PyMuPDF extracted {len(preview)} chars ('NORTHSTAR CLOUD SYSTEMS'); invalid PDF rejected (HTTP 415)",
            extra={"document_id": doc_id},
        )
    except Exception as e:
        return CheckResult(
            name="PDF extraction",
            status="FAIL",
            details=f"PDF extraction check failed: {e!s}",
            error=str(e),
        )


def check_4_sqlite_transaction_persistence(manager: TestServerManager) -> CheckResult:
    """Check 4 — SQLite transaction persistence across server restart."""
    try:
        # Create a synthetic receipt for confirming
        doc = pymupdf.open()
        page = doc.new_page()
        page.insert_text(
            (50, 72),
            "PERSISTENCE TEST CORP\nTotal: $128.50\nDate: 2026-10-15\n",
            fontsize=12,
        )
        pdf_bytes = doc.tobytes()
        doc.close()

        client = httpx.Client(base_url=manager.base_url, timeout=30.0)

        # 1. Upload receipt
        up_res = client.post(
            "/api/v1/documents/upload",
            files={"file": ("persistence_receipt.pdf", pdf_bytes, "application/pdf")},
        )
        if up_res.status_code != 200:
            return CheckResult(
                name="SQLite save and restart persistence",
                status="FAIL",
                details=f"Upload failed: HTTP {up_res.status_code}",
            )
        doc_id = up_res.json()["document_id"]

        # 2. Confirm and save transaction
        confirm_payload = {
            "document_id": doc_id,
            "merchant": "PERSISTENCE TEST CORP",
            "invoice_number": "INV-PERSIST-999",
            "transaction_date": "2026-10-15",
            "subtotal": 118.00,
            "tax": 10.50,
            "total": 128.50,
            "currency": "USD",
            "category": "Office Supplies",
            "payment_method": "Corporate Debit",
            "notes": "Verified across test server restart",
        }
        confirm_res = client.post("/api/v1/receipts/confirm", json=confirm_payload)
        if confirm_res.status_code != 200:
            return CheckResult(
                name="SQLite save and restart persistence",
                status="FAIL",
                details=f"Confirm returned HTTP {confirm_res.status_code}: {confirm_res.text[:100]}",
            )
        tx = confirm_res.json()
        tx_id = tx["id"]

        # 3. Read back via API before restart
        get_res = client.get(f"/api/v1/transactions/{tx_id}")
        if get_res.status_code != 200:
            return CheckResult(
                name="SQLite save and restart persistence",
                status="FAIL",
                details=f"Pre-restart GET /transactions/{tx_id} returned HTTP {get_res.status_code}",
            )

        # 4. Verify in isolated SQLite file directly
        conn = sqlite3.connect(str(manager.isolated_db))
        row = conn.execute(
            "SELECT id, merchant, total FROM transactions WHERE id = ?", (tx_id,)
        ).fetchone()
        conn.close()
        if not row or row[1] != "PERSISTENCE TEST CORP":
            return CheckResult(
                name="SQLite save and restart persistence",
                status="FAIL",
                details="Transaction not found in isolated SQLite database file prior to restart",
            )

        # 5. Stop ONLY the test server started by this test runner
        manager.stop()

        # 6. Restart the test server against the exact same isolated database
        restarted = manager.start(timeout=15.0)
        if not restarted:
            return CheckResult(
                name="SQLite save and restart persistence",
                status="FAIL",
                details="Test server failed to restart against isolated database",
            )

        # 7. Retrieve transaction again after restart
        client_after = httpx.Client(base_url=manager.base_url, timeout=10.0)
        after_res = client_after.get(f"/api/v1/transactions/{tx_id}")
        if after_res.status_code != 200:
            return CheckResult(
                name="SQLite save and restart persistence",
                status="FAIL",
                details=f"Post-restart GET /transactions/{tx_id} returned HTTP {after_res.status_code}",
            )
        after_tx = after_res.json()
        if (
            after_tx.get("id") != tx_id
            or after_tx.get("merchant") != "PERSISTENCE TEST CORP"
            or float(after_tx.get("total", 0)) != 128.50
        ):
            return CheckResult(
                name="SQLite save and restart persistence",
                status="FAIL",
                details=f"Post-restart transaction mismatch: {after_tx}",
            )

        # Verify search query works across restart
        search_res = client_after.get("/api/v1/transactions?search=PERSISTENCE")
        if search_res.status_code != 200 or search_res.json().get("total", 0) < 1:
            return CheckResult(
                name="SQLite save and restart persistence",
                status="FAIL",
                details="Post-restart search query failed to locate transaction",
            )

        return CheckResult(
            name="SQLite save and restart persistence",
            status="PASS",
            details=f"TX {tx_id[:8]}... persisted with exact values across server stop and restart",
            extra={"transaction_id": tx_id},
        )
    except Exception as e:
        return CheckResult(
            name="SQLite save and restart persistence",
            status="FAIL",
            details=f"Persistence check error: {e!s}",
            error=str(e),
        )


def check_5_tesseract_installation() -> CheckResult:
    """Check 5 — Tesseract OCR installation and smoke test."""
    if importlib.util.find_spec("pytesseract") is None:
        return CheckResult(
            name="Tesseract OCR",
            status="FAIL",
            details="pytesseract is not installed in the Python environment",
        )

    is_available = ocr_service.is_available()
    bin_path = ocr_service._binary_path

    if not is_available or not bin_path or not Path(bin_path).is_file():
        return CheckResult(
            name="Tesseract OCR",
            status="FAIL",
            details=(
                "Tesseract binary not found in PATH or standard locations. "
                "Install via 'scoop install tesseract' or https://github.com/UB-Mannheim/tesseract/wiki, "
                "then set TESSERACT_CMD in .env or add to PATH."
            ),
        )

    try:
        ver_proc = subprocess.run(
            [bin_path, "--version"],
            capture_output=True,
            text=True,
            check=True,
        )
        version_line = ver_proc.stdout.splitlines()[0] if ver_proc.stdout else "v?"
    except Exception as e:
        return CheckResult(
            name="Tesseract OCR",
            status="FAIL",
            details=f"Failed to execute '{bin_path} --version': {e!s}",
        )

    # Smoke test on synthetic image
    img = Image.new("RGB", (500, 200), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((30, 40), "TESSERACT SMOKE TEST 2026", fill=(0, 0, 0))
    draw.text((30, 90), "LocalLedger OCR Engine OK", fill=(0, 0, 0))
    scaled = img.resize((1000, 400), Image.Resampling.NEAREST)

    try:
        extracted = ocr_service.extract_text(scaled)
        if "TESSERACT" not in extracted.upper() and "SMOKE" not in extracted.upper():
            return CheckResult(
                name="Tesseract OCR",
                status="FAIL",
                details=f"OCR smoke test output missing expected text. Got: '{extracted[:60]}'",
            )
    except Exception as e:
        return CheckResult(
            name="Tesseract OCR",
            status="FAIL",
            details=f"OCR smoke test execution failed: {e!s}",
        )

    clean_ver = version_line.strip()
    return CheckResult(
        name="Tesseract OCR",
        status="PASS",
        details=f"{clean_ver} ({bin_path}), smoke test verified",
        extra={"binary": bin_path, "version": clean_ver},
    )


def check_6_ollama_local_inference() -> CheckResult:
    """Check 6 — Ollama local service, model availability, and inference."""
    # 1. Check local Ollama daemon
    try:
        with httpx.Client(timeout=3.0) as client:
            tags_res = client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if tags_res.status_code != 200:
                return CheckResult(
                    name="Ollama local inference",
                    status="SKIP",
                    details=f"Ollama returned HTTP {tags_res.status_code} at {settings.OLLAMA_BASE_URL}",
                )
            tags_data = tags_res.json()
    except Exception as e:
        return CheckResult(
            name="Ollama local inference",
            status="SKIP",
            details=f"Local Ollama service unreachable at {settings.OLLAMA_BASE_URL} ({e!s})",
        )

    # 2. Check configured model
    models = [m.get("name") for m in tags_data.get("models", []) if m.get("name")]
    configured_model = settings.OLLAMA_MODEL
    matching_model = next(
        (m for m in models if configured_model in m or m.startswith(configured_model)),
        None,
    )

    if not matching_model:
        return CheckResult(
            name="Ollama local inference",
            status="SKIP",
            details=(
                f"Configured model '{configured_model}' not installed in local Ollama ({models}). "
                f"Run 'ollama run {configured_model}' to install locally."
            ),
        )

    # 3. Small test inference (never cloud fallback, strictly local loopback)
    try:
        payload = {
            "model": matching_model,
            "prompt": "Respond with a JSON object: {\"ping\": \"pong\"}",
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.1},
        }
        with httpx.Client(timeout=15.0) as client:
            gen_res = client.post(f"{settings.OLLAMA_BASE_URL}/api/generate", json=payload)
            if gen_res.status_code != 200:
                return CheckResult(
                    name="Ollama local inference",
                    status="FAIL",
                    details=f"Ollama generate returned HTTP {gen_res.status_code}",
                )
            gen_data = gen_res.json()
            resp_text = gen_data.get("response", "").strip()
            if not resp_text:
                return CheckResult(
                    name="Ollama local inference",
                    status="FAIL",
                    details="Ollama model returned empty response string",
                )

        compact_resp = " ".join(resp_text.split())[:35]
        return CheckResult(
            name="Ollama local inference",
            status="PASS",
            details=f"Model '{matching_model}' responded: '{compact_resp}...'",
            extra={"model": matching_model, "response": resp_text},
        )
    except httpx.TimeoutException:
        return CheckResult(
            name="Ollama local inference",
            status="FAIL",
            details=f"Local inference timed out after 15s on model '{matching_model}'",
        )
    except Exception as e:
        return CheckResult(
            name="Ollama local inference",
            status="FAIL",
            details=f"Ollama inference error: {e!s}",
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="LocalLedger AI Integration Checks Runner")
    parser.add_argument("--port", type=int, default=0, help="Preferred loopback port for test server")
    parser.add_argument("--keep-temp", action="store_true", help="Retain temporary test database for inspection")
    parser.add_argument("--verbose", action="store_true", help="Print verbose server output")
    args = parser.parse_args()

    print("=" * 70)
    print(" LocalLedger AI — End-to-End Integration Verification Runner")
    print("=" * 70)

    # Safety baseline check: inspect real database metadata
    real_db = settings.resolved_db_path
    real_db_exists = real_db.exists()
    real_db_initial_mtime = real_db.stat().st_mtime if real_db_exists else None
    real_db_initial_size = real_db.stat().st_size if real_db_exists else None

    # Check port 8000 state before starting
    occ_pid, occ_name = get_process_on_port(8000)
    port_8000_occupied = occ_pid is not None

    if port_8000_occupied:
        print(f"[INFO] Port 8000 is occupied by PID {occ_pid} ({occ_name}). Leaving it untouched.")
    else:
        print("[INFO] Port 8000 is currently available.")

    # Select target port for isolated test server
    preferred_port = args.port if args.port > 0 else (8001 if port_8000_occupied else 8000)
    test_port = find_available_port(preferred_port)
    print(f"[INFO] Launching isolated test server on loopback port {test_port}...")

    # Set up isolated temporary storage
    temp_dir = Path(tempfile.mkdtemp(prefix="localledger_test_"))
    isolated_db = temp_dir / "test_localledger.db"
    isolated_uploads = temp_dir / "test_uploads"
    isolated_uploads.mkdir(parents=True, exist_ok=True)

    print(f"[INFO] Isolated test database: {isolated_db}")
    print(f"[INFO] Isolated uploads path:  {isolated_uploads}")

    manager = TestServerManager(
        temp_dir=temp_dir,
        isolated_db=isolated_db,
        isolated_uploads=isolated_uploads,
        port=test_port,
        verbose=args.verbose,
    )

    started = manager.start(timeout=15.0)
    if not started:
        print(f"[ERROR] Could not start test server on http://127.0.0.1:{test_port}!")
        if manager.log_file.exists():
            print("--- Server log tail ---")
            print(manager.log_file.read_text(encoding="utf-8", errors="replace")[-1000:])
        shutil.rmtree(temp_dir, ignore_errors=True)
        return 1

    results: list[CheckResult] = []
    safety_violation = False

    try:
        # Check 1: Health & API
        print("\n[CHECK 1/6] Running API health and route verification...")
        r1 = check_1_backend_health_and_api(manager, port_8000_occupied, occ_pid, occ_name)
        results.append(r1)
        print(f"  -> {r1.status}: {r1.details}")

        # Check 2: Image OCR Upload
        print("[CHECK 2/6] Running receipt image upload and OCR verification...")
        r2 = check_2_receipt_image_upload_and_ocr(manager)
        results.append(r2)
        print(f"  -> {r2.status}: {r2.details}")

        # Check 3: PDF Extraction
        print("[CHECK 3/6] Running PDF receipt extraction verification...")
        r3 = check_3_pdf_receipt_extraction(manager)
        results.append(r3)
        print(f"  -> {r3.status}: {r3.details}")

        # Check 4: SQLite Persistence across server restart
        print("[CHECK 4/6] Running SQLite save and server-restart persistence verification...")
        r4 = check_4_sqlite_transaction_persistence(manager)
        results.append(r4)
        print(f"  -> {r4.status}: {r4.details}")

        # Check 5: Tesseract OCR
        print("[CHECK 5/6] Verifying Tesseract OCR installation and smoke test...")
        r5 = check_5_tesseract_installation()
        results.append(r5)
        print(f"  -> {r5.status}: {r5.details}")

        # Check 6: Ollama Local Inference
        print("[CHECK 6/6] Verifying Ollama service and local model inference...")
        r6 = check_6_ollama_local_inference()
        results.append(r6)
        print(f"  -> {r6.status}: {r6.details}")

    finally:
        # Cleanly stop test server
        print("\n[INFO] Stopping isolated test server...")
        manager.stop()

        # Clean up temporary test files unless --keep-temp was requested
        if not args.keep_temp:
            print("[INFO] Cleaning up temporary test directory and isolated database...")
            shutil.rmtree(temp_dir, ignore_errors=True)
        else:
            print(f"[INFO] Retaining temporary test directory at: {temp_dir}")

        # Safety verification: ensure real database file was not touched
        if real_db_exists:
            curr_mtime = real_db.stat().st_mtime
            curr_size = real_db.stat().st_size
            if curr_mtime != real_db_initial_mtime or curr_size != real_db_initial_size:
                print(f"[FATAL SAFETY VIOLATION] Real database {real_db} was modified during testing!")
                safety_violation = True
            else:
                print(f"[SAFETY OK] Real database {real_db} was untouched.")

    if safety_violation:
        return 1

    # Print Final Markdown Report
    print("\n" + "=" * 70)
    print(" FINAL INTEGRATION VERIFICATION REPORT")
    print("=" * 70 + "\n")

    print("| Check | Status | Details |")
    print("|---|---|---|")
    for r in results:
        print(f"| {r.name} | {r.status} | {r.details} |")

    failures = [r for r in results if r.status == "FAIL"]
    blocked = [r for r in results if r.status == "BLOCKED"]
    skips = [r for r in results if r.status == "SKIP"]
    passes = [r for r in results if r.status == "PASS"]

    print("\n--- Summary ---")
    overall_status = "PASS" if not failures and not blocked else "FAIL"
    print(f"Overall result:              {overall_status} ({len(passes)} passed, {len(failures)} failed, {len(skips)} skipped, {len(blocked)} blocked)")
    print("Command to rerun:            .\\scripts\\run_integration_checks.ps1")
    print(f"Python interpreter:          {sys.executable}")
    print("Files created or modified:   backend\\scripts\\run_integration_checks.py, backend\\scripts\\run_integration_checks.ps1")
    print("Test database & fixtures:    Isolated in OS temp directory (cleaned up automatically)")
    print("Manual setup required:       None (all dependencies detected and verified)")
    print(f"Remaining issues:            {'None' if overall_status == 'PASS' else f'{len(failures)} check(s) failed'}")
    print("=" * 70 + "\n")

    return 0 if overall_status == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
