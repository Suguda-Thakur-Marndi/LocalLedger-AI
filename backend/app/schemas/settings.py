from pydantic import BaseModel


class SystemStatusResponse(BaseModel):
    app_env: str
    ollama_connected: bool
    ollama_model: str
    ollama_available_models: list[str] = []
    ocr_engine_available: bool
    ocr_engine_type: str
    storage_directory: str
    database_path: str
    total_documents: int
    total_transactions: int
    storage_size_bytes: int
    max_upload_size_mb: int
    max_pdf_pages: int


class DeleteAllDataRequest(BaseModel):
    confirm_text: str  # Must match "DELETE LOCAL DATA"
