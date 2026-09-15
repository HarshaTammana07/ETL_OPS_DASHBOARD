"""Build deep links into Microsoft Fabric pipeline run views."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import settings

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

FABRIC_DATA_PIPELINE_URL = (
    "https://app.fabric.microsoft.com/workloads/data-pipeline/artifactAuthor"
    "/workspaces/{workspace_id}/pipelines/{artifact_id}/{run_id}"
    "?experience={experience}"
)


@lru_cache(maxsize=1)
def _load_map() -> dict[str, Any]:
    path = settings.fabric_map_path
    if not path.exists():
        return {
            "workspaceId": settings.fabric_workspace_id,
            "experience": settings.fabric_experience,
            "pipelinesByConfigId": {},
            "pipelinesByPipelineName": {},
            "pipelinesByConfigName": {},
        }
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    data.setdefault("workspaceId", settings.fabric_workspace_id)
    data.setdefault("experience", settings.fabric_experience)
    return data


def reload_fabric_map() -> None:
    _load_map.cache_clear()


def resolve_artifact_id(row: dict[str, Any]) -> str | None:
    fabric_map = _load_map()
    config_id = str(row.get("ConfigId") or "")
    pipeline_name = str(row.get("PipelineName") or "")
    config_name = str(row.get("ConfigName") or "")

    by_config = fabric_map.get("pipelinesByConfigId") or {}
    by_name = fabric_map.get("pipelinesByPipelineName") or {}
    by_config_name = fabric_map.get("pipelinesByConfigName") or {}

    candidates = []
    if config_id and config_id in by_config:
        candidates.append(by_config[config_id])
    if pipeline_name and pipeline_name in by_name:
        candidates.append(by_name[pipeline_name])
    if config_name and config_name in by_config_name:
        candidates.append(by_config_name[config_name])

    for artifact_id in candidates:
        if _is_valid_artifact_id(artifact_id):
            return artifact_id
    return None


def _is_valid_artifact_id(artifact_id: str | None) -> bool:
    if not artifact_id or not isinstance(artifact_id, str):
        return False
    if artifact_id.startswith("REPLACE_"):
        return False
    return bool(UUID_RE.match(artifact_id))


def is_fabric_run_id(run_id: str | None) -> bool:
    return bool(run_id and UUID_RE.match(run_id))


def build_fabric_run_url(row: dict[str, Any]) -> str | None:
    """Return Fabric pipeline run URL when artifact mapping + UUID run id exist."""
    pipeline_run_id = row.get("PipelineRunId")
    if not is_fabric_run_id(pipeline_run_id):
        return None

    artifact_id = resolve_artifact_id(row)
    if not artifact_id:
        return None

    fabric_map = _load_map()
    workspace_id = fabric_map.get("workspaceId") or settings.fabric_workspace_id
    experience = fabric_map.get("experience") or settings.fabric_experience

    return FABRIC_DATA_PIPELINE_URL.format(
        workspace_id=workspace_id,
        artifact_id=artifact_id,
        run_id=pipeline_run_id,
        experience=experience,
    )


def attach_fabric_urls(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for row in rows:
        row["fabricUrl"] = build_fabric_run_url(row)
    return rows


def get_fabric_map_summary() -> dict[str, Any]:
    fabric_map = _load_map()
    return {
        "workspaceId": fabric_map.get("workspaceId"),
        "experience": fabric_map.get("experience"),
        "mappedConfigIds": list((fabric_map.get("pipelinesByConfigId") or {}).keys()),
        "mappedPipelineNames": list((fabric_map.get("pipelinesByPipelineName") or {}).keys()),
        "mappedConfigNames": list((fabric_map.get("pipelinesByConfigName") or {}).keys()),
    }
