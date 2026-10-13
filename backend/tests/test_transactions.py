def test_transaction_crud_flow(client, sample_pdf_bytes):
    # 1. Upload receipt
    files = {"file": ("office_supplies.pdf", sample_pdf_bytes, "application/pdf")}
    upload_res = client.post("/api/v1/documents/upload", files=files)
    assert upload_res.status_code == 200
    doc_id = upload_res.json()["document_id"]

    # 2. Review document
    review_res = client.get(f"/api/v1/documents/{doc_id}/review")
    assert review_res.status_code == 200
    review_data = review_res.json()
    assert "extracted" in review_data
    assert "suggestions" in review_data

    # 3. Confirm and save receipt
    confirm_payload = {
        "document_id": doc_id,
        "merchant": "ACME Coffee",
        "invoice_number": "INV-8821",
        "transaction_date": "2026-03-15",
        "subtotal": 20.00,
        "tax": 1.60,
        "total": 21.60,
        "currency": "USD",
        "category": "Meals & Entertainment",
        "payment_method": "Visa",
        "notes": "Client meeting coffee",
    }
    confirm_res = client.post("/api/v1/receipts/confirm", json=confirm_payload)
    assert confirm_res.status_code == 200
    tx = confirm_res.json()
    tx_id = tx["id"]
    assert tx["merchant"] == "ACME Coffee"
    assert tx["total"] == "21.60"
    assert tx["review_status"] == "reviewed"

    # 4. List transactions
    list_res = client.get("/api/v1/transactions")
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == tx_id

    # 5. Search transaction
    search_res = client.get("/api/v1/transactions?search=Coffee")
    assert search_res.status_code == 200
    assert len(search_res.json()["items"]) == 1

    search_empty = client.get("/api/v1/transactions?search=NonExistent")
    assert search_empty.status_code == 200
    assert len(search_empty.json()["items"]) == 0

    # 6. Update transaction
    update_payload = {"notes": "Updated meeting notes", "category": "Meals & Entertainment"}
    update_res = client.put(f"/api/v1/transactions/{tx_id}", json=update_payload)
    assert update_res.status_code == 200
    assert update_res.json()["notes"] == "Updated meeting notes"

    # 7. Delete transaction
    del_res = client.delete(f"/api/v1/transactions/{tx_id}")
    assert del_res.status_code == 204

    # Verify deleted
    get_res = client.get(f"/api/v1/transactions/{tx_id}")
    assert get_res.status_code == 404


def test_duplicate_upload_detection(client, sample_pdf_bytes):
    # Upload first time
    files1 = {"file": ("invoice.pdf", sample_pdf_bytes, "application/pdf")}
    res1 = client.post("/api/v1/documents/upload", files=files1)
    doc_id = res1.json()["document_id"]

    # Confirm first transaction
    client.post(
        "/api/v1/receipts/confirm",
        json={
            "document_id": doc_id,
            "merchant": "Original Merchant",
            "transaction_date": "2026-03-01",
            "total": 50.00,
            "currency": "USD",
            "category": "Other",
        },
    )

    # Upload exact same document again
    files2 = {"file": ("invoice_copy.pdf", sample_pdf_bytes, "application/pdf")}
    res2 = client.post("/api/v1/documents/upload", files=files2)
    assert res2.status_code == 200
    assert res2.json()["is_duplicate"] is True
    assert res2.json()["existing_transaction_id"] is not None
