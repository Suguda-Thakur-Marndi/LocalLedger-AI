import logging
import sys

from app.core.config import settings

LOG_FORMAT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"


def setup_logging():
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format=LOG_FORMAT,
        handlers=[logging.StreamHandler(sys.stdout)],
        force=True,
    )
    # Silence noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("fitz").setLevel(logging.WARNING)
    logging.getLogger("PIL").setLevel(logging.WARNING)


logger = logging.getLogger("localledger")
