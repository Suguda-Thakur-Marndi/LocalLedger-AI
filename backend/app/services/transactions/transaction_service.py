from datetime import date

from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.models.document import Document
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionUpdate


class TransactionService:
    @staticmethod
    def get_by_id(db: Session, transaction_id: str) -> Transaction:
        tx = db.execute(
            select(Transaction).where(Transaction.id == transaction_id)
        ).scalar_one_or_none()
        if not tx:
            raise NotFoundError(f"Transaction with id '{transaction_id}' not found.")
        return tx

    @staticmethod
    def check_duplicate_hash(db: Session, sha256_hash: str) -> Transaction | None:
        """Check if a transaction with the same document content hash already exists."""
        return (
            db.execute(select(Transaction).where(Transaction.document_content_hash == sha256_hash))
            .scalars()
            .first()
        )

    @staticmethod
    def create(db: Session, data: TransactionCreate) -> Transaction:
        tx = Transaction(
            merchant=data.merchant,
            invoice_number=data.invoice_number,
            transaction_date=data.transaction_date,
            subtotal=data.subtotal,
            tax=data.tax,
            total=data.total,
            currency=data.currency,
            category=data.category,
            payment_method=data.payment_method,
            notes=data.notes,
            original_filename=data.original_filename,
            document_content_hash=data.document_content_hash,
            review_status=data.review_status,
        )
        db.add(tx)
        db.flush()

        # Link document if provided
        if data.document_id:
            doc = db.execute(
                select(Document).where(Document.id == data.document_id)
            ).scalar_one_or_none()
            if doc:
                doc.transaction_id = tx.id
                doc.processing_status = "confirmed"

        db.commit()
        db.refresh(tx)
        return tx

    @staticmethod
    def update(db: Session, transaction_id: str, data: TransactionUpdate) -> Transaction:
        tx = TransactionService.get_by_id(db, transaction_id)
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(tx, field, value)
        db.commit()
        db.refresh(tx)
        return tx

    @staticmethod
    def delete(db: Session, transaction_id: str) -> None:
        tx = TransactionService.get_by_id(db, transaction_id)
        db.delete(tx)
        db.commit()

    @staticmethod
    def list(
        db: Session,
        search: str | None = None,
        category: str | None = None,
        currency: str | None = None,
        review_status: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        sort_by: str = "transaction_date",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Transaction], int]:
        stmt = select(Transaction)

        if search:
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Transaction.merchant.ilike(term),
                    Transaction.invoice_number.ilike(term),
                    Transaction.notes.ilike(term),
                    Transaction.original_filename.ilike(term),
                )
            )

        if category:
            stmt = stmt.where(Transaction.category == category)

        if currency:
            stmt = stmt.where(Transaction.currency == currency.upper())

        if review_status:
            stmt = stmt.where(Transaction.review_status == review_status)

        if start_date:
            stmt = stmt.where(Transaction.transaction_date >= start_date)

        if end_date:
            stmt = stmt.where(Transaction.transaction_date <= end_date)

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.execute(count_stmt).scalar() or 0

        # Sorting
        sort_column = getattr(Transaction, sort_by, Transaction.transaction_date)
        if sort_order.lower() == "asc":
            stmt = stmt.order_by(asc(sort_column))
        else:
            stmt = stmt.order_by(desc(sort_column))

        # Pagination
        offset = (page - 1) * page_size
        stmt = stmt.offset(offset).limit(page_size)

        items = list(db.execute(stmt).scalars().all())
        return items, total


transaction_service = TransactionService()
