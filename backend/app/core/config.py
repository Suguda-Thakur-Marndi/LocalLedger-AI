from pathlib import Path
from urllib.parse import urlparse

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_ENV: str = "development"
    BACKEND_HOST: str = "127.0.0.1"
    BACKEND_PORT: int = 8000

    # Paths: workspace root resolution
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent
    DATA_DIR: str = "data"
    DB_PATH: str = "data/db/localledger.db"
    UPLOAD_DIR: str = "data/uploads"

    # Ingestion limits
    MAX_UPLOAD_SIZE_MB: int = 25
    MAX_PDF_PAGES: int = 15

    # Local AI
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "qwen2.5:3b"
    OLLAMA_TIMEOUT_SECONDS: int = 60

    # OCR
    TESSERACT_CMD: str = ""

    # Security & CORS
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    # Logging
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent.parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("OLLAMA_BASE_URL")
    @classmethod
    def validate_ollama_base_url(cls, v: str) -> str:
        parsed = urlparse(v)
        hostname = (parsed.hostname or "").lower()
        allowed_hosts = {"127.0.0.1", "localhost", "::1", "host.docker.internal"}
        if hostname not in allowed_hosts:
            raise ValueError(
                f"OLLAMA_BASE_URL must be a local loopback host to prevent SSRF. Got '{hostname}'."
            )
        return v.rstrip("/")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def resolved_data_dir(self) -> Path:
        path = Path(self.DATA_DIR)
        if not path.is_absolute():
            path = self.BASE_DIR / path
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def resolved_upload_dir(self) -> Path:
        path = Path(self.UPLOAD_DIR)
        if not path.is_absolute():
            path = self.BASE_DIR / path
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def resolved_db_path(self) -> Path:
        path = Path(self.DB_PATH)
        if not path.is_absolute():
            path = self.BASE_DIR / path
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def database_url(self) -> str:
        # SQLite database URL
        # For Windows paths, SQLAlchemy format sqlite:///C:/path/to/db.sqlite
        resolved = str(self.resolved_db_path.as_posix())
        return f"sqlite:///{resolved}"

    @property
    def max_upload_size_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024


settings = Settings()
