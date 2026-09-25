from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

from app.config import settings
from app.services.fabric_sync import state, sync_from_fabric

router = APIRouter(prefix="/api/sync", tags=["sync"])


class SyncTriggerRequest(BaseModel):
    lookback_days: int = 7
    full_sync: bool = False


@router.get("/status")
def sync_status() -> dict[str, Any]:
    return {
        "enabled": settings.fabric_sync_enabled,
        "intervalSeconds": settings.fabric_sync_interval_seconds,
        "isSyncing": state.is_syncing,
        "lastSyncTime": state.last_sync_time,
        "lastDurationSec": state.last_duration_sec,
        "lastError": state.last_error,
        "lastStats": state.last_stats,
    }


@router.post("/trigger")
def trigger_sync(body: SyncTriggerRequest | None = None, background_tasks: BackgroundTasks = None) -> dict[str, Any]:
    lookback = body.lookback_days if body else 7
    full = body.full_sync if body else False

    if state.is_syncing:
        return {"status": "busy", "message": "Fabric sync is already in progress"}

    # Execute sync directly and return stats
    res = sync_from_fabric(lookback_days=lookback, full_sync=full)
    return res
