from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    id: str
    transaction_id: str | None = None
    original_filename: str
    mime_type: str
    file_size: int
    sha256_hash: str
    processing_status: str
    ocr_text: str | None = None
    error_details: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentUploadResponse(BaseModel):
    document_id: str
    original_filename: str
    mime_type: str
    file_size: int
    sha256_hash: str
    processing_status: str
    is_duplicate: bool = False
    existing_transaction_id: str | None = None
