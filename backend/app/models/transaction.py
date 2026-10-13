import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    invoice_number: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Use Numeric(12, 2) for exact Decimal arithmetic
    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, index=True)

    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD", index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="Other", index=True)
    payment_method: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    document_content_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    review_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="reviewed", index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(UTC), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationship to Document
    documents = relationship("Document", back_populates="transaction", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_transactions_date_currency", "transaction_date", "currency"),
        Index("ix_transactions_category_date", "category", "transaction_date"),
    )
