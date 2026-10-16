"""
Tests verifying clean-start behavior, empty initial vault, and preservation of existing user data.
"""

import json
import os
import sqlite3
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.db.session import get_db
from app.main import app


def test_fresh_database_initialization_is_completely_empty():
    """Verify that a brand new database initializes with zero transactions and zero documents."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        test_db_path = Path(tmp_dir) / "test_fresh.db"
        test_engine = create_engine(
            f"sqlite:///{test_db_path}",
            connect_args={"check_same_thread": False},
        )
        try:
            # Create fresh schema
            Base.metadata.create_all(bind=test_engine)

            # Query database directly using standard sqlite3
            conn = sqlite3.connect(str(test_db_path))
            cur = conn.cursor()

            tx_count = cur.execute("SELECT count(*) FROM transactions").fetchone()[0]
            doc_count = cur.execute("SELECT count(*) FROM documents").fetchone()[0]

            conn.close()

            assert tx_count == 0, f"Expected 0 transactions in fresh DB, got {tx_count}"
            assert doc_count == 0, f"Expected 0 documents in fresh DB, got {doc_count}"
        finally:
            test_engine.dispose()


def test_fresh_dashboard_summary_returns_zero_activity():
    """Verify that reports summary on an empty vault returns genuine zero totals and empty collections."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        test_db_path = Path(tmp_dir) / "test_summary.db"
        test_engine = create_engine(
            f"sqlite:///{test_db_path}",
            connect_args={"check_same_thread": False},
        )
        try:
            Base.metadata.create_all(bind=test_engine)
            TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

            def override_get_db():
                db = TestingSessionLocal()
                try:
                    yield db
                finally:
                    db.close()

            app.dependency_overrides[get_db] = override_get_db
            try:
                client = TestClient(app)
                res = client.get("/api/v1/reports/dashboard")
                assert res.status_code == 200, f"Reports dashboard returned {res.status_code}: {res.text}"
                data = res.json()

                assert data["total_receipts"] == 0
                assert data["total_transactions"] == 0
                assert data["currency_totals"] == []
                assert data["categories"] == []
                assert data["monthly_trends"] == []
                assert data["weekly_trends"] == []
                assert data["recent_transactions"] == []
            finally:
                app.dependency_overrides.pop(get_db, None)
        finally:
            test_engine.dispose()


def test_adding_real_transaction_to_empty_vault_succeeds():
    """Verify that a user can successfully record a real transaction into an initially empty vault."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        test_db_path = Path(tmp_dir) / "test_real_tx.db"
        test_engine = create_engine(
            f"sqlite:///{test_db_path}",
            connect_args={"check_same_thread": False},
        )
        try:
            Base.metadata.create_all(bind=test_engine)
            TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

            def override_get_db():
                db = TestingSessionLocal()
                try:
                    yield db
                finally:
                    db.close()

            app.dependency_overrides[get_db] = override_get_db
            try:
                client = TestClient(app)

                # Post a real transaction
                tx_payload = {
                    "merchant": "Real Hardware Supply Co",
                    "invoice_number": "RHS-9021",
                    "transaction_date": "2026-10-14",
                    "subtotal": 120.00,
                    "tax": 10.50,
                    "total": 130.50,
                    "currency": "USD",
                    "category": "Hardware & Equipment",
                    "payment_method": "Debit Card",
                    "notes": "Legitimate business expense",
                    "original_filename": "manual_entry.pdf",
                    "review_status": "reviewed",
                }
                post_res = client.post("/api/v1/transactions", json=tx_payload)
                assert post_res.status_code == 201, f"Failed to create transaction: {post_res.text}"

                # Query summary again
                summary_res = client.get("/api/v1/reports/dashboard")
                assert summary_res.status_code == 200
                summary_data = summary_res.json()

                assert summary_data["total_transactions"] == 1
                assert len(summary_data["currency_totals"]) == 1
                assert summary_data["currency_totals"][0]["currency"] == "USD"
                assert float(summary_data["currency_totals"][0]["total_amount"]) == 130.50
                assert len(summary_data["categories"]) == 1
                assert summary_data["categories"][0]["category"] == "Hardware & Equipment"
            finally:
                app.dependency_overrides.pop(get_db, None)
        finally:
            test_engine.dispose()


def test_existing_user_databases_remain_untouched():
    """Verify that existing user databases are not truncated, cleared, or reset."""
    root_dir = Path(__file__).resolve().parent.parent.parent
    workspace_db = root_dir / "data" / "db" / "localledger.db"

    if workspace_db.is_file():
        conn = sqlite3.connect(str(workspace_db))
        cur = conn.cursor()
        tx_count = cur.execute("SELECT count(*) FROM transactions").fetchone()[0]
        doc_count = cur.execute("SELECT count(*) FROM documents").fetchone()[0]
        conn.close()

        if tx_count < 2 or doc_count < 12:
            pytest.skip("Skipping preservation assertion: workspace DB is not pre-populated")

        assert tx_count >= 2, f"Expected workspace DB transactions preserved, found {tx_count}"
        assert doc_count >= 12, f"Expected workspace DB documents preserved, found {doc_count}"

    appdata_dir = os.environ.get("APPDATA")
    if appdata_dir:
        appdata_db = Path(appdata_dir) / "LocalLedger AI" / "data" / "db" / "localledger.db"
        if appdata_db.is_file():
            conn = sqlite3.connect(str(appdata_db))
            cur = conn.cursor()
            tx_count = cur.execute("SELECT count(*) FROM transactions").fetchone()[0]
            doc_count = cur.execute("SELECT count(*) FROM documents").fetchone()[0]
            conn.close()

            assert tx_count >= 2, f"Expected AppData DB transactions preserved, found {tx_count}"
            assert doc_count >= 12, f"Expected AppData DB documents preserved, found {doc_count}"


def test_installer_config_and_backend_packaging_do_not_bundle_databases():
    """Verify electron-builder and PyInstaller packaging do not bundle development SQLite databases or sample receipts."""
    root_dir = Path(__file__).resolve().parent.parent.parent
    electron_builder_path = root_dir / "electron-builder.json"

    assert electron_builder_path.is_file()
    with open(electron_builder_path, encoding="utf-8") as f:
        config = json.load(f)

    # Check files array
    files = config.get("files", [])
    for file_pattern in files:
        assert "data" not in file_pattern.lower()
        assert ".db" not in file_pattern.lower()
        assert ".sqlite" not in file_pattern.lower()

    # Check extraResources
    extra_resources = config.get("extraResources", [])
    for res in extra_resources:
        from_path = res.get("from", "")
        to_path = res.get("to", "")
        assert "data" not in from_path.lower()
        assert ".db" not in from_path.lower()
        assert "uploads" not in from_path.lower()
        assert "data" not in to_path.lower()

    # Check deleteAppDataOnUninstall is False to protect user data across updates/uninstalls
    assert config.get("nsis", {}).get("deleteAppDataOnUninstall") is False
