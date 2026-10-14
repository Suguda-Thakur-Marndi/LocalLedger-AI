# LocalLedger AI — Vault Backup & Disaster Recovery Guide

## Overview

LocalLedger AI provides a **Vault Backup** feature that packages your financial records into a self-contained, cryptographically verified ZIP archive (`localledger_backup_YYYYMMDD_HHMMSS.zip`).

Each backup archive is a snapshot containing:
1. **Consistent SQLite Snapshot**: A verified backup of `localledger.db` taken via the SQLite Online Backup API.
2. **Original Receipt & Invoice Assets**: All raw receipt image files (`.png`, `.jpg`, `.jpeg`, `.webp`) and document files (`.pdf`), including unconfirmed documents (`transaction_id: null`).
3. **Machine-Readable Manifest (`manifest.json`)**: Versioned schema (`1.0`) metadata with export timestamps, database SHA-256 hash, asset inventory, document processing states, relative paths, and per-file SHA-256 digests.

---

## Safe Recovery Procedure

> [!CAUTION]
> **Never overwrite your live database or uploads folder directly.**
> Always restore and verify in an isolated staging location before promoting data to the live directories.

### Step 1: Pre-Restoration Verification

Before extracting or modifying any live state, validate the backup archive integrity:

```python
from pathlib import Path
from app.services.backup.backup_service import backup_service

archive_bytes = Path("localledger_backup_20261014_120000.zip").read_bytes()

# 1. Validates ZIP structure, manifest schema, DB hash, and all asset digests
manifest = backup_service.verify_restore_archive(archive_bytes)
print(f"Archive valid! Schema: {manifest['schema_version']}, Assets: {manifest['asset_count']}")
```

If any file is missing, any SHA-256 hash has drifted, or the database integrity check fails, `RestoreVerificationError` is raised and restoration is aborted immediately.

---

### Step 2: Extract to an Isolated Staging Location

Extract the archive into a separate temporary directory. The built-in `restore_archive_to_staging` function prevents Zip Slip path traversal and runs full integrity checks on the extracted files:

```python
# Extracts to an isolated temporary staging directory
manifest, staging_path = backup_service.restore_archive_to_staging(archive_bytes)
print(f"Staged at: {staging_path}")
```

Staging layout:
```text
<staging_directory>/
├── manifest.json
├── database/
│   └── localledger.db
└── assets/
    ├── <storage_filename_1>.jpg
    ├── <storage_filename_2>.pdf
    └── ...
```

---

### Step 3: Run Database Integrity and Foreign Key Checks

Inspect the staged database in read-only mode using the SQLite CLI or Python:

```bash
sqlite3 <staging_directory>/database/localledger.db "PRAGMA integrity_check;"
sqlite3 <staging_directory>/database/localledger.db "PRAGMA foreign_key_check;"
```

Both queries must return `ok` and empty output respectively, confirming zero corruption and zero broken relational references.

---

### Step 4: Compare Record Counts

Verify record counts match the manifest before replacing live data:

```bash
sqlite3 <staging_directory>/database/localledger.db "SELECT count(*) FROM transactions;"
sqlite3 <staging_directory>/database/localledger.db "SELECT count(*) FROM documents;"
```

---

### Step 5: Promote Staged Data to Live Directory

Once verification succeeds, stop the LocalLedger AI backend service, back up the previous live directory, and move the verified staging files into place:

```powershell
# 1. Stop backend service
# 2. Archive current live data as safety fallback
Move-Item -Path "data/db/localledger.db" -Destination "data/db/localledger.db.pre_restore_bak"
Move-Item -Path "data/uploads" -Destination "data/uploads_pre_restore_bak"

# 3. Move verified staging files into live directory
Copy-Item -Path "<staging_directory>/database/localledger.db" -Destination "data/db/localledger.db"
Copy-Item -Path "<staging_directory>/assets" -Destination "data/uploads" -Recurse

# 4. Restart backend service
```

---

## Technical Safeguards

- **Path Traversal Protection**: Archive filenames and extract destinations are strictly sanitized; any entry with `..` or absolute paths is rejected.
- **Idempotent Upload Deduplication**: SHA-256 content hashes prevent duplicate document records from multiple uploads of identical receipt assets while preserving original records and transaction links.
- **Zero Credential Exposure**: `.env` files, API keys, and local configuration are strictly excluded from the backup archive.
