from datetime import date
from typing import Literal

from fastapi import APIRouter

from app.routes.params import parse_filters
from app.services import queries

router = APIRouter(prefix="/api/failures", tags=["failures"])


@router.get("/overview")
def failure_overview(
    ref_date: date | None = None,
    lookback_days: int = 7,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    config_name: str | None = None,
    target_name: Literal["BR", "SL", "GL"] | None = None,
):
    return queries.failure_overview(
        parse_filters(
            ref_date=ref_date,
            lookback_days=lookback_days,
            start_date_from=start_date_from,
            start_date_to=start_date_to,
            config_name=config_name,
            target_name=target_name,
        )
    )


@router.get("/sites/summary")
def site_failure_summary(
    ref_date: date | None = None,
    lookback_days: int = 7,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    config_name: str | None = None,
    target_name: Literal["BR", "SL", "GL"] | None = None,
    limit: int = 100,
):
    return {
        "sites": queries.site_failure_summary(
            parse_filters(
                ref_date=ref_date,
                lookback_days=lookback_days,
                start_date_from=start_date_from,
                start_date_to=start_date_to,
                config_name=config_name,
                target_name=target_name,
                limit=limit,
            )
        )
    }


@router.get("/tasks")
def failed_tasks(
    ref_date: date | None = None,
    lookback_days: int = 7,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    config_name: str | None = None,
    target_name: Literal["BR", "SL", "GL"] | None = None,
    site_code: str | None = None,
    method: str | None = None,
    limit: int = 100,
    offset: int = 0,
):
    return {
        "failures": queries.failed_tasks(
            parse_filters(
                ref_date=ref_date,
                lookback_days=lookback_days,
                start_date_from=start_date_from,
                start_date_to=start_date_to,
                config_name=config_name,
                target_name=target_name,
                site_code=site_code,
                method=method,
                limit=limit,
                offset=offset,
            )
        )
    }


@router.get("/sites/{site_code}/audit")
def site_audit(
    site_code: str,
    ref_date: date | None = None,
    lookback_days: int = 7,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    limit: int = 50,
):
    return {
        "audits": queries.site_audit_summary(
            site_code,
            parse_filters(
                ref_date=ref_date,
                lookback_days=lookback_days,
                start_date_from=start_date_from,
                start_date_to=start_date_to,
                limit=limit,
            ),
        )
    }
