"""
LocalLedger AI - Desktop Icon Generator

Renders favicon.svg into build/icon.ico (multi-resolution Windows icon)
and build/icon.png (high-resolution application icon) using PyMuPDF and Pillow.
"""

from pathlib import Path
import fitz  # PyMuPDF
from PIL import Image
import io

ROOT_DIR = Path(__file__).resolve().parent.parent
FAVICON_SVG = ROOT_DIR / "frontend" / "public" / "favicon.svg"
BUILD_DIR = ROOT_DIR / "build"
BUILD_DIR.mkdir(parents=True, exist_ok=True)

ICON_ICO = BUILD_DIR / "icon.ico"
ICON_PNG = BUILD_DIR / "icon.png"


def generate_icons():
    print(f"Reading SVG from: {FAVICON_SVG}")
    svg_data = FAVICON_SVG.read_bytes()

    # Open SVG using PyMuPDF vector renderer at 8x scale for crisp 512x512 resolution
    doc = fitz.open(stream=svg_data, filetype="svg")
    page = doc[0]
    pixmap = page.get_pixmap(dpi=384, alpha=True)
    png_bytes = pixmap.tobytes(output="png")

    # Load into Pillow
    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    
    # Save 512x512 master PNG
    img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
    img_512.save(ICON_PNG, format="PNG")
    print(f"Saved master PNG icon to: {ICON_PNG}")

    # Generate multi-resolution Windows ICO (256, 128, 64, 48, 32, 16)
    img_256 = img.resize((256, 256), Image.Resampling.LANCZOS)
    sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    img_256.save(
        ICON_ICO,
        format="ICO",
        sizes=sizes,
    )
    print(f"Saved Windows multi-resolution icon to: {ICON_ICO}")


if __name__ == "__main__":
    generate_icons()
