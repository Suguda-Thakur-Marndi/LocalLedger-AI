from decimal import Decimal

from pydantic import BaseModel

from app.schemas.transaction import TransactionResponse


class SpendingByCategory(BaseModel):
    category: str
    currency: str
    total_amount: Decimal
    transaction_count: int
    percentage: float


class MonthlySpendTrend(BaseModel):
    month: str  # YYYY-MM
    currency: str
    total_amount: Decimal
    transaction_count: int


class CurrencyTotal(BaseModel):
    currency: str
    total_amount: Decimal
    transaction_count: int
    average_amount: Decimal


class DashboardSummary(BaseModel):
    currency_totals: list[CurrencyTotal]
    total_transactions: int
    total_receipts: int
    categories: list[SpendingByCategory]
    monthly_trends: list[MonthlySpendTrend]
    recent_transactions: list[TransactionResponse]
