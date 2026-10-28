"""Build deep links into Microsoft Fabric pipeline and notebook views."""

from __future__ import annotations

import json
import logging
import re
import subprocess
import time
import urllib.request
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import settings

logger = logging.getLogger("fabric_links")

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

FABRIC_PIPELINE_RUN_URL = (
    "https://app.fabric.microsoft.com/workloads/data-pipeline/artifactAuthor"
    "/workspaces/{workspace_id}/pipelines/{artifact_id}/{run_id}"
    "?experience={experience}&ctid={tenant_id}"
)

FABRIC_PIPELINE_CANVAS_URL = (
    "https://app.fabric.microsoft.com/workloads/data-pipeline/artifactAuthor"
    "/workspaces/{workspace_id}/pipelines/{artifact_id}"
    "?experience={experience}&ctid={tenant_id}"
)

FABRIC_NOTEBOOK_URL = (
    "https://app.fabric.microsoft.com/groups/{workspace_id}/notebooks/{artifact_id}"
    "?experience={experience}&ctid={tenant_id}"
)

PIPELINE_ALIASES: dict[str, str] = {
    "pl_inv": "pl_inventory",
    "pl_execute_samms_global": "pl_execute_samms_global_src_to_bz",
    "nb_p1_finance_bronze_to_silver": "pl_p1_finance_bronze_to_silver",
    "execute_p1_finance": "pl_p1_finance",
    "pl_execute_reference": "pl_reference",
    "nb_p1_reference_bronze_to_silver": "pl_reference_bronz_to_silver",
    "execute_p1_reference": "pl_reference",
    "pl_execute_forms": "pl_forms_samms_to_lakehouse",
    "pl_execute_clinical": "pl_clinicalp1/p2_src_to_brz",
    "pl_p1p2_assessments": "pl_p1p2_assessments_copy1",
    "pl_execute_assessments_02": "pl_assessments_02",
    "nb_overduecourses_slv_to_gld": "pl_overduecourses_onedrive",
    "nb_callback_brz_to_slv": "pl_callbacklists",
    "pl_clinical_ua_cdc_src_to_bronze": "pl_clinical_cdc",
    "pl_clinical_ua_cdc_brz_to_slv": "pl_clinical_cdc",
    "pl_execute_notes": "pl_notes",
    "pl_execute_dartsrv": "pl_execute_dartsrv_copy2",
    "pl_execute_pipeline_answersignature": "pl_forms",
    "pl_execute_form_questionanswers": "pl_forms",
}

# In-memory cache for dynamic Fabric REST API catalog
_DYNAMIC_CATALOG: dict[str, dict[str, Any]] = {}
_DYNAMIC_CATALOG_EXPIRY: float = 0.0


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
    try:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        data.setdefault("workspaceId", settings.fabric_workspace_id)
        data.setdefault("experience", settings.fabric_experience)
        return data
    except Exception as exc:
        logger.warning(f"Failed to load fabric_map_path: {exc}")
        return {
            "workspaceId": settings.fabric_workspace_id,
            "experience": settings.fabric_experience,
            "pipelinesByConfigId": {},
            "pipelinesByPipelineName": {},
            "pipelinesByConfigName": {},
        }


def _fetch_dynamic_catalog(workspace_id: str) -> dict[str, dict[str, Any]]:
    """Fetch live items from Microsoft Fabric REST API using Azure CLI authentication."""
    global _DYNAMIC_CATALOG, _DYNAMIC_CATALOG_EXPIRY
    now = time.time()
    if _DYNAMIC_CATALOG and now < _DYNAMIC_CATALOG_EXPIRY:
        return _DYNAMIC_CATALOG

    try:
        res = subprocess.run(
            "az account get-access-token --resource https://api.fabric.microsoft.com",
            shell=True,
            capture_output=True,
            text=True,
            timeout=15,
        )
        if res.returncode != 0:
            return _DYNAMIC_CATALOG

        token = json.loads(res.stdout)["accessToken"]
        url = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})

        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())

        items = data.get("value", [])
        catalog: dict[str, dict[str, Any]] = {}
        for item in items:
            name = (item.get("displayName") or "").strip().lower()
            if name:
                catalog[name] = item

        _DYNAMIC_CATALOG = catalog
        _DYNAMIC_CATALOG_EXPIRY = now + 3600.0  # cache 1 hour
        logger.info(f"Dynamically discovered {len(catalog)} items from Microsoft Fabric workspace.")
        return _DYNAMIC_CATALOG
    except Exception as exc:
        logger.debug(f"Dynamic Fabric catalog lookup skipped: {exc}")
        return _DYNAMIC_CATALOG


def reload_fabric_map() -> None:
    global _DYNAMIC_CATALOG_EXPIRY
    _DYNAMIC_CATALOG_EXPIRY = 0.0
    _load_map.cache_clear()


def resolve_artifact_info(row: dict[str, Any]) -> tuple[str | None, str]:
    """Resolve the Fabric artifact GUID and its type ('DataPipeline' | 'Notebook')."""
    fabric_map = _load_map()
    workspace_id = fabric_map.get("workspaceId") or settings.fabric_workspace_id

    config_id = str(row.get("ConfigId") or "").strip()
    pipeline_name = str(row.get("PipelineName") or "").strip()
    config_name = str(row.get("ConfigName") or "").strip()

    # 1. Check explicit mappings in fabric_pipeline_map.json
    by_config = fabric_map.get("pipelinesByConfigId") or {}
    by_name = fabric_map.get("pipelinesByPipelineName") or {}
    by_config_name = fabric_map.get("pipelinesByConfigName") or {}

    candidates: list[str] = []
    if config_id and config_id in by_config:
        candidates.append(by_config[config_id])
    if pipeline_name and pipeline_name in by_name:
        candidates.append(by_name[pipeline_name])
    if config_name and config_name in by_config_name:
        candidates.append(by_config_name[config_name])

    for artifact_id in candidates:
        if _is_valid_artifact_id(artifact_id):
            return artifact_id, "DataPipeline"

    # 2. Check dynamic catalog via Microsoft Fabric REST API
    catalog = _fetch_dynamic_catalog(workspace_id)
    if catalog:
        lookup_keys = [pipeline_name.lower(), config_name.lower()]
        alias = PIPELINE_ALIASES.get(pipeline_name.lower())
        if alias:
            lookup_keys.append(alias.lower())

        for key in lookup_keys:
            if key and key in catalog:
                item = catalog[key]
                artifact_id = item.get("id")
                item_type = item.get("type", "DataPipeline")
                if _is_valid_artifact_id(artifact_id):
                    return artifact_id, item_type

    return None, "DataPipeline"


def resolve_artifact_id(row: dict[str, Any]) -> str | None:
    artifact_id, _ = resolve_artifact_info(row)
    return artifact_id


def _is_valid_artifact_id(artifact_id: str | None) -> bool:
    if not artifact_id or not isinstance(artifact_id, str):
        return False
    if artifact_id.startswith("REPLACE_"):
        return False
    return bool(UUID_RE.match(artifact_id))


def is_fabric_run_id(run_id: str | None) -> bool:
    return bool(run_id and UUID_RE.match(run_id))


def build_fabric_run_url(row: dict[str, Any]) -> tuple[str | None, str]:
    """Return (fabric_url, url_type).
    url_type is one of:
      - 'run': deep-link to specific pipeline execution
      - 'pipeline': deep-link to pipeline/notebook canvas (e.g. for MANUAL_RUN)
      - 'workspace': fallback to workspace Monitoring Hub
    """
    fabric_map = _load_map()
    workspace_id = fabric_map.get("workspaceId") or settings.fabric_workspace_id
    tenant_id = fabric_map.get("tenantId") or settings.fabric_tenant_id
    experience = fabric_map.get("experience") or settings.fabric_experience
    login_hint = fabric_map.get("loginHint") or settings.fabric_login_hint
    hint_suffix = f"&login_hint={login_hint}" if login_hint else ""

    pipeline_run_id = row.get("PipelineRunId")
    artifact_id, item_type = resolve_artifact_info(row)

    if artifact_id:
        if item_type == "Notebook":
            return (
                FABRIC_NOTEBOOK_URL.format(
                    workspace_id=workspace_id,
                    artifact_id=artifact_id,
                    experience=experience,
                    tenant_id=tenant_id,
                ) + hint_suffix,
                "pipeline",
            )

        # For DataPipeline:
        if is_fabric_run_id(pipeline_run_id):
            return (
                FABRIC_PIPELINE_RUN_URL.format(
                    workspace_id=workspace_id,
                    artifact_id=artifact_id,
                    run_id=pipeline_run_id,
                    experience=experience,
                    tenant_id=tenant_id,
                ) + hint_suffix,
                "run",
            )
        else:
            # MANUAL_RUN or legacy ID: link straight to pipeline canvas/editor in Fabric!
            return (
                FABRIC_PIPELINE_CANVAS_URL.format(
                    workspace_id=workspace_id,
                    artifact_id=artifact_id,
                    experience=experience,
                    tenant_id=tenant_id,
                ) + hint_suffix,
                "pipeline",
            )

    # Fallback: Redirect user to the Microsoft Fabric Monitoring Hub / Workspace
    if workspace_id:
        return (
            f"https://app.fabric.microsoft.com/groups/{workspace_id}/monitoringhub?experience={experience}&ctid={tenant_id}{hint_suffix}",
            "workspace",
        )

    return None, "workspace"


def attach_fabric_urls(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for row in rows:
        url, url_type = build_fabric_run_url(row)
        row["fabricUrl"] = url
        row["fabricUrlType"] = url_type
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
