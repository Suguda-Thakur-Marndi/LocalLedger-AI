import io
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

import pymupdf
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app

# In-memory SQLite engine for tests with static pool
TEST_SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment(tmp_path_factory):
    """Setup temporary uploads and data directory for the test run."""
    temp_dir = tmp_path_factory.mktemp("test_data")
    settings.DATA_DIR = str(temp_dir)
    settings.UPLOAD_DIR = str(temp_dir / "uploads")
    settings.DB_PATH = str(temp_dir / "test.db")
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)


@pytest.fixture(scope="function")
def db_session():
    """Fresh in-memory SQLite schema per test function."""
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session):
    """FastAPI TestClient with overridden get_db dependency."""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_pdf_bytes():
    """Create a synthetic PDF document in-memory using PyMuPDF."""
    doc = pymupdf.open()
    page = doc.new_page()
    text = (
        "ACME COFFEE ROASTERS\n"
        "Receipt #: INV-8821\n"
        "Date: 2026-03-15\n\n"
        "1x Espresso Roast Blend       $14.50\n"
        "1x Oat Milk Flat White         $5.50\n"
        "Subtotal: $20.00\n"
        "Tax (8%): $1.60\n"
        "Total: $21.60\n\n"
        "Payment Method: Visa\n"
        "Thank you for your visit!\n"
    )
    page.insert_text((50, 72), text, fontsize=12)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


@pytest.fixture
def sample_image_bytes():
    """Create a synthetic PNG receipt image in-memory using Pillow."""
    img = Image.new("RGB", (400, 300), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 20), "TechStore Online", fill=(0, 0, 0))
    draw.text((20, 50), "Total: $99.99", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
