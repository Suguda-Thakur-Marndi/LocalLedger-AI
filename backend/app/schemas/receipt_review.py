from datetime import date
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class FieldSuggestion(BaseModel):
    value: Any = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    source: str = Field(default="fallback")  # "ai" | "ocr_rules" | "fallback"
    is_inferred: bool = False


class ReceiptReviewData(BaseModel):
    merchant: str | None = None
    invoice_number: str | None = None
    transaction_date: date | None = None
    subtotal: Decimal = Decimal("0.00")
    tax: Decimal = Decimal("0.00")
    total: Decimal = Decimal("0.00")
    currency: str = "USD"
    category: str = "Other"
    payment_method: str | None = None
    notes: str | None = None


class ReceiptReviewPayload(BaseModel):
    document_id: str
    original_filename: str
    mime_type: str
    processing_status: str
    extracted: ReceiptReviewData
    suggestions: dict[str, FieldSuggestion]
    ocr_text_preview: str
    warnings: list[str]
    ollama_used: bool
    model_name: str | None = None


class ConfirmReceiptRequest(BaseModel):
    document_id: str
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
