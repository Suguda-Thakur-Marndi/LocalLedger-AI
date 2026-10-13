import shutil
from pathlib import Path

import pytesseract
from PIL import Image

from app.core.config import settings
from app.core.logging import logger


class OCRService:
    def __init__(self):
        self._configured = False
        self._available: bool | None = None
        self._init_tesseract()

    def _init_tesseract(self):
        # 1. Check configured setting
        if settings.TESSERACT_CMD and Path(settings.TESSERACT_CMD).is_file():
            pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
            self._available = True
            return

        # 2. Check standard Windows path
        win_default = Path("C:/Program Files/Tesseract-OCR/tesseract.exe")
        if win_default.is_file():
            pytesseract.pytesseract.tesseract_cmd = str(win_default)
            self._available = True
            return

        # 3. Check PATH
        which_path = shutil.which("tesseract")
        if which_path:
            pytesseract.pytesseract.tesseract_cmd = which_path
            self._available = True
            return

        self._available = False

    def is_available(self) -> bool:
        if self._available is None:
            self._init_tesseract()
        return bool(self._available)

    def extract_text(self, image: Image.Image) -> str:
        """Run Tesseract OCR on a PIL Image. Returns extracted text or empty string."""
        if not self.is_available():
            logger.info("Tesseract OCR is not installed or configured. Skipping image OCR.")
            return ""

        try:
            text = pytesseract.image_to_string(image, config="--psm 6")
            return text.strip()
        except pytesseract.TesseractNotFoundError:
            self._available = False
            logger.warning("Tesseract binary not found during OCR execution.")
            return ""
        except Exception as e:
            logger.warning("OCR execution error: %s", str(e))
            return ""


ocr_service = OCRService()
