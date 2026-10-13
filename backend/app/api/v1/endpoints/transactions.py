import os
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.core.security import resolve_safe_upload_path
from app.db.session import get_db
from app.models.document import Document
from app.schemas.transaction import (
    PaginatedTransactionsResponse,
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
)
from app.services.transactions.transaction_service import transaction_service

router = APIRouter()


@router.get("", response_model=PaginatedTransactionsResponse)
def list_transactions(
    search: str | None = Query(None),
    category: str | None = Query(None),
    currency: str | None = Query(None),
    review_status: str | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    sort_by: str = Query("transaction_date"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    items, total = transaction_service.list(
        db=db,
        search=search,
        category=category,
        currency=currency,
        review_status=review_status,
        start_date=start_date,
        end_date=end_date,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedTransactionsResponse(
        items=[TransactionResponse.model_validate(tx) for tx in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_manual_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
):
    tx = transaction_service.create(db, payload)
    return TransactionResponse.model_validate(tx)


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(transaction_id: str, db: Session = Depends(get_db)):
    tx = transaction_service.get_by_id(db, transaction_id)
    return TransactionResponse.model_validate(tx)


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
):
    tx = transaction_service.update(db, transaction_id, payload)
    return TransactionResponse.model_validate(tx)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: str, db: Session = Depends(get_db)):
    tx = transaction_service.get_by_id(db, transaction_id)

    # Find associated documents and clean up files from disk
    docs = db.execute(select(Document).where(Document.transaction_id == tx.id)).scalars().all()
    for doc in docs:
        try:
            file_path = resolve_safe_upload_path(doc.storage_filename)
            if file_path.is_file():
                os.remove(file_path)
        except Exception as e:
            logger.warning("Failed to remove document file on delete: %s", str(e))

    transaction_service.delete(db, transaction_id)
