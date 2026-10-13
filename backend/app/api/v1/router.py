from fastapi import APIRouter

from app.api.v1.endpoints import (
    documents,
    health,
    receipts,
    reports,
    transactions,
)
from app.api.v1.endpoints import (
    settings as settings_ep,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(receipts.router, prefix="/receipts", tags=["Receipts"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(settings_ep.router, prefix="/settings", tags=["Settings"])
