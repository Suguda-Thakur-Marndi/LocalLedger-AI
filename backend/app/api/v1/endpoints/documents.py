from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import (
    FileSizeLimitError,
    NotFoundError,
    UnsupportedFileTypeError,
)
from app.core.logging import logger
from app.core.security import (
    compute_sha256,
    generate_storage_filename,
    resolve_safe_upload_path,
    sanitize_filename,
)
from app.db.session import get_db
from app.models.document import Document
from app.models.transaction import Transaction
from app.schemas.document import DocumentUploadResponse
from app.schemas.receipt_review import ReceiptReviewPayload
from app.services.ai.extractor import extract_receipt_data
from app.services.ocr.ocr_service import ocr_service
from app.services.ocr.pdf_extractor import extract_text_from_pdf
from app.services.ocr.preprocessor import preprocess_image_for_ocr

router = APIRouter()

ALLOWED_MIMES = {
    "application/pdf": [b"%PDF-"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/webp": [b"RIFF"],
}


def _verify_file_signature(content: bytes, declared_mime: str) -> str:
    """Verify file magic bytes against allowed document formats."""
    # Check PDF
    if content.startswith(b"%PDF-"):
        return "application/pdf"
    # Check PNG
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    # Check JPEG
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    # Check WebP (RIFF + WEBP)
    if content.startswith(b"RIFF") and len(content) > 12 and content[8:12] == b"WEBP":
        return "image/webp"

    raise UnsupportedFileTypeError(
        f"Invalid or unsupported file signature for upload (declared mime: {declared_mime}). "
        "Only PDF, PNG, JPEG, and WebP files are supported."
    )


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content = await file.read()

    # 1. Enforce file size limit
    if len(content) > settings.max_upload_size_bytes:
        raise FileSizeLimitError(
            f"File size ({len(content)} bytes) exceeds the limit of {settings.MAX_UPLOAD_SIZE_MB}MB."
        )

    # 2. Verify file signature
    actual_mime = _verify_file_signature(content, file.content_type or "")

    # 3. Compute SHA-256 hash
    sha256_hash = compute_sha256(content)

    # 4. Check duplicate by SHA-256 hash (idempotent processing)
    existing_doc = (
        db.execute(
            select(Document)
            .where(Document.sha256_hash == sha256_hash)
            .order_by(
                Document.transaction_id.is_(None),  # Prioritize linked document
                Document.created_at.asc(),
            )
        )
        .scalars()
        .first()
    )

    existing_tx = (
        db.execute(select(Transaction).where(Transaction.document_content_hash == sha256_hash))
        .scalars()
        .first()
    )

    if existing_doc:
        # Idempotent response: return existing document without duplicating records or disk assets
        target_path = resolve_safe_upload_path(existing_doc.storage_filename)
        if not target_path.is_file():
            # If disk file was missing, restore it from current upload payload
            with open(target_path, "wb") as f:
                f.write(content)

        # If transaction was confirmed elsewhere, ensure document link is synced
        if not existing_doc.transaction_id and existing_tx:
            existing_doc.transaction_id = existing_tx.id
            existing_doc.processing_status = "confirmed"
            db.commit()
            db.refresh(existing_doc)

        existing_tx_id = existing_doc.transaction_id or (existing_tx.id if existing_tx else None)

        logger.info(
            "Idempotent duplicate upload detected: hash=%s, returning existing document_id=%s, linked_tx=%s",
            sha256_hash[:8],
            existing_doc.id,
            existing_tx_id,
        )

        return DocumentUploadResponse(
            document_id=existing_doc.id,
            original_filename=existing_doc.original_filename,
            mime_type=existing_doc.mime_type,
            file_size=existing_doc.file_size,
            sha256_hash=existing_doc.sha256_hash,
            processing_status=existing_doc.processing_status,
            is_duplicate=True,
            existing_transaction_id=existing_tx_id,
        )

    clean_filename = sanitize_filename(file.filename or "receipt")
    storage_name = generate_storage_filename(clean_filename)
    target_path = resolve_safe_upload_path(storage_name)

    logger.info(
        "Received file upload: name=%s, mime=%s, size=%d bytes, hash=%s, ocr_available=%s",
        clean_filename,
        actual_mime,
        len(content),
        sha256_hash[:8],
        ocr_service.is_available(),
    )

    # Save file to disk
    with open(target_path, "wb") as f:
        f.write(content)

    # 5. Extract text
    extracted_text = ""
    error_details = None
    try:
        if actual_mime == "application/pdf":
            extracted_text, _ = extract_text_from_pdf(content)
        else:
            preprocessed_img = preprocess_image_for_ocr(content)
            extracted_text = ocr_service.extract_text(preprocessed_img)
    except Exception as e:
        logger.warning("Text extraction exception: %s", str(e))
        error_details = f"Text extraction failed: {e!s}"

    if not extracted_text:
        if not ocr_service.is_available():
            error_details = "OCR engine is not installed or configured. Cannot extract text from image."
        elif not error_details:
            error_details = "OCR returned no legible text from this document."
        processing_status = "error"
        logger.warning(
            "Document '%s' produced empty OCR output (engine_available=%s): %s",
            clean_filename,
            ocr_service.is_available(),
            error_details,
        )
    else:
        processing_status = "confirmed" if existing_tx else "extracted"

    # 6. Create Document record
    doc = Document(
        transaction_id=existing_tx.id if existing_tx else None,
        storage_filename=storage_name,
        original_filename=clean_filename,
        mime_type=actual_mime,
        file_size=len(content),
        sha256_hash=sha256_hash,
        processing_status=processing_status,
        ocr_text=extracted_text,
        error_details=error_details,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return DocumentUploadResponse(
        document_id=doc.id,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        file_size=doc.file_size,
        sha256_hash=doc.sha256_hash,
        processing_status=doc.processing_status,
        is_duplicate=existing_tx is not None,
        existing_transaction_id=existing_tx.id if existing_tx else None,
    )


@router.get("/{document_id}/file")
async def get_document_file(document_id: str, db: Session = Depends(get_db)):
    doc = db.execute(select(Document).where(Document.id == document_id)).scalar_one_or_none()
    if not doc:
        raise NotFoundError(f"Document with ID '{document_id}' not found.")

    file_path = resolve_safe_upload_path(doc.storage_filename)
    if not file_path.is_file():
        raise NotFoundError("Stored document file was not found on local disk.")

    return FileResponse(
        path=str(file_path),
        media_type=doc.mime_type,
        filename=doc.original_filename,
    )


@router.get("/{document_id}/review", response_model=ReceiptReviewPayload)
async def get_document_for_review(document_id: str, db: Session = Depends(get_db)):
    doc = db.execute(select(Document).where(Document.id == document_id)).scalar_one_or_none()
    if not doc:
        raise NotFoundError(f"Document with ID '{document_id}' not found.")

    text = doc.ocr_text or ""

    # Self-heal / automatic OCR retry if document was stored with empty OCR text previously
    if not text.strip():
        file_path = resolve_safe_upload_path(doc.storage_filename)
        if file_path.is_file() and ocr_service.is_available():
            try:
                content = file_path.read_bytes()
                if doc.mime_type == "application/pdf":
                    re_text, _ = extract_text_from_pdf(content)
                else:
                    preprocessed_img = preprocess_image_for_ocr(content)
                    re_text = ocr_service.extract_text(preprocessed_img)

                if re_text.strip():
                    text = re_text
                    doc.ocr_text = text
                    doc.processing_status = "extracted"
                    doc.error_details = None
                    db.commit()
                    logger.info("Automatically extracted %d chars for previously pending document %s", len(text), doc.id)
            except Exception as e:
                logger.warning("Auto-retry OCR failed for document %s: %s", doc.id, str(e))

    extracted, suggestions, warnings, ollama_used, model_name = await extract_receipt_data(text)

    if doc.error_details and doc.error_details not in warnings:
        warnings.insert(0, doc.error_details)

    preview = text[:2000] if text else "No text extracted from document."

    return ReceiptReviewPayload(
        document_id=doc.id,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        processing_status=doc.processing_status,
        extracted=extracted,
        suggestions=suggestions,
        ocr_text_preview=preview,
        warnings=warnings,
        ollama_used=ollama_used,
        model_name=model_name,
    )


@router.post("/{document_id}/reextract", response_model=ReceiptReviewPayload)
async def reextract_document(document_id: str, db: Session = Depends(get_db)):
    """Explicitly re-run OCR and Ollama extraction on an existing uploaded document."""
    doc = db.execute(select(Document).where(Document.id == document_id)).scalar_one_or_none()
    if not doc:
        raise NotFoundError(f"Document with ID '{document_id}' not found.")

    file_path = resolve_safe_upload_path(doc.storage_filename)
    if not file_path.is_file():
        raise NotFoundError("Stored document file was not found on local disk.")

    content = file_path.read_bytes()
    extracted_text = ""
    error_details = None

    try:
        if doc.mime_type == "application/pdf":
            extracted_text, _ = extract_text_from_pdf(content)
        else:
            preprocessed_img = preprocess_image_for_ocr(content)
            extracted_text = ocr_service.extract_text(preprocessed_img)
    except Exception as e:
        logger.warning("Re-extraction exception for %s: %s", document_id, str(e))
        error_details = f"Text extraction failed: {e!s}"

    if not extracted_text:
        doc.processing_status = "error"
        doc.error_details = error_details or "OCR produced empty text."
    else:
        doc.ocr_text = extracted_text
        doc.processing_status = "extracted"
        doc.error_details = None

    db.commit()

    extracted, suggestions, warnings, ollama_used, model_name = await extract_receipt_data(extracted_text)
    if doc.error_details and doc.error_details not in warnings:
        warnings.insert(0, doc.error_details)

    preview = extracted_text[:2000] if extracted_text else "No text extracted from document."

    return ReceiptReviewPayload(
        document_id=doc.id,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        processing_status=doc.processing_status,
        extracted=extracted,
        suggestions=suggestions,
        ocr_text_preview=preview,
        warnings=warnings,
        ollama_used=ollama_used,
        model_name=model_name,
    )
