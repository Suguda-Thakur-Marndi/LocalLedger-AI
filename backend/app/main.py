import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import AppError, app_error_handler, unhandled_exception_handler
from app.core.logging import logger, setup_logging
from app.db.base import Base
from app.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize logging
    setup_logging()
    logger.info("Starting LocalLedger AI backend service in %s mode...", settings.APP_ENV)

    # Ensure storage paths exist
    _ = settings.resolved_upload_dir
    _ = settings.resolved_db_path

    # Ensure tables are created
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized at %s", settings.resolved_db_path)

    yield

    logger.info("Shutting down LocalLedger AI backend service.")


app = FastAPI(
    title="LocalLedger AI",
    description="Private, local-first invoice and receipt management API powered by local Ollama AI and OCR.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware with restricted loopback origins & desktop shell support
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1)(:[0-9]+)?|file://|null|app://.*)$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Request ID and timing middleware
@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
    start_time = time.time()

    response = await call_next(request)

    duration_ms = (time.time() - start_time) * 1000
    response.headers["X-Request-ID"] = request_id

    # Avoid logging sensitive contents or spamming static routes
    if not request.url.path.startswith("/docs") and not request.url.path.startswith("/openapi"):
        logger.info(
            "[%s] %s %s -> %d (%.1f ms)",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )

    return response


# Centralized exception handlers
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# Mount Versioned API Routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "name": "LocalLedger AI",
        "tagline": "Your receipts. Your data. Your AI. Your computer.",
        "version": "0.1.0",
        "docs": "/docs",
        "api_v1": "/api/v1",
    }
