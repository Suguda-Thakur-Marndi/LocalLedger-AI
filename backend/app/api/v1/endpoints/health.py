from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.services.ai.ollama_client import ollama_client
from app.services.ocr.ocr_service import ocr_service

router = APIRouter()


@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    # Database check
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    # Ollama check
    ollama_health = await ollama_client.check_health()

    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "error",
        "ocr_engine": {
            "available": ocr_service.is_available(),
            "engine": "Tesseract OCR"
            if ocr_service.is_available()
            else "None (PyMuPDF embedded text only)",
        },
        "ollama": {
            "connected": ollama_health["connected"],
            "model_configured": settings.OLLAMA_MODEL,
            "model_present": ollama_health["model_present"],
            "available_models": ollama_health["models"],
        },
        "environment": settings.APP_ENV,
    }
