def test_dashboard_and_reports(client):
    # Create USD transaction
    client.post(
        "/api/v1/transactions",
        json={
            "merchant": "US Vendor",
            "transaction_date": "2026-03-10",
            "total": 100.00,
            "currency": "USD",
            "category": "Office Supplies",
        },
    )

    # Create EUR transaction
    client.post(
        "/api/v1/transactions",
        json={
            "merchant": "EU Vendor",
            "transaction_date": "2026-03-12",
            "total": 50.00,
            "currency": "EUR",
            "category": "Software & Subscriptions",
        },
    )

    # Get Dashboard
    dash_res = client.get("/api/v1/reports/dashboard")
    assert dash_res.status_code == 200
    data = dash_res.json()

    assert data["total_transactions"] == 2
    # Verify currencies are separate
    currencies = {c["currency"]: c["total_amount"] for c in data["currency_totals"]}
    assert currencies["USD"] == "100.00"
    assert currencies["EUR"] == "50.00"

    # CSV Export
    csv_res = client.get("/api/v1/reports/export")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    csv_text = csv_res.text
    assert "US Vendor" in csv_text
    assert "EU Vendor" in csv_text
    assert "Office Supplies" in csv_text
