"""
test_backup.py - Comprehensive backup/restore tests for LocalLedger AI

Tests:
  1. Export with no documents (empty vault)
  2. Export with confirmed (linked) documents
  3. Export with unconfirmed (unlinked) documents
  4. Export with duplicate file content - idempotent dedup
  5. Export when an asset file is missing from disk
  6. ZIP contents verification (manifest present, hashes correct)
  7. Restore verification - valid archive
  8. Restore verification - corrupted archive
  9. Restore verification - wrong schema version
 10. Existing transaction records unchanged after export
"""
import hashlib
import io
import json
import os
import sqlite3
import tempfile
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.services.backup.backup_service import (
    MANIFEST_SCHEMA_VERSION,
    BackupService,
    backup_service,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _upload_pdf(client: TestClient, pdf_bytes: bytes, name: str = "receipt.pdf") -> str:
    """Upload a PDF and return its document_id."""
    res = client.post(
        "/api/v1/documents/upload",
        files={"file": (name, pdf_bytes, "application/pdf")},
    )
    assert res.status_code == 200, res.text
    return res.json()["document_id"]


def _confirm(client: TestClient, doc_id: str, merchant: str = "Test Merchant") -> str:
    """Confirm a receipt and return the transaction id."""
    res = client.post(
        "/api/v1/receipts/confirm",
        json={
            "document_id": doc_id,
            "merchant": merchant,
            "transaction_date": "2026-01-15",
            "total": "99.99",
            "currency": "USD",
            "category": "Other",
        },
    )
    assert res.status_code == 200, res.text
    return res.json()["id"]


def _do_backup(client: TestClient) -> bytes:
    """Trigger the backup endpoint and return raw ZIP bytes."""
    res = client.get("/api/v1/settings/export-backup")
    assert res.status_code == 200, res.text
    assert res.headers["content-type"] == "application/zip"
    assert "Content-Disposition" in res.headers
    assert res.headers["Content-Disposition"].startswith('attachment; filename="localledger_backup_')
    return res.content


# ---------------------------------------------------------------------------
# Test 1: Empty vault backup
# ---------------------------------------------------------------------------

def test_backup_empty_vault(client):
    """Backup with no documents should produce a valid ZIP with an empty assets list."""
    zip_bytes = _do_backup(client)

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        names = zf.namelist()
        # Must always include at least manifest + database
        manifest_candidates = [n for n in names if n.endswith("/manifest.json")]
        db_candidates = [n for n in names if n.endswith("/localledger.db")]
        assert len(manifest_candidates) == 1, "Expected exactly one manifest.json"
        assert len(db_candidates) == 1, "Expected exactly one localledger.db"

        manifest = json.loads(zf.read(manifest_candidates[0]))

    assert manifest["schema_version"] == MANIFEST_SCHEMA_VERSION
    assert manifest["document_count"] == 0
    assert manifest["asset_count"] == 0
    assert manifest["assets"] == []
    assert manifest["missing_asset_count"] == 0


# ---------------------------------------------------------------------------
# Test 2: Export with confirmed documents
# ---------------------------------------------------------------------------

def test_backup_with_confirmed_document(client, sample_pdf_bytes):
    """Confirmed documents must be in the backup with transaction_id populated."""
    doc_id = _upload_pdf(client, sample_pdf_bytes)
    tx_id = _confirm(client, doc_id)

    zip_bytes = _do_backup(client)

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        names = zf.namelist()
        manifest_name = next(n for n in names if n.endswith("/manifest.json"))
        manifest = json.loads(zf.read(manifest_name))

    assert manifest["asset_count"] == 1
    asset = manifest["assets"][0]
    assert asset["document_id"] == doc_id
    assert asset["transaction_id"] == tx_id  # confirmed -> linked
    assert asset["processing_status"] == "confirmed"

    # Verify asset hash matches stored hash
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        asset_bytes = zf.read(asset["zip_path"])
    assert _sha256(asset_bytes) == asset["sha256_actual"]
    assert asset["sha256_actual"] == asset["sha256_recorded"]


# ---------------------------------------------------------------------------
# Test 3: Export with unconfirmed documents
# ---------------------------------------------------------------------------

def test_backup_with_unconfirmed_document(client, sample_pdf_bytes):
    """Unconfirmed documents (transaction_id=null) must also appear in the backup."""
    doc_id = _upload_pdf(client, sample_pdf_bytes)
    # Do NOT confirm — leave unlinked

    zip_bytes = _do_backup(client)

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        manifest_name = next(n for n in zf.namelist() if n.endswith("/manifest.json"))
        manifest = json.loads(zf.read(manifest_name))

    assert manifest["asset_count"] == 1
    asset = manifest["assets"][0]
    assert asset["document_id"] == doc_id
    assert asset["transaction_id"] is None   # NOT confirmed
    assert asset["processing_status"] in ("extracted", "error", "pending")


# ---------------------------------------------------------------------------
# Test 4: Duplicate file content — idempotent dedup
# ---------------------------------------------------------------------------

def test_duplicate_upload_is_idempotent(client, sample_pdf_bytes):
    """
    Uploading the same file twice must return the SAME document_id both times,
    not create two separate Document rows. The backup must therefore contain
    only ONE asset entry for that content.
    """
    res1 = client.post(
        "/api/v1/documents/upload",
        files={"file": ("invoice.pdf", sample_pdf_bytes, "application/pdf")},
    )
    assert res1.status_code == 200
    doc_id_1 = res1.json()["document_id"]
    assert res1.json()["is_duplicate"] is False

    res2 = client.post(
        "/api/v1/documents/upload",
        files={"file": ("invoice_copy.pdf", sample_pdf_bytes, "application/pdf")},
    )
    assert res2.status_code == 200
    doc_id_2 = res2.json()["document_id"]
    assert res2.json()["is_duplicate"] is True
    assert doc_id_1 == doc_id_2  # same record returned

    zip_bytes = _do_backup(client)
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        manifest_name = next(n for n in zf.namelist() if n.endswith("/manifest.json"))
        manifest = json.loads(zf.read(manifest_name))

    # Only ONE asset despite two uploads
    assert manifest["document_count"] == 1
    assert manifest["asset_count"] == 1


# ---------------------------------------------------------------------------
# Test 5: Export when an asset file is missing from disk
# ---------------------------------------------------------------------------

def test_backup_fails_when_asset_missing(client, sample_pdf_bytes):
    """
    If a document record exists but its file is gone from disk, the backup
    endpoint must return HTTP 500 (BackupIntegrityError) rather than silently
    producing an incomplete archive.
    """
    doc_id = _upload_pdf(client, sample_pdf_bytes)

    # Simulate missing asset: delete every uploaded file from disk
    upload_dir = settings.resolved_upload_dir
    for f in upload_dir.iterdir():
        if f.is_file() and f.suffix in (".pdf", ".png", ".jpg", ".jpeg", ".webp"):
            f.unlink()

    res = client.get("/api/v1/settings/export-backup")
    assert res.status_code == 500
    err = res.json()
    assert err["error"]["code"] == "BACKUP_INTEGRITY_ERROR"
    assert "missing" in err["error"]["message"].lower()


# ---------------------------------------------------------------------------
# Test 6: ZIP contents verification (hashes, structure)
# ---------------------------------------------------------------------------

def test_backup_zip_structure_and_hashes(client, sample_pdf_bytes):
    """Every entry listed in the manifest must exist in the ZIP with matching hashes."""
    _upload_pdf(client, sample_pdf_bytes, "receipt_a.pdf")
    zip_bytes = _do_backup(client)

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        names = set(zf.namelist())
        manifest_name = next(n for n in names if n.endswith("/manifest.json"))
        manifest = json.loads(zf.read(manifest_name))

        # Database entry
        db_path = manifest["database"]["path"]
        assert db_path in names, "Database must be present in ZIP"
        db_hash = _sha256(zf.read(db_path))
        assert db_hash == manifest["database"]["sha256"], "Database hash mismatch"

        # Every asset
        for asset in manifest["assets"]:
            zip_path = asset["zip_path"]
            assert zip_path in names, f"Asset missing: {zip_path}"
            actual = _sha256(zf.read(zip_path))
            assert actual == asset["sha256_actual"], f"Hash mismatch for {zip_path}"

    # X-Archive-Filename header present
    res2 = client.get("/api/v1/settings/export-backup")
    assert "X-Archive-Filename" in res2.headers
    assert res2.headers["X-Archive-Filename"].endswith(".zip")


# ---------------------------------------------------------------------------
# Test 7: Restore verification - valid archive round-trip
# ---------------------------------------------------------------------------

def test_restore_verify_valid_archive(client, sample_pdf_bytes):
    """verify_restore_archive must pass for an archive we just generated."""
    _upload_pdf(client, sample_pdf_bytes)
    zip_bytes = _do_backup(client)

    manifest = backup_service.verify_restore_archive(zip_bytes)
    assert manifest["schema_version"] == MANIFEST_SCHEMA_VERSION
    assert manifest["asset_count"] == 1


# ---------------------------------------------------------------------------
# Test 8: Restore verification - corrupted archive
# ---------------------------------------------------------------------------

def test_restore_verify_corrupted_archive():
    """verify_restore_archive must raise RestoreVerificationError for garbage bytes."""
    from app.core.errors import RestoreVerificationError

    with pytest.raises(RestoreVerificationError, match="valid ZIP"):
        backup_service.verify_restore_archive(b"this is not a zip file at all")


# ---------------------------------------------------------------------------
# Test 9: Restore verification - wrong schema version
# ---------------------------------------------------------------------------

def test_restore_verify_wrong_schema_version():
    """verify_restore_archive must reject an archive with an incompatible schema."""
    from app.core.errors import RestoreVerificationError

    # Build a minimal ZIP with a bad schema version in the manifest
    buf = io.BytesIO()
    prefix = "localledger_backup_20260101_000000"
    bad_manifest = {
        "schema_version": "99.99",
        "database": {"path": f"{prefix}/database/localledger.db", "sha256": "abc"},
        "assets": [],
    }
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(
            f"{prefix}/manifest.json",
            json.dumps(bad_manifest),
        )
    with pytest.raises(RestoreVerificationError, match="schema version"):
        backup_service.verify_restore_archive(buf.getvalue())


# ---------------------------------------------------------------------------
# Test 10: Existing transactions unchanged after export
# ---------------------------------------------------------------------------

def test_existing_transactions_unchanged_after_backup(client, sample_pdf_bytes):
    """
    Generating a backup must not mutate any transaction or document records.
    """
    doc_id = _upload_pdf(client, sample_pdf_bytes)
    tx_id = _confirm(client, doc_id, merchant="Vendor ABC")

    # Record state before backup
    before = client.get(f"/api/v1/transactions/{tx_id}").json()

    # Run backup
    _do_backup(client)

    # State must be identical after backup
    after = client.get(f"/api/v1/transactions/{tx_id}").json()
    assert before == after


# ---------------------------------------------------------------------------
# Test 11: Document-transaction link integrity
# ---------------------------------------------------------------------------

def test_confirm_links_document_to_transaction(client, sample_pdf_bytes):
    """
    After confirming a receipt, the Document record must have its transaction_id
    set to the newly created Transaction's id.
    """
    doc_id = _upload_pdf(client, sample_pdf_bytes)

    # Before confirm: transaction_id should be null
    res_before = client.get(f"/api/v1/documents/{doc_id}/review")
    assert res_before.status_code == 200

    tx_id = _confirm(client, doc_id)

    # Verify via backup manifest that the link is in the DB
    zip_bytes = _do_backup(client)
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        manifest_name = next(n for n in zf.namelist() if n.endswith("/manifest.json"))
        manifest = json.loads(zf.read(manifest_name))

    assets = {a["document_id"]: a for a in manifest["assets"]}
    assert doc_id in assets
    assert assets[doc_id]["transaction_id"] == tx_id


# ---------------------------------------------------------------------------
# Test 12: Restore into separate staging directory & verify DB integrity
# ---------------------------------------------------------------------------

def test_restore_to_staging_directory(client, sample_pdf_bytes, tmp_path):
    """
    restore_archive_to_staging must safely extract DB and assets into a separate
    directory, verify DB integrity on disk, verify asset hashes on disk,
    and never mutate or overwrite the live data.
    """
    doc_id = _upload_pdf(client, sample_pdf_bytes, "invoice_test.pdf")
    tx_id = _confirm(client, doc_id, merchant="Staging Merchant")

    zip_bytes = _do_backup(client)

    staging_dir = tmp_path / "staging_restore"
    manifest, restored_dir = backup_service.restore_archive_to_staging(
        zip_bytes, staging_dir=staging_dir
    )

    assert restored_dir == staging_dir
    assert manifest["schema_version"] == MANIFEST_SCHEMA_VERSION
    assert manifest["asset_count"] == 1

    # Verify extracted database file exists on disk and is readable
    restored_db_path = restored_dir / "database" / "localledger.db"
    assert restored_db_path.is_file()

    conn = sqlite3.connect(str(restored_db_path))
    try:
        # PRAGMA integrity_check
        row = conn.execute("PRAGMA integrity_check").fetchone()
        assert row[0] == "ok"

        # Verify transaction record exists in restored DB
        tx_row = conn.execute(
            "SELECT id, merchant FROM transactions WHERE id = ?", (tx_id,)
        ).fetchone()
        assert tx_row is not None
        assert tx_row[1] == "Staging Merchant"

        # Verify document record in restored DB has transaction_id linked
        doc_row = conn.execute(
            "SELECT id, transaction_id, processing_status FROM documents WHERE id = ?",
            (doc_id,),
        ).fetchone()
        assert doc_row is not None
        assert doc_row[1] == tx_id
        assert doc_row[2] == "confirmed"
    finally:
        conn.close()

    # Verify extracted asset file exists on disk with matching content
    for asset in manifest["assets"]:
        asset_file = restored_dir / "assets" / asset["storage_filename"]
        assert asset_file.is_file()
        assert _sha256(asset_file.read_bytes()) == asset["sha256_actual"]


# ---------------------------------------------------------------------------
# Test 13: Restore staging rejects path traversal attempts (Zip Slip)
# ---------------------------------------------------------------------------

def test_restore_staging_rejects_path_traversal(tmp_path):
    """Archives with traversal paths like ../evil.txt must be rejected."""
    from app.core.errors import RestoreVerificationError

    prefix = "localledger_backup_20260101_000000"
    buf = io.BytesIO()

    # Create dummy valid db bytes
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_db:
        db_path = tmp_db.name
    try:
        conn = sqlite3.connect(db_path)
        conn.execute("CREATE TABLE t (id INT)")
        conn.close()
        db_bytes = Path(db_path).read_bytes()
    finally:
        os.unlink(db_path)

    db_hash = _sha256(db_bytes)
    manifest = {
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "archive_prefix": prefix,
        "database": {"path": f"{prefix}/database/localledger.db", "sha256": db_hash},
        "assets": [],
    }

    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(f"{prefix}/manifest.json", json.dumps(manifest))
        zf.writestr(f"{prefix}/database/localledger.db", db_bytes)
        zf.writestr(f"{prefix}/../traversal.txt", b"malicious content")

    with pytest.raises(RestoreVerificationError, match="Unsafe path detected"):
        backup_service.restore_archive_to_staging(
            buf.getvalue(), staging_dir=tmp_path / "staging_malicious"
        )

