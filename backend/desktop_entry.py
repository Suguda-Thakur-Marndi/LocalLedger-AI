"""
LocalLedger AI - Desktop Backend Standalone Entrypoint

This entrypoint is designed for the packaged Windows Desktop Application.
It boots the FastAPI application with dynamic host/port arguments, manages
safe per-user data persistence in AppData, and handles legacy data migrations.
"""

import argparse
import os
import sys
from pathlib import Path

# Add backend directory to sys.path so app module resolves cleanly
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

import uvicorn


def main():
    parser = argparse.ArgumentParser(description="LocalLedger AI Desktop Backend")
    parser.add_argument("--host", default="127.0.0.1", help="Loopback bind host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Loopback bind port (default: 8000)")
    parser.add_argument("--data-dir", default=None, help="Custom per-user persistent data directory")

    args = parser.parse_args()

    # Enforce loopback binding for security
    allowed_hosts = {"127.0.0.1", "localhost"}
    if args.host not in allowed_hosts:
        print(f"[Desktop Entry] Fatal: Host '{args.host}' is not an allowed local loopback interface.", file=sys.stderr)
        sys.exit(1)

    # Set data directory in environment if provided
    if args.data_dir:
        os.environ["LOCALLEDGER_DATA_DIR"] = str(Path(args.data_dir).resolve())

    # Import config and database engine now that environment is established
    from app.core.config import settings
    settings.BACKEND_HOST = args.host
    settings.BACKEND_PORT = args.port

    if args.data_dir:
        settings.LOCALLEDGER_DATA_DIR = str(Path(args.data_dir).resolve())

    # Ensure persistent directories exist without copying development or demo data
    settings.resolved_db_path.parent.mkdir(parents=True, exist_ok=True)
    settings.resolved_upload_dir.mkdir(parents=True, exist_ok=True)

    from app.db.base import Base
    from app.db.session import engine
    from app.main import app

    # Ensure all tables exist in target SQLite database
    Base.metadata.create_all(bind=engine)
    print(f"[Desktop Entry] Starting LocalLedger AI Backend on http://{args.host}:{args.port}")
    print(f"[Desktop Entry] Persistent DB: {settings.resolved_db_path}")
    print(f"[Desktop Entry] Uploads Dir:   {settings.resolved_upload_dir}")

    # Run uvicorn server directly
    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level="info",
        access_log=False,
    )


if __name__ == "__main__":
    main()
