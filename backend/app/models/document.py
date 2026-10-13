import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=True, index=True
    )
    storage_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    processing_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending", index=True
    )  # pending, extracted, confirmed, failed

    ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_details: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(UTC), index=True
    )

    transaction = relationship("Transaction", back_populates="documents")

    __table_args__ = (
        Index("ix_documents_sha256", "sha256_hash"),
        Index("ix_documents_status_created", "processing_status", "created_at"),
    )
