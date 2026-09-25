from datetime import date
from typing import Literal

from fastapi import APIRouter

from app.routes.params import parse_filters
from app.services import queries

router = APIRouter(prefix="/api/pipelines", tags=["pipelines"])


@router.get("/overview")
def overview(
    ref_date: date | None = None,
    lookback_days: int = 7,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    config_name: str | None = None,
    target_name: Literal["BR", "SL", "GL"] | None = None,
    source_system: str | None = None,
):
    return {
        "pipelines": queries.pipelines_overview(
            parse_filters(
                ref_date=ref_date,
                lookback_days=lookback_days,
                start_date_from=start_date_from,
                start_date_to=start_date_to,
                config_name=config_name,
                target_name=target_name,
                source_system=source_system,
            )
        )
    }


@router.get("/runs")
def runs(
    ref_date: date | None = None,
    lookback_days: int = 7,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    config_name: str | None = None,
    target_name: Literal["BR", "SL", "GL"] | None = None,
    limit: int = 50,
    offset: int = 0,
):
    return {
        "runs": queries.pipeline_runs(
            parse_filters(
                ref_date=ref_date,
                lookback_days=lookback_days,
                start_date_from=start_date_from,
                start_date_to=start_date_to,
                config_name=config_name,
                target_name=target_name,
                limit=limit,
                offset=offset,
            )
        )
    }


@router.get("/{pipeline_run_id}/layers")
def layers(pipeline_run_id: str):
    return {"layers": queries.pipeline_layers(pipeline_run_id)}


@router.get("/runs/{run_id}/tasks")
def run_tasks(
    run_id: str,
    pipeline_run_id: str | None = None,
    config_id: str | None = None,
    limit: int = 5000,
):
    """Taskaudit (+ queue fallback) details — includes ErrorMessage on failures, row counts on success."""
    return {
        "tasks": queries.run_task_details(
            run_id=run_id,
            pipeline_run_id=pipeline_run_id,
            config_id=config_id,
            limit=limit,
        )
    }


@router.get("/by-pipeline-run/{pipeline_run_id}/tasks")
def pipeline_run_tasks(pipeline_run_id: str, config_id: str | None = None, limit: int = 5000):
    return {
        "tasks": queries.run_task_details(
            pipeline_run_id=pipeline_run_id,
            config_id=config_id,
            limit=limit,
        )
    }
