from app.core.config import settings


def test_upload_valid_pdf(client, sample_pdf_bytes):
    files = {"file": ("test_receipt.pdf", sample_pdf_bytes, "application/pdf")}
    res = client.post("/api/v1/documents/upload", files=files)
    assert res.status_code == 200
    data = res.json()
    assert "document_id" in data
    assert data["original_filename"] == "test_receipt.pdf"
    assert data["mime_type"] == "application/pdf"
    assert data["file_size"] == len(sample_pdf_bytes)
    assert len(data["sha256_hash"]) == 64
    assert data["is_duplicate"] is False


def test_upload_valid_image(client, sample_image_bytes):
    files = {"file": ("receipt.png", sample_image_bytes, "image/png")}
    res = client.post("/api/v1/documents/upload", files=files)
    assert res.status_code == 200
    data = res.json()
    assert "document_id" in data
    assert data["mime_type"] == "image/png"


def test_upload_invalid_signature_rejected(client):
    fake_content = b"This is just a plain text file pretending to be important."
    files = {"file": ("malicious.pdf", fake_content, "application/pdf")}
    res = client.post("/api/v1/documents/upload", files=files)
    assert res.status_code == 415
    assert res.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"


def test_upload_file_too_large(client, monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_MB", 1)  # 1 MB
    huge_content = b"%PDF-" + b"0" * (2 * 1024 * 1024)  # 2 MB
    files = {"file": ("huge.pdf", huge_content, "application/pdf")}
    res = client.post("/api/v1/documents/upload", files=files)
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "FILE_TOO_LARGE"


def test_get_document_file(client, sample_pdf_bytes):
    files = {"file": ("receipt_download.pdf", sample_pdf_bytes, "application/pdf")}
    upload_res = client.post("/api/v1/documents/upload", files=files)
    doc_id = upload_res.json()["document_id"]

    file_res = client.get(f"/api/v1/documents/{doc_id}/file")
    assert file_res.status_code == 200
    assert file_res.headers["content-type"] == "application/pdf"
    assert len(file_res.content) == len(sample_pdf_bytes)
