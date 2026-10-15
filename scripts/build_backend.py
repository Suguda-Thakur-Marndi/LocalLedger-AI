"""
LocalLedger AI - PyInstaller Backend Packaging Script

Compiles the FastAPI backend service into a standalone Windows executable
located at dist/backend/localledger-backend/localledger-backend.exe.
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
ENTRY_POINT = BACKEND_DIR / "desktop_entry.py"
OUTPUT_DIR = ROOT_DIR / "dist" / "backend"


def find_pyinstaller() -> Path:
    """Locate pyinstaller executable from local virtual environment or PATH."""
    venv_pyinstaller = BACKEND_DIR / ".venv" / "Scripts" / "pyinstaller.exe"
    if venv_pyinstaller.is_file():
        return venv_pyinstaller

    root_venv_pyinstaller = ROOT_DIR / ".venv" / "Scripts" / "pyinstaller.exe"
    if root_venv_pyinstaller.is_file():
        return root_venv_pyinstaller

    which_pyinstaller = shutil.which("pyinstaller")
    if which_pyinstaller:
        return Path(which_pyinstaller)

    raise FileNotFoundError(
        "PyInstaller not found. Please install it in backend/.venv with: pip install pyinstaller"
    )


def build_backend():
    print("=" * 70)
    print(" LocalLedger AI - Building Standalone Python Backend")
    print("=" * 70)

    pyinstaller_exe = find_pyinstaller()
    print(f"Using PyInstaller: {pyinstaller_exe}")
    print(f"Entry point:       {ENTRY_POINT}")
    print(f"Output directory:  {OUTPUT_DIR}")

    # Hidden imports essential for FastAPI, Uvicorn, PyMuPDF, SQLite, and Pydantic v2
    hidden_imports = [
        "uvicorn",
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.http.httptools_impl",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespans",
        "uvicorn.lifespans.on",
        "app",
        "app.main",
        "app.api.v1.router",
        "app.core.config",
        "app.core.errors",
        "app.core.logging",
        "app.db.base",
        "app.db.session",
        "app.models.document",
        "app.models.transaction",
        "app.services.ai.ollama_client",
        "app.services.ai.ai_extractor",
        "app.services.ocr.ocr_service",
        "app.services.ocr.pdf_parser",
        "app.services.backup.backup_service",
        "app.services.reports.report_service",
        "app.services.transactions.transaction_service",
        "app.services.receipts.receipt_validator",
        "app.services.receipts.rule_extractor",
        "fitz",
        "pymupdf",
        "pytesseract",
        "PIL",
        "PIL.Image",
        "sqlite3",
        "sqlalchemy.dialects.sqlite",
        "pydantic",
        "pydantic_settings",
        "email.mime.multipart",
        "multipart",
    ]

    cmd = [
        str(pyinstaller_exe),
        "--name=localledger-backend",
        "--onedir",
        "--noconfirm",
        f"--distpath={OUTPUT_DIR}",
        f"--workpath={ROOT_DIR / 'build' / 'pyinstaller'}",
        f"--specpath={ROOT_DIR / 'build' / 'spec'}",
        f"--paths={BACKEND_DIR}",
    ]

    # Add hidden imports
    for imp in hidden_imports:
        cmd.append(f"--hidden-import={imp}")

    # Add alembic migration files if directory exists
    alembic_dir = BACKEND_DIR / "alembic"
    if alembic_dir.is_dir():
        cmd.append(f"--add-data={alembic_dir}{os.pathsep}alembic")

    cmd.append(str(ENTRY_POINT))

    print(f"Executing PyInstaller command...")
    res = subprocess.run(cmd, cwd=str(ROOT_DIR))
    if res.returncode != 0:
        print(f"Fatal: PyInstaller compilation failed with code {res.returncode}", file=sys.stderr)
        sys.exit(res.returncode)

    expected_exe = OUTPUT_DIR / "localledger-backend" / "localledger-backend.exe"
    if not expected_exe.is_file():
        print(f"Fatal: Expected executable not found at {expected_exe}", file=sys.stderr)
        sys.exit(1)

    size_mb = expected_exe.stat().st_size / (1024 * 1024)
    print("-" * 70)
    print(f"[SUCCESS] Backend compiled successfully: {expected_exe} ({size_mb:.2f} MB)")
    print("-" * 70)


if __name__ == "__main__":
    build_backend()
