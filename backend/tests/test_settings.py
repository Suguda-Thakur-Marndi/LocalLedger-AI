def test_settings_endpoints(client):
    # Status
    status_res = client.get("/api/v1/settings/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert "storage_directory" in status_data
    assert "max_upload_size_mb" in status_data

    # Create dummy record
    client.post(
        "/api/v1/transactions",
        json={
            "merchant": "To Be Deleted",
            "transaction_date": "2026-01-01",
            "total": 15.00,
            "currency": "USD",
            "category": "Other",
        },
    )

    # Backup Export
    backup_res = client.get("/api/v1/settings/export-backup")
    assert backup_res.status_code == 200
    backup_data = backup_res.json()
    assert len(backup_data["transactions"]) == 1

    # Delete all with bad confirm text
    bad_delete = client.post("/api/v1/settings/delete-all", json={"confirm_text": "yes delete"})
    assert bad_delete.status_code == 400

    # Delete all with exact confirm text
    good_delete = client.post(
        "/api/v1/settings/delete-all", json={"confirm_text": "DELETE LOCAL DATA"}
    )
    assert good_delete.status_code == 200

    # Verify tables are empty
    list_after = client.get("/api/v1/transactions")
    assert list_after.json()["total"] == 0
