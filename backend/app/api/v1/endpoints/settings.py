from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.db.session import get_db
from app.models.document import Document
from app.models.transaction import Transaction
from app.schemas.settings import DeleteAllDataRequest, SystemStatusResponse
from app.services.ai.ollama_client import ollama_client
from app.services.backup.backup_service import backup_service
from app.services.ocr.ocr_service import ocr_service

router = APIRouter()


def _get_directory_size(path: Path) -> int:
    total = 0
    if path.is_dir():
        for entry in path.rglob("*"):
            if entry.is_file():
                total += entry.stat().st_size
    return total


@router.get("/status", response_model=SystemStatusResponse)
async def get_system_status(db: Session = Depends(get_db)):
    ollama_health = await ollama_client.check_health()
    total_tx = db.execute(select(func.count(Transaction.id))).scalar() or 0
    total_docs = db.execute(select(func.count(Document.id))).scalar() or 0
    storage_size = _get_directory_size(settings.resolved_upload_dir)

    return SystemStatusResponse(
        app_env=settings.APP_ENV,
        ollama_connected=ollama_health["connected"],
        ollama_model=settings.OLLAMA_MODEL,
        ollama_available_models=ollama_health["models"],
        ocr_engine_available=ocr_service.is_available(),
        ocr_engine_type="Tesseract OCR" if ocr_service.is_available() else "PyMuPDF Native Text",
        storage_directory=str(settings.resolved_upload_dir),
        database_path=str(settings.resolved_db_path),
        total_documents=total_docs,
        total_transactions=total_tx,
        storage_size_bytes=storage_size,
        max_upload_size_mb=settings.MAX_UPLOAD_SIZE_MB,
        max_pdf_pages=settings.MAX_PDF_PAGES,
    )


@router.post("/check-ollama")
async def trigger_ollama_check():
    health = await ollama_client.check_health()
    return health


@router.get("/export-backup")
def export_vault_backup(
    format: str | None = None,
    db: Session = Depends(get_db),
):
    """
    Export full vault backup as a verified ZIP archive containing:
    - SQLite database snapshot
    - All receipt and invoice assets
    - Machine-readable manifest.json with SHA-256 integrity hashes

    If format="json" is explicitly requested, returns legacy metadata JSON.
    """
    if format == "json":
        txs = db.execute(select(Transaction)).scalars().all()
        docs = db.execute(select(Document)).scalars().all()

        return {
            "export_date": datetime.now(UTC).isoformat(),
            "transactions": [
                {
                    "id": t.id,
                    "merchant": t.merchant,
                    "invoice_number": t.invoice_number,
                    "date": t.transaction_date.isoformat(),
                    "subtotal": str(t.subtotal),
                    "tax": str(t.tax),
                    "total": str(t.total),
                    "currency": t.currency,
                    "category": t.category,
                    "payment_method": t.payment_method,
                    "notes": t.notes,
                    "created_at": t.created_at.isoformat(),
                }
                for t in txs
            ],
            "documents": [
                {
                    "id": d.id,
                    "transaction_id": d.transaction_id,
                    "original_filename": d.original_filename,
                    "mime_type": d.mime_type,
                    "file_size": d.file_size,
                    "sha256_hash": d.sha256_hash,
                    "processing_status": d.processing_status,
                    "created_at": d.created_at.isoformat(),
                }
                for d in docs
            ],
        }

    zip_bytes, filename = backup_service.generate_zip_backup(db)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Archive-Filename": filename,
        },
    )


@router.post("/delete-all")
def delete_all_data(payload: DeleteAllDataRequest, db: Session = Depends(get_db)):
    if payload.confirm_text.strip() != "DELETE LOCAL DATA":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation string does not match 'DELETE LOCAL DATA'. Data deletion aborted.",
        )

    # 1. Clean uploaded files from disk
    upload_dir = settings.resolved_upload_dir
    if upload_dir.is_dir():
        for file_path in upload_dir.iterdir():
            if file_path.is_file() and file_path.name != ".gitkeep":
                try:
                    file_path.unlink()
                except Exception as e:
                    logger.warning("Could not delete file %s: %s", file_path, str(e))

    # 2. Delete database tables
    db.execute(delete(Document))
    db.execute(delete(Transaction))
    db.commit()

    return {"message": "All local documents and financial records have been permanently deleted."}
