from datetime import date
from typing import Literal

from fastapi import APIRouter

from app.routes.params import parse_filters
from app.services import queries

router = APIRouter(prefix="/api/kpis", tags=["kpis"])


@router.get("/daily")
def daily_kpis(
    ref_date: date | None = None,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    config_name: str | None = None,
    target_name: Literal["BR", "SL", "GL"] | None = None,
    source_system: str | None = None,
):
    return queries.today_kpis(
        parse_filters(
            ref_date=ref_date,
            start_date_from=start_date_from,
            start_date_to=start_date_to,
            config_name=config_name,
            target_name=target_name,
            source_system=source_system,
        )
    )


@router.get("/running")
def running(
    config_name: str | None = None,
    target_name: Literal["BR", "SL", "GL"] | None = None,
    limit: int = 50,
):
    return {"tasks": queries.running_tasks(parse_filters(config_name=config_name, target_name=target_name, limit=limit))}


@router.get("/recent-runs")
def recent_runs(
    ref_date: date | None = None,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    config_name: str | None = None,
    target_name: Literal["BR", "SL", "GL"] | None = None,
    site_code: str | None = None,
    source_system: str | None = None,
    status: str | None = None,
    pipeline_run_id: str | None = None,
    run_id: str | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    filters = parse_filters(
        ref_date=ref_date,
        start_date_from=start_date_from,
        start_date_to=start_date_to,
        config_name=config_name,
        target_name=target_name,
        site_code=site_code,
        source_system=source_system,
        status=status,
        pipeline_run_id=pipeline_run_id,
        run_id=run_id,
        limit=limit,
        offset=offset,
    )
    return {
        "runs": queries.recent_pipeline_runs(filters, q=q),
        "total": queries.count_recent_pipeline_runs(filters, q=q),
        "limit": limit,
        "offset": offset,
    }
