import csv
import io
from datetime import date
from decimal import Decimal

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.transaction import Transaction
from app.schemas.reports import (
    CurrencyTotal,
    DashboardSummary,
    MonthlySpendTrend,
    SpendingByCategory,
)
from app.schemas.transaction import TransactionResponse


class ReportService:
    @staticmethod
    def get_dashboard_summary(
        db: Session,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> DashboardSummary:
        # Base transaction query with optional date range
        stmt = select(Transaction)
        if start_date:
            stmt = stmt.where(Transaction.transaction_date >= start_date)
        if end_date:
            stmt = stmt.where(Transaction.transaction_date <= end_date)

        transactions = list(db.execute(stmt).scalars().all())

        # Total counts
        total_tx = len(transactions)
        doc_count = db.execute(select(func.count(Document.id))).scalar() or 0

        # Totals by currency
        curr_map = {}
        for tx in transactions:
            c = tx.currency
            if c not in curr_map:
                curr_map[c] = {"total": Decimal("0.00"), "count": 0}
            curr_map[c]["total"] += tx.total
            curr_map[c]["count"] += 1

        currency_totals = []
        for c, data in curr_map.items():
            avg = (
                (data["total"] / data["count"]).quantize(Decimal("0.01"))
                if data["count"] > 0
                else Decimal("0.00")
            )
            currency_totals.append(
                CurrencyTotal(
                    currency=c,
                    total_amount=data["total"],
                    transaction_count=data["count"],
                    average_amount=avg,
                )
            )

        # Categories breakdown
        cat_map = {}
        for tx in transactions:
            key = (tx.category, tx.currency)
            if key not in cat_map:
                cat_map[key] = {"total": Decimal("0.00"), "count": 0}
            cat_map[key]["total"] += tx.total
            cat_map[key]["count"] += 1

        categories = []
        for (cat, curr), val in cat_map.items():
            curr_total = curr_map.get(curr, {}).get("total", Decimal("1.00"))
            pct = float((val["total"] / curr_total) * 100) if curr_total > Decimal(0) else 0.0
            categories.append(
                SpendingByCategory(
                    category=cat,
                    currency=curr,
                    total_amount=val["total"],
                    transaction_count=val["count"],
                    percentage=round(pct, 1),
                )
            )
        categories.sort(key=lambda x: x.total_amount, reverse=True)

        # Monthly trends
        month_map = {}
        for tx in transactions:
            month_str = tx.transaction_date.strftime("%Y-%m")
            key = (month_str, tx.currency)
            if key not in month_map:
                month_map[key] = {"total": Decimal("0.00"), "count": 0}
            month_map[key]["total"] += tx.total
            month_map[key]["count"] += 1

        monthly_trends = [
            MonthlySpendTrend(
                month=month_str,
                currency=curr,
                total_amount=val["total"],
                transaction_count=val["count"],
            )
            for (month_str, curr), val in sorted(month_map.items())
        ]

        # Recent transactions (up to 5)
        recent_txs = list(
            db.execute(select(Transaction).order_by(desc(Transaction.created_at)).limit(5))
            .scalars()
            .all()
        )
        recent_responses = [TransactionResponse.model_validate(t) for t in recent_txs]

        return DashboardSummary(
            currency_totals=currency_totals,
            total_transactions=total_tx,
            total_receipts=doc_count,
            categories=categories,
            monthly_trends=monthly_trends,
            recent_transactions=recent_responses,
        )

    @staticmethod
    def generate_csv_export(
        db: Session,
        start_date: date | None = None,
        end_date: date | None = None,
        category: str | None = None,
        currency: str | None = None,
    ) -> io.StringIO:
        stmt = select(Transaction).order_by(desc(Transaction.transaction_date))
        if start_date:
            stmt = stmt.where(Transaction.transaction_date >= start_date)
        if end_date:
            stmt = stmt.where(Transaction.transaction_date <= end_date)
        if category:
            stmt = stmt.where(Transaction.category == category)
        if currency:
            stmt = stmt.where(Transaction.currency == currency.upper())

        transactions = list(db.execute(stmt).scalars().all())

        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
        writer.writerow(
            [
                "ID",
                "Transaction Date",
                "Merchant",
                "Invoice Number",
                "Subtotal",
                "Tax",
                "Total",
                "Currency",
                "Category",
                "Payment Method",
                "Original Filename",
                "Review Status",
                "Notes",
                "Created At",
            ]
        )

        for tx in transactions:
            writer.writerow(
                [
                    tx.id,
                    tx.transaction_date.isoformat(),
                    tx.merchant,
                    tx.invoice_number or "",
                    str(tx.subtotal),
                    str(tx.tax),
                    str(tx.total),
                    tx.currency,
                    tx.category,
                    tx.payment_method or "",
                    tx.original_filename,
                    tx.review_status,
                    tx.notes or "",
                    tx.created_at.isoformat(),
                ]
            )

        output.seek(0)
        return output


report_service = ReportService()
