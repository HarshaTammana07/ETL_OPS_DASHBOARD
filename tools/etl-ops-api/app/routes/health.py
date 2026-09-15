from fastapi import APIRouter, Query

from app.models.filters import GlobalFilters
from app.services import queries
from app.services.fabric_links import attach_fabric_urls, build_fabric_run_url, get_fabric_map_summary

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health():
    bounds = queries.get_data_bounds()
    return {"status": "ok", "dataBounds": bounds, "defaultRefDate": queries.get_default_ref_date().isoformat()}


@router.get("/meta/config-names")
def config_names(q: str | None = Query(default=None, description="Partial pipeline name search")):
    return {"items": queries.list_config_names(q)}


@router.get("/meta/source-systems")
def source_systems():
    return {"items": queries.list_source_systems()}


@router.get("/meta/fabric-map")
def fabric_map():
    return get_fabric_map_summary()


@router.get("/meta/fabric-url")
def fabric_url(
    pipeline_run_id: str,
    config_id: str | None = None,
    pipeline_name: str | None = None,
    config_name: str | None = None,
):
    row = {
        "PipelineRunId": pipeline_run_id,
        "ConfigId": config_id or "",
        "PipelineName": pipeline_name or "",
        "ConfigName": config_name or "",
    }
    url = build_fabric_run_url(row)
    return {"fabricUrl": url, "canOpen": url is not None}
