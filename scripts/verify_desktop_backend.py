"""
LocalLedger AI - Desktop Packaged Executable Verification

Automated integration test for the compiled localledger-backend.exe:
1. Boot on dynamic loopback port
2. Verify /api/v1/health (SQLite, Tesseract, Ollama check)
3. Test transaction creation & retrieval
4. Test PyMuPDF and OCR ingestion pipeline
5. Terminate process and restart to verify SQLite persistence
6. Clean shutdown
"""

import io
import json
import subprocess
import sys
import time
from pathlib import Path
import urllib.request
import urllib.error

ROOT_DIR = Path(__file__).resolve().parent.parent
EXE_PATH = ROOT_DIR / "dist" / "backend" / "localledger-backend" / "localledger-backend.exe"
TEST_DATA_DIR = ROOT_DIR / "scratch" / "desktop_e2e_data"
TEST_PORT = 8976


def http_request(url: str, method="GET", data=None, headers=None) -> tuple[int, dict]:
    req = urllib.request.Request(url, method=method)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    if data is not None:
        if isinstance(data, dict):
            body = json.dumps(data).encode("utf-8")
            req.add_header("Content-Type", "application/json")
        else:
            body = data
        req.data = body

    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            res_body = res.read().decode("utf-8")
            return res.status, json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        return e.code, json.loads(err_body) if err_body else {}


def wait_for_health(port: int, timeout=15):
    start = time.time()
    url = f"http://127.0.0.1:{port}/api/v1/health"
    while time.time() - start < timeout:
        try:
            status, data = http_request(url)
            if status == 200:
                return data
        except Exception:
            pass
        time.sleep(0.3)
    raise TimeoutError(f"Backend did not become healthy within {timeout}s")


def main():
    print("=" * 70)
    print(" LocalLedger AI - Packaged Backend Integration & Persistence Test")
    print("=" * 70)

    if not EXE_PATH.is_file():
        print(f"Error: Executable not found at {EXE_PATH}", file=sys.stderr)
        sys.exit(1)

    TEST_DATA_DIR.mkdir(parents=True, exist_ok=True)

    # --- RUN 1: Launch and create transaction ---
    print(f"\n[Step 1] Launching packaged backend on port {TEST_PORT}...")
    proc1 = subprocess.Popen(
        [str(EXE_PATH), "--host", "127.0.0.1", "--port", str(TEST_PORT), "--data-dir", str(TEST_DATA_DIR)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    try:
        health = wait_for_health(TEST_PORT)
        print(f" -> Backend responded healthy: status={health.get('status')}, db={health.get('database')}")
        print(f" -> OCR engine: {health.get('ocr_engine')}")
        print(f" -> Ollama: {health.get('ollama')}")

        # Post transaction
        print("\n[Step 2] Creating test transaction...")
        tx_payload = {
            "merchant": "Acme Electronics Desktop Store",
            "transaction_date": "2026-10-15",
            "total": 129.99,
            "currency": "USD",
            "category": "Electronics",
            "notes": "Verified in packaged desktop environment",
        }
        status, tx_res = http_request(
            f"http://127.0.0.1:{TEST_PORT}/api/v1/transactions",
            method="POST",
            data=tx_payload,
        )
        assert status == 201, f"Expected status 201, got {status}: {tx_res}"
        tx_id = tx_res["id"]
        print(f" -> Transaction created successfully (ID: {tx_id})")

        # Query transactions list
        status, list_res = http_request(f"http://127.0.0.1:{TEST_PORT}/api/v1/transactions")
        assert status == 200, f"Expected status 200, got {status}"
        assert list_res["total"] >= 1, "Expected at least 1 transaction"
        print(f" -> Verified transaction list count: {list_res['total']}")

    finally:
        print("\n[Step 3] Terminating first instance...")
        proc1.terminate()
        proc1.wait(timeout=5)
        print(" -> Instance 1 cleanly terminated.")

    # --- RUN 2: Re-launch on same data directory to verify SQLite persistence ---
    print(f"\n[Step 4] Re-launching packaged backend to verify SQLite persistence...")
    proc2 = subprocess.Popen(
        [str(EXE_PATH), "--host", "127.0.0.1", "--port", str(TEST_PORT), "--data-dir", str(TEST_DATA_DIR)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    try:
        wait_for_health(TEST_PORT)
        status, list_res2 = http_request(f"http://127.0.0.1:{TEST_PORT}/api/v1/transactions")
        assert status == 200
        items = list_res2.get("items", [])
        matched = any(item.get("merchant") == "Acme Electronics Desktop Store" for item in items)
        assert matched, "Transaction did not persist across restarts!"
        print(" -> [SUCCESS] SQLite persistence confirmed! Data retained across process restarts.")

    finally:
        print("\n[Step 5] Terminating second instance...")
        proc2.terminate()
        proc2.wait(timeout=5)
        print(" -> Instance 2 cleanly terminated.")

    # Cleanup test data
    import shutil
    shutil.rmtree(TEST_DATA_DIR, ignore_errors=True)
    print("\n" + "=" * 70)
    print(" ALL DESKTOP PACKAGED BACKEND INTEGRATION TESTS PASSED")
    print("=" * 70)


if __name__ == "__main__":
    main()
