import os
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
        self._binary_path: str | None = None
        self._init_tesseract()

    def _init_tesseract(self):
        candidates = []

        # 1. Check configured setting
        if settings.TESSERACT_CMD:
            candidates.append(Path(settings.TESSERACT_CMD))

        # 2. Check user Local Programs path (standard UB-Mannheim per-user install)
        candidates.append(Path.home() / "AppData" / "Local" / "Programs" / "Tesseract-OCR" / "tesseract.exe")

        # 3. Check standard 64-bit and 32-bit Program Files paths
        candidates.append(Path("C:/Program Files/Tesseract-OCR/tesseract.exe"))
        candidates.append(Path("C:/Program Files (x86)/Tesseract-OCR/tesseract.exe"))

        # 4. Check Scoop install locations
        candidates.append(Path.home() / "scoop" / "shims" / "tesseract.exe")
        candidates.append(Path.home() / "scoop" / "apps" / "tesseract" / "current" / "tesseract.exe")

        # 5. Check PATH
        which_path = shutil.which("tesseract")
        if which_path:
            candidates.append(Path(which_path))

        for candidate in candidates:
            if candidate and candidate.is_file():
                self._binary_path = str(candidate)
                pytesseract.pytesseract.tesseract_cmd = str(candidate)

                # Set TESSDATA_PREFIX if tessdata folder exists alongside the binary
                tessdata_dir = candidate.parent / "tessdata"
                if tessdata_dir.is_dir() and not os.environ.get("TESSDATA_PREFIX"):
                    os.environ["TESSDATA_PREFIX"] = str(tessdata_dir)

                try:
                    version = pytesseract.get_tesseract_version()
                    self._available = True
                    logger.info("Tesseract OCR initialized successfully (version: %s, binary: %s)", version, self._binary_path)
                    return
                except Exception as e:
                    logger.warning("Found candidate %s but failed to initialize: %s", candidate, str(e))

        self._available = False
        logger.info("Tesseract OCR binary not detected in candidate paths or system PATH.")

    def is_available(self) -> bool:
        if self._available is None:
            self._init_tesseract()
        return bool(self._available)

    def extract_text(self, image: Image.Image) -> str:
        """Run Tesseract OCR on a PIL Image preserving line breaks. Returns extracted text or empty string."""
        if not self.is_available():
            logger.info("Tesseract OCR is not installed or configured. Skipping image OCR.")
            return ""

        try:
            # Use PSM 4 (single column of variable text sizes, ideal for receipts)
            text_psm4 = pytesseract.image_to_string(image, config="--psm 4")
            
            # If PSM 4 gave sparse results, try PSM 6 (single uniform block)
            if len(text_psm4.strip()) < 100:
                text_psm6 = pytesseract.image_to_string(image, config="--psm 6")
                if len(text_psm6.strip()) > len(text_psm4.strip()):
                    text_psm4 = text_psm6

            # Preserve line breaks while stripping trailing blank lines
            cleaned_lines = [line.rstrip() for line in text_psm4.split("\n")]
            text = "\n".join(cleaned_lines).strip()

            preview = (text[:60] + "...") if len(text) > 60 else text
            sanitized_preview = " ".join(preview.split())
            logger.info(
                "OCR extraction complete: %d characters, %d lines (preview: '%s')",
                len(text),
                len(text.splitlines()),
                sanitized_preview,
            )
            return text
        except pytesseract.TesseractNotFoundError:
            self._available = False
            logger.warning("Tesseract binary not found during OCR execution.")
            return ""
        except Exception as e:
            logger.warning("OCR execution error: %s", str(e))
            return ""


ocr_service = OCRService()
