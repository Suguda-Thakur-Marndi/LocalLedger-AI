import fitz
import pytest

from app.core.config import settings
from app.core.errors import PageLimitExceededError
from app.services.ocr.ocr_service import ocr_service
from app.services.ocr.pdf_extractor import extract_text_from_pdf


def test_pdf_embedded_text_extraction(sample_pdf_bytes):
    text, page_count = extract_text_from_pdf(sample_pdf_bytes)
    assert page_count == 1
    assert "ACME COFFEE ROASTERS" in text
    assert "INV-8821" in text
    assert "Total: $21.60" in text


def test_pdf_page_limit_enforcement(monkeypatch):
    monkeypatch.setattr(settings, "MAX_PDF_PAGES", 2)
    doc = fitz.open()
    for _ in range(3):
        p = doc.new_page()
        p.insert_text((50, 50), "Sample page text")
    bytes_data = doc.tobytes()
    doc.close()

    with pytest.raises(PageLimitExceededError):
        extract_text_from_pdf(bytes_data)


def test_ocr_service_graceful_missing_binary(monkeypatch):
    monkeypatch.setattr(ocr_service, "_available", False)
    assert ocr_service.is_available() is False
    from PIL import Image

    blank_img = Image.new("RGB", (100, 100), color="white")
    result = ocr_service.extract_text(blank_img)
    assert result == ""
