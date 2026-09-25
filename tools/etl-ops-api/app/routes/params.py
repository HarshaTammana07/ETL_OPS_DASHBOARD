from datetime import date
from typing import Literal

from app.models.filters import GlobalFilters


def parse_filters(
    *,
    ref_date: date | None = None,
    lookback_days: int = 7,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    config_name: str | None = None,
    target_name: Literal["BR", "SL", "GL"] | None = None,
    site_code: str | None = None,
    source_system: str | None = None,
    method: str | None = None,
    status: str | None = None,
    pipeline_run_id: str | None = None,
    run_id: str | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> GlobalFilters:
    return GlobalFilters(
        ref_date=ref_date,
        lookback_days=lookback_days,
        start_date_from=start_date_from,
        start_date_to=start_date_to,
        config_name=config_name,
        target_name=target_name,
        site_code=site_code,
        source_system=source_system,
        method=method,
        status=status,
        pipeline_run_id=pipeline_run_id,
        run_id=run_id,
        q=q,
        limit=limit,
        offset=offset,
    )
