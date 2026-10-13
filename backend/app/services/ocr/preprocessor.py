import io

from PIL import Image, ImageEnhance

from app.core.logging import logger


def preprocess_image_for_ocr(image_bytes: bytes) -> Image.Image:
    """
    Load and preprocess an image (PNG, JPEG, WebP) for optimal OCR quality:
    - Converts RGBA/P to RGB/Grayscale
    - Enhances contrast
    - Slightly sharpens
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        # Convert transparent or palette images
        if img.mode in ("RGBA", "P", "LA"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            background.paste(img, mask=img.split()[-1] if "A" in img.mode else None)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Convert to Grayscale
        gray = img.convert("L")

        # Enhance contrast
        enhancer = ImageEnhance.Contrast(gray)
        enhanced = enhancer.enhance(1.8)

        # Scale up if image resolution is very small (under 1000px wide)
        if enhanced.width < 1000:
            scale_factor = 2
            enhanced = enhanced.resize(
                (enhanced.width * scale_factor, enhanced.height * scale_factor),
                Image.Resampling.LANCZOS,
            )

        return enhanced
    except Exception as e:
        logger.warning("Image preprocessing failed, falling back to basic conversion: %s", str(e))
        # Fallback to basic open
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")
