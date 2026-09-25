from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class GlobalFilters(BaseModel):
    ref_date: date | None = None
    lookback_days: int = Field(7, ge=1, le=90)
    start_date_from: date | None = None
    start_date_to: date | None = None
    config_name: str | None = None
    target_name: Literal["BR", "SL", "GL"] | None = None
    site_code: str | None = None
    source_system: str | None = None
    method: str | None = None
    status: str | None = None
    pipeline_run_id: str | None = None
    run_id: str | None = None
    is_active: bool | None = None
    q: str | None = None
    limit: int = Field(50, ge=1, le=500)
    offset: int = Field(0, ge=0)


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    question: str
    ref_date: date | None = None
    lookback_days: int = Field(7, ge=1, le=90)
    start_date_from: date | None = None
    start_date_to: date | None = None
    history: list[ChatHistoryMessage] = Field(default_factory=list)
