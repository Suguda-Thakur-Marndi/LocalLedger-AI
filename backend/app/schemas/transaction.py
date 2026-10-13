from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TransactionBase(BaseModel):
    merchant: str = Field(..., min_length=1, max_length=255)
    invoice_number: str | None = Field(None, max_length=100)
    transaction_date: date
    subtotal: Decimal = Field(default=Decimal("0.00"), ge=0)
    tax: Decimal = Field(default=Decimal("0.00"), ge=0)
    total: Decimal = Field(..., ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    category: str = Field(default="Other", max_length=100)
    payment_method: str | None = Field(None, max_length=100)
    notes: str | None = None

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, v: str) -> str:
        return v.upper().strip()

    @field_validator("merchant", "category")
    @classmethod
    def clean_text(cls, v: str) -> str:
        return v.strip()


class TransactionCreate(TransactionBase):
    document_id: str | None = None
    original_filename: str = Field(default="manual_entry")
    document_content_hash: str = Field(default="none")
    review_status: str = Field(default="reviewed")


class TransactionUpdate(BaseModel):
    merchant: str | None = Field(None, min_length=1, max_length=255)
    invoice_number: str | None = Field(None, max_length=100)
    transaction_date: date | None = None
    subtotal: Decimal | None = Field(None, ge=0)
    tax: Decimal | None = Field(None, ge=0)
    total: Decimal | None = Field(None, ge=0)
    currency: str | None = Field(None, min_length=3, max_length=3)
    category: str | None = Field(None, max_length=100)
    payment_method: str | None = Field(None, max_length=100)
    notes: str | None = None
    review_status: str | None = Field(None, max_length=50)


class TransactionResponse(TransactionBase):
    id: str
    original_filename: str
    document_content_hash: str
    review_status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedTransactionsResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
