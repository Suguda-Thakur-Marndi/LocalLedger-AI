from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.reports import DashboardSummary
from app.services.reports.report_service import report_service

router = APIRouter()


@router.get("/dashboard", response_model=DashboardSummary)
def get_dashboard_summary(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    db: Session = Depends(get_db),
):
    return report_service.get_dashboard_summary(
        db=db,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/export")
def export_transactions_csv(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    category: str | None = Query(None),
    currency: str | None = Query(None),
    db: Session = Depends(get_db),
):
    csv_stream = report_service.generate_csv_export(
        db=db,
        start_date=start_date,
        end_date=end_date,
        category=category,
        currency=currency,
    )

    filename = f"localledger_export_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([csv_stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
