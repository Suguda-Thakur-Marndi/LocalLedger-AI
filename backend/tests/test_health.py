def test_root_endpoint(client):
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "LocalLedger AI"
    assert "Your receipts. Your data. Your AI. Your computer." in data["tagline"]


def test_health_endpoint(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["database"] == "connected"
    assert "ocr_engine" in data
    assert "ollama" in data
