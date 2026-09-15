from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent.parent / ".env",
        extra="ignore",
    )

    auth_disabled: bool = True
    # Override with DATA_DIR env on hosts where repo layout differs
    data_dir: Path = Path(__file__).resolve().parents[3] / "DATA"
    sqlite_path: Path = Path(__file__).resolve().parents[1] / "data" / "sample.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    # Allow Vercel preview/production origins when API is deployed
    cors_origin_regex: str | None = r"https://.*\.vercel\.app"
    fabric_workspace_id: str = "c5097ffb-b78e-441d-9575-a82bac23cac8"
    fabric_experience: str = "fabric-developer"
    fabric_map_path: Path = Path(__file__).resolve().parents[3] / "DATA" / "fabric_pipeline_map.json"

    # Chat: rules = v1 keyword router, agent = LLM + tools (gemini or openrouter)
    chat_mode: Literal["rules", "agent"] = "agent"
    chat_provider: Literal["gemini", "openrouter"] = "gemini"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.6-flash"
    gemini_max_tool_rounds: int = 5
    openrouter_api_key: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "openai/gpt-4o-mini"
    openrouter_max_tool_rounds: int = 5
    openrouter_site_url: str = "http://localhost:5173"
    openrouter_app_title: str = "ETL Operations Center"

    # Notifications ingest (Fabric notebook dual-write). Empty = no auth in local dev.
    notifications_ingest_key: str | None = None
    # Public base URL notebooks should POST to (override in .env for deployed API)
    notifications_ingest_url: str = "http://127.0.0.1:8000/api/notifications/ingest"


settings = Settings()
