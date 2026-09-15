from datetime import date
from typing import Literal

from fastapi import APIRouter

from app.routes.params import parse_filters
from app.services import queries

router = APIRouter(prefix="/api/trends", tags=["trends"])


def _trend_filters(
    *,
    ref_date: date | None,
    lookback_days: int,
    start_date_from: date | None,
    start_date_to: date | None,
    config_name: str | None,
    target_name: Literal["BR", "SL", "GL"] | None,
    source_system: str | None = None,
    site_code: str | None = None,
    pipeline_run_id: str | None = None,
    run_id: str | None = None,
    limit: int = 50,
):
    return parse_filters(
        ref_date=ref_date,
        lookback_days=lookback_days,
        start_date_from=start_date_from,
        start_date_to=start_date_to,
        config_name=config_name,
        target_name=target_name,
        source_system=source_system,
        site_code=site_code,
        pipeline_run_id=pipeline_run_id,
        run_id=run_id,
        limit=limit,
    )


@router.get("/daily")
def daily_trends(
    ref_date: date | None = None,
    lookback_days: int = 7,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    config_name: str | None = None,
    target_name: Literal["BR", "SL", "GL"] | None = None,
    source_system: str | None = None,
    pipeline_run_id: str | None = None,
    run_id: str | None = None,
):
    return {
        "points": queries.daily_trends(
            _trend_filters(
                ref_date=ref_date,
                lookback_days=lookback_days,
                start_date_from=start_date_from,
                start_date_to=start_date_to,
                config_name=config_name,
                target_name=target_name,
                source_system=source_system,
                pipeline_run_id=pipeline_run_id,
                run_id=run_id,
            )
        )
    }


@router.get("/reliability")
def reliability_trends(
    ref_date: date | None = None,
    lookback_days: int = 7,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    config_name: str | None = None,
    target_name: Literal["BR", "SL", "GL"] | None = None,
    source_system: str | None = None,
    pipeline_run_id: str | None = None,
    run_id: str | None = None,
    top_limit: int = 10,
):
    filters = _trend_filters(
        ref_date=ref_date,
        lookback_days=lookback_days,
        start_date_from=start_date_from,
        start_date_to=start_date_to,
        config_name=config_name,
        target_name=target_name,
        source_system=source_system,
        pipeline_run_id=pipeline_run_id,
        run_id=run_id,
    )
    duration = queries.duration_by_layer(filters)
    run_scope = queries.get_run_scope_context(filters)
    return {
        "runScope": run_scope,
        "summary": queries.reliability_summary(filters),
        "daily": queries.daily_trends(filters),
        "durationByLayer": duration["byLayer"],
        "durationDaily": duration["daily"],
        "failuresByLayer": queries.failures_by_layer(filters),
        "topFailingPipelines": []
        if run_scope
        else queries.top_failing_pipelines(filters, limit=top_limit),
    }


@router.get("/task-activity")
def task_activity_trends(
    ref_date: date | None = None,
    lookback_days: int = 7,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    config_name: str | None = None,
    target_name: Literal["BR", "SL", "GL"] | None = None,
    source_system: str | None = None,
    site_code: str | None = None,
    pipeline_run_id: str | None = None,
    run_id: str | None = None,
    top_limit: int = 10,
):
    filters = _trend_filters(
        ref_date=ref_date,
        lookback_days=lookback_days,
        start_date_from=start_date_from,
        start_date_to=start_date_to,
        config_name=config_name,
        target_name=target_name,
        source_system=source_system,
        site_code=site_code,
        pipeline_run_id=pipeline_run_id,
        run_id=run_id,
    )
    run_scope = queries.get_run_scope_context(filters)
    return {
        "runScope": run_scope,
        "summary": queries.task_activity_summary(filters),
        "daily": queries.daily_task_trends(filters),
        "topFailingSites": queries.top_failing_sites(filters, limit=top_limit),
    }


@router.get("/top-failures")
def top_failures(
    ref_date: date | None = None,
    lookback_days: int = 7,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    config_name: str | None = None,
    limit: int = 10,
):
    return {
        "items": queries.top_failing_pipelines(
            _trend_filters(
                ref_date=ref_date,
                lookback_days=lookback_days,
                start_date_from=start_date_from,
                start_date_to=start_date_to,
                config_name=config_name,
                target_name=None,
                limit=limit,
            ),
            limit=limit,
        )
    }
