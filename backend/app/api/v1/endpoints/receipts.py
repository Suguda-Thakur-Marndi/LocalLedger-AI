from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.document import Document
from app.schemas.receipt_review import ConfirmReceiptRequest
from app.schemas.transaction import TransactionCreate, TransactionResponse
from app.services.transactions.transaction_service import transaction_service

router = APIRouter()


@router.post("/confirm", response_model=TransactionResponse)
def confirm_and_save_receipt(
    payload: ConfirmReceiptRequest,
    db: Session = Depends(get_db),
):
    """
    Save user-reviewed and verified receipt transaction data.
    Ensures manual user adjustments are strictly preserved and committed.
    """
    doc = db.execute(
        select(Document).where(Document.id == payload.document_id)
    ).scalar_one_or_none()
    if not doc:
        raise NotFoundError(f"Document with ID '{payload.document_id}' not found.")

    tx_create = TransactionCreate(
        document_id=doc.id,
        merchant=payload.merchant,
        invoice_number=payload.invoice_number,
        transaction_date=payload.transaction_date,
        subtotal=payload.subtotal,
        tax=payload.tax,
        total=payload.total,
        currency=payload.currency,
        category=payload.category,
        payment_method=payload.payment_method,
        notes=payload.notes,
        original_filename=doc.original_filename,
        document_content_hash=doc.sha256_hash,
        review_status="reviewed",
    )

    created_tx = transaction_service.create(db, tx_create)
    return TransactionResponse.model_validate(created_tx)
