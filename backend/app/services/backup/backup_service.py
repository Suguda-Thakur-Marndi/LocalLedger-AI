"""
backup_service.py - LocalLedger AI Vault Backup Service
Generates a verified ZIP archive: SQLite DB snapshot, all receipt assets,
and a JSON manifest with schema version, timestamps, relative paths, and SHA-256 hashes.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import sqlite3
import tempfile
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import BackupIntegrityError
from app.core.logging import logger
from app.models.document import Document

MANIFEST_SCHEMA_VERSION = "1.0"


def _compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _safe_zip_name(prefix: str, filename: str) -> str:
    """Return a safe ZIP entry path, preventing path traversal."""
    safe = Path(filename).name
    safe = "".join(c if c.isalnum() or c in "._-" else "_" for c in safe)
    if not safe:
        raise ValueError(f"Cannot produce a safe ZIP name for: {filename!r}")
    entry = f"{prefix}/{safe}"
    if ".." in entry:
        raise ValueError(f"Path traversal detected in ZIP name: {entry!r}")
    return entry


def _vacuum_into(db_path: Path) -> bytes:
    """
    Take a consistent SQLite snapshot via VACUUM INTO (SQLite >= 3.27).
    Falls back to a locked raw read if VACUUM INTO is unavailable.
    Returns the raw database bytes.
    """
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        conn = sqlite3.connect(str(db_path))
        try:
            conn.execute(f"VACUUM INTO '{tmp_path}'")
            conn.close()
        except sqlite3.OperationalError:
            conn.close()
            # Fallback: exclusive lock + raw read
            conn2 = sqlite3.connect(str(db_path))
            conn2.execute("BEGIN EXCLUSIVE")
            try:
                raw = db_path.read_bytes()
            finally:
                conn2.execute("ROLLBACK")
                conn2.close()
            return raw

        return Path(tmp_path).read_bytes()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _backup_sqlite_db(db: Session | None = None) -> bytes:
    """
    Take a consistent SQLite snapshot.
    Prefers using the active SQLAlchemy session's underlying SQLite connection
    via the sqlite3 online backup API (raw_conn.backup(dst)).
    Falls back to _vacuum_into on settings.resolved_db_path.
    """
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        backed_up = False
        if db is not None:
            try:
                raw_conn = db.connection().connection.dbapi_connection
                if isinstance(raw_conn, sqlite3.Connection):
                    dst = sqlite3.connect(tmp_path)
                    try:
                        raw_conn.backup(dst)
                    finally:
                        dst.close()
                    backed_up = True
            except Exception as exc:
                logger.warning("Could not backup from active session connection: %s", exc)

        if not backed_up:
            db_path = settings.resolved_db_path
            if not db_path.is_file():
                raise BackupIntegrityError(f"SQLite database file not found at: {db_path}")
            return _vacuum_into(db_path)

        return Path(tmp_path).read_bytes()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _verify_db_integrity(db_bytes: bytes, as_restore: bool = False) -> None:
    """Run SQLite integrity_check and foreign_key_check on the backup bytes."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp.write(db_bytes)
        tmp_path = tmp.name

    try:
        conn = sqlite3.connect(tmp_path)
        try:
            result = conn.execute("PRAGMA integrity_check").fetchone()
            fk_result = conn.execute("PRAGMA foreign_key_check").fetchall()
        finally:
            conn.close()

        if not result or result[0] != "ok":
            msg = f"Database integrity check failed: {result[0] if result else 'unknown'}"
            if as_restore:
                from app.core.errors import RestoreVerificationError
                raise RestoreVerificationError(msg)
            raise BackupIntegrityError(msg)

        if fk_result:
            msg = f"Database foreign key check failed: {len(fk_result)} violations"
            if as_restore:
                from app.core.errors import RestoreVerificationError
                raise RestoreVerificationError(msg)
            raise BackupIntegrityError(msg)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


class BackupService:
    """Generates and verifies vault backup ZIP archives."""

    @staticmethod
    def generate_zip_backup(db: Session) -> tuple[bytes, str]:
        """
        Build a complete, verified ZIP backup in memory.

        Returns (zip_bytes, suggested_filename).
        Raises BackupIntegrityError on any integrity failure.
        """
        timestamp = datetime.now(UTC)
        ts_str = timestamp.strftime("%Y%m%d_%H%M%S")
        archive_prefix = f"localledger_backup_{ts_str}"
        filename = f"{archive_prefix}.zip"

        logger.info("Starting vault backup generation: %s", archive_prefix)

        # 1. Collect all Document records
        docs: list[Document] = list(
            db.execute(select(Document)).scalars().all()
        )
        upload_dir = settings.resolved_upload_dir

        # 2. Verify every asset exists and compute hashes
        missing: list[dict[str, str]] = []
        asset_entries: list[dict[str, Any]] = []

        for doc in docs:
            file_path = upload_dir / doc.storage_filename
            try:
                zip_name = _safe_zip_name(
                    f"{archive_prefix}/assets", doc.storage_filename
                )
            except ValueError as exc:
                logger.warning("Backup: skipping document %s — %s", doc.id, exc)
                missing.append({
                    "document_id": doc.id,
                    "storage_filename": doc.storage_filename,
                    "reason": str(exc),
                })
                continue

            if not file_path.is_file():
                logger.warning(
                    "Backup: asset missing for document %s: %s",
                    doc.id, doc.storage_filename,
                )
                missing.append({
                    "document_id": doc.id,
                    "storage_filename": doc.storage_filename,
                    "original_filename": doc.original_filename,
                    "reason": "File not found on disk",
                })
                continue

            file_bytes = file_path.read_bytes()
            actual_hash = _compute_sha256(file_bytes)

            if actual_hash != doc.sha256_hash:
                logger.warning(
                    "Backup: hash drift for document %s "
                    "(recorded=%s, actual=%s)",
                    doc.id, doc.sha256_hash[:12], actual_hash[:12],
                )

            asset_entries.append({
                "doc": doc,
                "zip_name": zip_name,
                "actual_hash": actual_hash,
                "file_bytes": file_bytes,
            })

        if missing:
            raise BackupIntegrityError(
                f"Backup aborted: {len(missing)} asset file(s) missing from disk. "
                f"Files: {[m['storage_filename'] for m in missing]}",
                details=missing,
            )

        # 3. Create SQLite backup
        db_bytes = _backup_sqlite_db(db)
        if not db_bytes:
            raise BackupIntegrityError("SQLite backup produced an empty file.")

        _verify_db_integrity(db_bytes)
        db_hash = _compute_sha256(db_bytes)

        # 4. Build manifest
        manifest: dict[str, Any] = {
            "schema_version": MANIFEST_SCHEMA_VERSION,
            "generator": "LocalLedger AI Backup Service",
            "export_timestamp": timestamp.isoformat(),
            "archive_prefix": archive_prefix,
            "database": {
                "path": f"{archive_prefix}/database/localledger.db",
                "sha256": db_hash,
            },
            "document_count": len(docs),
            "asset_count": len(asset_entries),
            "missing_asset_count": 0,
            "missing_assets": [],
            "assets": [
                {
                    "document_id": e["doc"].id,
                    "transaction_id": e["doc"].transaction_id,
                    "original_filename": e["doc"].original_filename,
                    "storage_filename": e["doc"].storage_filename,
                    "mime_type": e["doc"].mime_type,
                    "file_size": e["doc"].file_size,
                    "processing_status": e["doc"].processing_status,
                    "sha256_recorded": e["doc"].sha256_hash,
                    "sha256_actual": e["actual_hash"],
                    "zip_path": e["zip_name"],
                    "created_at": e["doc"].created_at.isoformat(),
                }
                for e in asset_entries
            ],
        }

        # 5. Assemble ZIP in memory
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(
            zip_buf, mode="w", compression=zipfile.ZIP_DEFLATED
        ) as zf:
            zf.writestr(
                f"{archive_prefix}/database/localledger.db", db_bytes
            )
            written_zip_entries: set[str] = set()
            for entry in asset_entries:
                if entry["zip_name"] not in written_zip_entries:
                    zf.writestr(entry["zip_name"], entry["file_bytes"])
                    written_zip_entries.add(entry["zip_name"])
            manifest_bytes = json.dumps(
                manifest, indent=2, ensure_ascii=False
            ).encode("utf-8")
            zf.writestr(f"{archive_prefix}/manifest.json", manifest_bytes)

        zip_bytes = zip_buf.getvalue()

        # 6. Post-build re-verification
        BackupService._verify_zip_contents(zip_bytes, manifest, archive_prefix)

        logger.info(
            "Backup complete: %s (%d assets, %d bytes)",
            filename, len(asset_entries), len(zip_bytes),
        )
        return zip_bytes, filename

    @staticmethod
    def _verify_zip_contents(
        zip_bytes: bytes,
        manifest: dict[str, Any],
        archive_prefix: str,
    ) -> None:
        """Re-read the produced ZIP and verify all hashes."""
        with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
            names = set(zf.namelist())

            manifest_name = f"{archive_prefix}/manifest.json"
            if manifest_name not in names:
                raise BackupIntegrityError(
                    "Post-build verify: manifest.json missing from archive."
                )

            db_zip_path = manifest["database"]["path"]
            if db_zip_path not in names:
                raise BackupIntegrityError(
                    f"Post-build verify: database entry missing: {db_zip_path}"
                )
            db_actual = _compute_sha256(zf.read(db_zip_path))
            if db_actual != manifest["database"]["sha256"]:
                raise BackupIntegrityError(
                    f"Post-build verify: database SHA-256 mismatch "
                    f"(expected={manifest['database']['sha256'][:12]}..., "
                    f"got={db_actual[:12]}...)"
                )

            for asset in manifest["assets"]:
                zip_path = asset["zip_path"]
                if zip_path not in names:
                    raise BackupIntegrityError(
                        f"Post-build verify: asset missing: {zip_path}"
                    )
                actual = _compute_sha256(zf.read(zip_path))
                if actual != asset["sha256_actual"]:
                    raise BackupIntegrityError(
                        f"Post-build verify: hash mismatch for "
                        f"'{asset['storage_filename']}'"
                    )

        logger.info(
            "Post-build verification passed (%d assets).",
            len(manifest["assets"]),
        )

    @staticmethod
    def verify_restore_archive(zip_bytes: bytes) -> dict[str, Any]:
        """
        Validate a backup archive before any restore operation.
        Returns the parsed manifest on success.
        Raises RestoreVerificationError on any failure.

        Safe recovery procedure
        -----------------------
        1. Call this method first — it raises on any integrity problem.
        2. Extract to a SEPARATE temp directory; never overwrite the live DB.
        3. Open the extracted DB in read-only mode and run
           PRAGMA integrity_check before moving anything into place.
        4. Only after all checks pass, prompt the user to confirm before
           overwriting the live data directory.
        """
        from app.core.errors import RestoreVerificationError

        try:
            zf_handle = zipfile.ZipFile(io.BytesIO(zip_bytes), "r")
        except zipfile.BadZipFile as exc:
            raise RestoreVerificationError(
                f"Archive is not a valid ZIP file: {exc}"
            ) from exc

        with zf_handle as zf:
            names = set(zf.namelist())

            candidates = [n for n in names if n.endswith("/manifest.json")]
            if not candidates:
                raise RestoreVerificationError(
                    "No manifest.json found in archive."
                )
            if len(candidates) > 1:
                raise RestoreVerificationError(
                    f"Ambiguous archive: multiple manifests: {candidates}"
                )

            try:
                manifest = json.loads(zf.read(candidates[0]))
            except json.JSONDecodeError as exc:
                raise RestoreVerificationError(
                    f"manifest.json is not valid JSON: {exc}"
                ) from exc

            if manifest.get("schema_version") != MANIFEST_SCHEMA_VERSION:
                raise RestoreVerificationError(
                    f"Unsupported manifest schema version: "
                    f"'{manifest.get('schema_version')}'. "
                    f"Expected: '{MANIFEST_SCHEMA_VERSION}'."
                )

            db_zip_path = manifest.get("database", {}).get("path")
            if not db_zip_path or db_zip_path not in names:
                raise RestoreVerificationError(
                    f"Database entry missing: {db_zip_path}"
                )
            db_bytes = zf.read(db_zip_path)
            db_actual = _compute_sha256(db_bytes)
            if db_actual != manifest["database"].get("sha256"):
                raise RestoreVerificationError(
                    "Database SHA-256 mismatch in restore archive."
                )
            _verify_db_integrity(db_bytes, as_restore=True)

            errors: list[str] = []
            for asset in manifest.get("assets", []):
                zip_path = asset.get("zip_path")
                if not zip_path or zip_path not in names:
                    errors.append(f"Asset missing: {zip_path}")
                    continue
                actual = _compute_sha256(zf.read(zip_path))
                if actual != asset.get("sha256_actual"):
                    errors.append(
                        f"Hash mismatch for '{asset.get('storage_filename')}'"
                    )

            if errors:
                from app.core.errors import RestoreVerificationError as RVE
                raise RVE(
                    f"Archive verification failed ({len(errors)} error(s)).",
                    details=errors,
                )

        return manifest

    @staticmethod
    def restore_archive_to_staging(
        zip_bytes: bytes,
        staging_dir: Path | None = None,
    ) -> tuple[dict[str, Any], Path]:
        """
        Safely extract a verified backup archive into a separate staging directory.
        Never touches the live database or upload directory automatically.

        Returns (manifest, staging_directory_path).
        Raises RestoreVerificationError on any integrity or extraction failure.
        """
        from app.core.errors import RestoreVerificationError

        manifest = BackupService.verify_restore_archive(zip_bytes)
        archive_prefix = manifest["archive_prefix"]

        if staging_dir is None:
            staging_dir = Path(tempfile.mkdtemp(prefix="localledger_restore_"))
        else:
            staging_dir.mkdir(parents=True, exist_ok=True)

        staging_resolved = staging_dir.resolve()

        with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
            for item in zf.infolist():
                name = item.filename
                # Prevent path traversal (Zip Slip vulnerability)
                if ".." in name or name.startswith("/") or name.startswith("\\"):
                    raise RestoreVerificationError(
                        f"Unsafe path detected in restore archive: {name!r}"
                    )

                # Strip archive prefix for clean extraction into staging_dir
                if name.startswith(f"{archive_prefix}/"):
                    rel_name = name[len(archive_prefix) + 1 :]
                else:
                    rel_name = name

                if not rel_name:
                    continue

                target_file = (staging_resolved / rel_name).resolve()
                if not str(target_file).startswith(str(staging_resolved)):
                    raise RestoreVerificationError(
                        f"Zip traversal attempt detected: {target_file}"
                    )

                if item.is_dir():
                    target_file.mkdir(parents=True, exist_ok=True)
                else:
                    target_file.parent.mkdir(parents=True, exist_ok=True)
                    with zf.open(item) as src, open(target_file, "wb") as dst:
                        dst.write(src.read())

        # Verify extracted database on disk
        extracted_db = staging_resolved / "database" / "localledger.db"
        if not extracted_db.is_file():
            raise RestoreVerificationError(
                f"Extracted database missing from staging: {extracted_db}"
            )

        db_hash = _compute_sha256(extracted_db.read_bytes())
        if db_hash != manifest["database"]["sha256"]:
            raise RestoreVerificationError("Staged database hash mismatch.")

        # Re-check SQLite integrity on disk
        conn = sqlite3.connect(str(extracted_db))
        try:
            res = conn.execute("PRAGMA integrity_check").fetchone()
            if not res or res[0] != "ok":
                raise RestoreVerificationError(f"Staged database corrupted: {res}")
            fk_res = conn.execute("PRAGMA foreign_key_check").fetchall()
            if fk_res:
                raise RestoreVerificationError(f"Staged database has foreign key violations: {fk_res}")
        finally:
            conn.close()

        # Verify all extracted assets on disk
        for asset in manifest["assets"]:
            storage_name = asset["storage_filename"]
            asset_path = staging_resolved / "assets" / storage_name
            if not asset_path.is_file():
                raise RestoreVerificationError(
                    f"Staged asset missing: {storage_name}"
                )
            actual_hash = _compute_sha256(asset_path.read_bytes())
            if actual_hash != asset["sha256_actual"]:
                raise RestoreVerificationError(
                    f"Staged asset hash mismatch for {storage_name}"
                )

        logger.info(
            "Restore verification and staging succeeded in %s (%d assets).",
            staging_resolved,
            len(manifest["assets"]),
        )
        return manifest, staging_resolved


backup_service = BackupService()
