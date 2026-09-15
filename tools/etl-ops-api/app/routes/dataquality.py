from datetime import date

from fastapi import APIRouter

from app.routes.params import parse_filters
from app.services import queries

router = APIRouter(prefix="/api/data-quality", tags=["data-quality"])


@router.get("/issues")
def dq_issues(
    ref_date: date | None = None,
    lookback_days: int = 30,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    config_name: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    return {
        "issues": queries.data_quality_issues(
            parse_filters(
                ref_date=ref_date,
                lookback_days=lookback_days,
                start_date_from=start_date_from,
                start_date_to=start_date_to,
                config_name=config_name,
                limit=limit,
                offset=offset,
            )
        )
    }
