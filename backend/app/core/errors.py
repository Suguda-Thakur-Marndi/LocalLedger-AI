from typing import Any

from fastapi import Request, status
from fastapi.responses import JSONResponse

from app.core.logging import logger


class AppError(Exception):
    """Base application exception."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    error_code: str = "BAD_REQUEST"

    def __init__(self, message: str, details: Any | None = None):
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "NOT_FOUND"


class DuplicateDocumentError(AppError):
    status_code = status.HTTP_409_CONFLICT
    error_code = "DUPLICATE_DOCUMENT"


class UnsupportedFileTypeError(AppError):
    status_code = status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
    error_code = "UNSUPPORTED_FILE_TYPE"


class FileSizeLimitError(AppError):
    status_code = status.HTTP_413_CONTENT_TOO_LARGE
    error_code = "FILE_TOO_LARGE"


class PageLimitExceededError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    error_code = "PAGE_LIMIT_EXCEEDED"


class PathTraversalError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "FORBIDDEN_PATH"


class OllamaServiceError(AppError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    error_code = "OLLAMA_UNAVAILABLE"


def create_error_response(
    status_code: int, error_code: str, message: str, details: Any | None = None
) -> JSONResponse:
    content = {
        "error": {
            "code": error_code,
            "message": message,
            "details": details,
        }
    }
    return JSONResponse(status_code=status_code, content=content)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    logger.warning("Application error: %s (code=%s)", exc.message, exc.error_code)
    return create_error_response(
        status_code=exc.status_code,
        error_code=exc.error_code,
        message=exc.message,
        details=exc.details,
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled server exception on %s: %s", request.url.path, str(exc), exc_info=True)
    return create_error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code="INTERNAL_SERVER_ERROR",
        message="An unexpected server error occurred. Check local logs for details.",
        details=None,
    )
