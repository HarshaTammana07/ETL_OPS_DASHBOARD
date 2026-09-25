from datetime import date
from typing import Literal

from fastapi import APIRouter, Header, HTTPException

from app.config import settings
from app.routes.params import parse_filters
from app.services import notifications as notif_svc
from app.services.notifications import NotificationIngest

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _check_ingest_key(x_api_key: str | None) -> None:
    expected = settings.notifications_ingest_key
    if not expected:
        return  # open in local/dev when unset
    if not x_api_key or x_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")


@router.post("/ingest")
def ingest_notification(
    payload: NotificationIngest,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    """Called by Fabric notification notebooks (dual-write alongside Teams). Failures only."""
    _check_ingest_key(x_api_key)
    return notif_svc.ingest_notification(payload)


@router.get("")
def list_notifications(
    ref_date: date | None = None,
    lookback_days: int = 7,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    config_name: str | None = None,
    target_name: Literal["BR", "SL", "GL"] | None = None,
    source_system: str | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    filters = parse_filters(
        ref_date=ref_date,
        lookback_days=lookback_days,
        start_date_from=start_date_from,
        start_date_to=start_date_to,
        config_name=config_name,
        target_name=target_name,
        source_system=source_system,
        q=q,
        limit=limit,
        offset=offset,
    )
    return notif_svc.list_notifications(filters, limit=limit, offset=offset)


@router.get("/summary")
def notification_summary(
    ref_date: date | None = None,
    lookback_days: int = 7,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    config_name: str | None = None,
    target_name: Literal["BR", "SL", "GL"] | None = None,
    q: str | None = None,
):
    filters = parse_filters(
        ref_date=ref_date,
        lookback_days=lookback_days,
        start_date_from=start_date_from,
        start_date_to=start_date_to,
        config_name=config_name,
        target_name=target_name,
        q=q,
    )
    return notif_svc.notification_summary(filters)


@router.post("/backfill")
def backfill_notifications(
    ref_date: date | None = None,
    lookback_days: int = 7,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    limit: int = 200,
):
    """
    Seed Alerts from pipelinerun/taskaudit for a date window.
    Teams webhooks cannot be queried for historical messages.
    """
    filters = parse_filters(
        ref_date=ref_date,
        lookback_days=lookback_days,
        start_date_from=start_date_from,
        start_date_to=start_date_to,
        limit=limit,
    )
    return notif_svc.backfill_from_audit(filters, limit=limit)
