import hashlib
import re
from pathlib import Path
from uuid import uuid4

from app.core.config import settings
from app.core.errors import PathTraversalError


def compute_sha256(content: bytes) -> str:
    """Compute hex SHA-256 digest of binary content."""
    hasher = hashlib.sha256()
    hasher.update(content)
    return hasher.hexdigest()


def sanitize_filename(filename: str) -> str:
    """
    Sanitize an untrusted user-supplied filename to prevent directory traversal
    and filesystem injection.
    """
    # Extract only the base name (strip directory components)
    name = Path(filename).name
    # Remove control characters, null bytes, backslashes, colons
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", name)
    cleaned = cleaned.strip(". ")
    if not cleaned:
        cleaned = f"document_{uuid4().hex[:8]}"
    return cleaned


def generate_storage_filename(original_filename: str) -> str:
    """Generate a collision-proof UUID storage filename preserving original extension."""
    ext = Path(original_filename).suffix.lower()
    if ext not in {".pdf", ".png", ".jpg", ".jpeg", ".webp"}:
        ext = ".bin"
    return f"{uuid4().hex}{ext}"


def resolve_safe_upload_path(storage_filename: str) -> Path:
    """
    Ensure the resolved storage file path resides strictly inside the configured
    upload directory, blocking path traversal attacks.
    """
    upload_dir = settings.resolved_upload_dir.resolve()
    target_path = (upload_dir / storage_filename).resolve()
    if not str(target_path).startswith(str(upload_dir)):
        raise PathTraversalError(f"Path traversal detected: {storage_filename}")
    return target_path
