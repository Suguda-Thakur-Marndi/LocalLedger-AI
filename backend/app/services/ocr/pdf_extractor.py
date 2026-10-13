import io

import fitz  # PyMuPDF
from PIL import Image

from app.core.config import settings
from app.core.errors import PageLimitExceededError
from app.core.logging import logger
from app.services.ocr.ocr_service import ocr_service


def extract_text_from_pdf(pdf_bytes: bytes) -> tuple[str, int]:
    """
    Extract text from a PDF document:
    1. Validate page count against MAX_PDF_PAGES.
    2. Extract embedded text first.
    3. If a page contains insufficient embedded text (< 20 chars), render page
       to pixmap locally and OCR with Tesseract if available.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_count = len(doc)

    if page_count > settings.MAX_PDF_PAGES:
        raise PageLimitExceededError(
            f"PDF exceeds page limit ({page_count} pages > max {settings.MAX_PDF_PAGES})"
        )

    extracted_pages = []

    for page_idx in range(page_count):
        page = doc[page_idx]
        embedded_text = page.get_text("text").strip()

        # If substantial text exists, use it
        if len(embedded_text) >= 20:
            extracted_pages.append(embedded_text)
            continue

        # If text is sparse and OCR is available, render page to pixmap
        if ocr_service.is_available():
            try:
                pix = page.get_pixmap(dpi=200)
                img = Image.open(io.BytesIO(pix.tobytes("png")))
                scanned_text = ocr_service.extract_text(img)
                if scanned_text:
                    extracted_pages.append(scanned_text)
                    continue
            except Exception as e:
                logger.warning("Failed to render and OCR PDF page %d: %s", page_idx, str(e))

        # Fallback to whatever embedded text was found
        extracted_pages.append(embedded_text)

    combined_text = "\n\n".join(extracted_pages).strip()
    return combined_text, page_count
