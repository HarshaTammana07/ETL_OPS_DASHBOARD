from datetime import date

from fastapi import APIRouter, Query

from app.services import queries

router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.get("/search")
def search_runs(
    run_id: str | None = None,
    pipeline_run_id: str | None = None,
    site_code: str | None = None,
    ref_date: date | None = None,
    limit: int = 50,
):
    return {
        "results": queries.search_runs(
            run_id=run_id,
            pipeline_run_id=pipeline_run_id,
            site_code=site_code,
            ref_date=ref_date,
            limit=limit,
        )
    }
