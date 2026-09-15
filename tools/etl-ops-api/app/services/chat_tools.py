"""Whitelisted tools for the v2 chat agent — maps to queries.py only."""

from __future__ import annotations

import json
from datetime import date
from typing import Any

from app.models.filters import GlobalFilters
from app.services import queries

MAX_TOOL_ROWS = 25

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_daily_kpis",
            "description": "Daily pipeline KPIs: total runs, success %, failed runs, running pipelines, failed bronze sites.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date_from": {"type": "string", "description": "ISO date YYYY-MM-DD"},
                    "start_date_to": {"type": "string", "description": "ISO date YYYY-MM-DD"},
                    "config_name": {"type": "string", "description": "Partial pipeline name filter"},
                    "target_name": {"type": "string", "enum": ["BR", "SL", "GL"]},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_failures",
            "description": "Failed ETL tasks with site, pipeline, task name, and error message.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date_from": {"type": "string"},
                    "start_date_to": {"type": "string"},
                    "lookback_days": {"type": "integer", "description": "Used when dates omitted (1-90)"},
                    "config_name": {"type": "string", "description": "Partial name, e.g. SAMMS Darts or %Darts%"},
                    "site_code": {"type": "string", "description": "SAMMS site code e.g. AHK"},
                    "target_name": {"type": "string", "enum": ["BR", "SL", "GL"]},
                    "limit": {"type": "integer", "maximum": 50},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_running_tasks",
            "description": "Tasks currently in RUNNING status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "config_name": {"type": "string"},
                    "target_name": {"type": "string", "enum": ["BR", "SL", "GL"]},
                    "limit": {"type": "integer", "maximum": 50},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_site_audit",
            "description": "Task audit history for one SAMMS site code (rows read/written, status).",
            "parameters": {
                "type": "object",
                "properties": {
                    "site_code": {"type": "string", "description": "Required site code e.g. AHK"},
                    "start_date_from": {"type": "string"},
                    "start_date_to": {"type": "string"},
                    "lookback_days": {"type": "integer"},
                    "limit": {"type": "integer", "maximum": 50},
                },
                "required": ["site_code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_dq_issues",
            "description": "Data quality rows that did not pass validation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date_from": {"type": "string"},
                    "start_date_to": {"type": "string"},
                    "lookback_days": {"type": "integer"},
                    "config_name": {"type": "string"},
                    "limit": {"type": "integer", "maximum": 50},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pipeline_runs",
            "description": "Recent pipeline layer runs (BR/SL/GL) for a date window.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date_from": {"type": "string"},
                    "start_date_to": {"type": "string"},
                    "lookback_days": {"type": "integer"},
                    "config_name": {"type": "string"},
                    "target_name": {"type": "string", "enum": ["BR", "SL", "GL"]},
                    "status": {"type": "string", "enum": ["SUCCESS", "FAILED", "RUNNING", "SKIPPED"]},
                    "limit": {"type": "integer", "maximum": 50},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_top_failing_pipelines",
            "description": "Pipelines with the most failures in the date window.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date_from": {"type": "string"},
                    "start_date_to": {"type": "string"},
                    "lookback_days": {"type": "integer"},
                    "limit": {"type": "integer", "maximum": 20},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_daily_trends",
            "description": "Daily success vs failure counts over a date range.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date_from": {"type": "string"},
                    "start_date_to": {"type": "string"},
                    "lookback_days": {"type": "integer"},
                    "config_name": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_site_counts",
            "description": "Count of unique sites processing by pipeline and layer with success/failure breakdown.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date_from": {"type": "string"},
                    "start_date_to": {"type": "string"},
                    "lookback_days": {"type": "integer"},
                    "config_name": {"type": "string"},
                    "target_name": {"type": "string", "enum": ["BR", "SL", "GL"]},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_rows_by_pipeline",
            "description": "Total rows read and written by each pipeline (ETL config) over a date window.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date_from": {"type": "string"},
                    "start_date_to": {"type": "string"},
                    "lookback_days": {"type": "integer"},
                    "config_name": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_rows_by_layer",
            "description": "Total rows read and written by each layer (Bronze, Silver, Gold) over a date window.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date_from": {"type": "string"},
                    "start_date_to": {"type": "string"},
                    "lookback_days": {"type": "integer"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_rows_by_site",
            "description": "Total rows read and written by each clinic site (SiteCode) over a date window.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date_from": {"type": "string"},
                    "start_date_to": {"type": "string"},
                    "lookback_days": {"type": "integer"},
                    "config_name": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pipeline_layer_matrix",
            "description": "Rows read/written for each pipeline × layer combination to see cross-layer flow.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date_from": {"type": "string"},
                    "start_date_to": {"type": "string"},
                    "lookback_days": {"type": "integer"},
                    "config_name": {"type": "string"},
                },
            },
        },
    },
]

DEEP_LINKS: dict[str, str] = {
    "get_daily_kpis": "/",
    "get_failures": "/failures",
    "get_running_tasks": "/",
    "get_site_audit": "/failures",
    "get_dq_issues": "/data-quality",
    "get_pipeline_runs": "/pipelines",
    "get_top_failing_pipelines": "/trends",
    "get_daily_trends": "/trends",
    "get_site_counts": "/trends",
    "get_rows_by_pipeline": "/trends",
    "get_rows_by_layer": "/trends",
    "get_rows_by_site": "/failures",
    "get_pipeline_layer_matrix": "/trends",
}

TABLE_COLUMNS: dict[str, list[str]] = {
    "get_failures": ["StartTime", "ConfigName", "SiteCode", "TaskName", "ErrorMessage"],
    "get_running_tasks": ["TaskName", "ConfigName", "SiteCode", "StartTime", "TargetName"],
    "get_site_audit": ["StartTime", "TaskName", "Status", "RowsWritten", "DataBaseName"],
    "get_dq_issues": ["CreatedAt", "TableName", "ValidationStatus", "RowCount", "ConfigName"],
    "get_pipeline_runs": ["ConfigName", "TargetName", "Status", "StartTime", "FailedTasks"],
    "get_top_failing_pipelines": ["ConfigName", "failure_count"],
    "get_site_counts": ["SiteCode", "ConfigName", "TargetName", "task_count", "success_count", "failed_count"],
    "get_rows_by_pipeline": ["ConfigName", "task_count", "total_rows_read", "total_rows_written", "success_count", "failed_count"],
    "get_rows_by_layer": ["TargetName", "task_count", "total_rows_read", "total_rows_written", "success_count", "failed_count"],
    "get_rows_by_site": ["SiteCode", "task_count", "total_rows_read", "total_rows_written", "success_count", "failed_count"],
    "get_pipeline_layer_matrix": ["ConfigName", "TargetName", "task_count", "total_rows_read", "total_rows_written", "success_count"],
}


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value[:10])


def build_filters(
    args: dict[str, Any],
    *,
    ref_date: date | None,
    lookback_days: int,
    start_date_from: date | None,
    start_date_to: date | None,
    limit: int = 20,
) -> GlobalFilters:
    return GlobalFilters(
        ref_date=ref_date,
        lookback_days=min(max(int(args.get("lookback_days") or lookback_days), 1), 90),
        start_date_from=_parse_date(args.get("start_date_from")) or start_date_from,
        start_date_to=_parse_date(args.get("start_date_to")) or start_date_to,
        config_name=args.get("config_name"),
        target_name=args.get("target_name"),
        site_code=args.get("site_code"),
        status=args.get("status"),
        limit=min(max(int(args.get("limit") or limit), 1), MAX_TOOL_ROWS),
    )


def _trim_rows(rows: list[dict[str, Any]], limit: int = MAX_TOOL_ROWS) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in rows[:limit]:
        out.append({k: (v if v is not None else "") for k, v in row.items()})
    return out


def execute_tool(
    name: str,
    args: dict[str, Any],
    *,
    ref_date: date | None,
    lookback_days: int,
    start_date_from: date | None,
    start_date_to: date | None,
) -> dict[str, Any]:
    filters = build_filters(
        args,
        ref_date=ref_date,
        lookback_days=lookback_days,
        start_date_from=start_date_from,
        start_date_to=start_date_to,
    )

    if name == "get_daily_kpis":
        data = queries.today_kpis(filters)
        return {"tool": name, "data": data, "row_count": 1}

    if name == "get_failures":
        rows = _trim_rows(queries.failed_tasks(filters), filters.limit)
        return {"tool": name, "rows": rows, "row_count": len(rows)}

    if name == "get_running_tasks":
        rows = _trim_rows(queries.running_tasks(filters), filters.limit)
        return {"tool": name, "rows": rows, "row_count": len(rows)}

    if name == "get_site_audit":
        site = (args.get("site_code") or "").strip().upper()
        if not site:
            return {"tool": name, "error": "site_code is required"}
        rows = _trim_rows(queries.site_audit_summary(site, filters), filters.limit)
        return {"tool": name, "site_code": site, "rows": rows, "row_count": len(rows)}

    if name == "get_dq_issues":
        rows = _trim_rows(queries.data_quality_issues(filters), filters.limit)
        return {"tool": name, "rows": rows, "row_count": len(rows)}

    if name == "get_pipeline_runs":
        rows = _trim_rows(queries.recent_pipeline_runs(filters), filters.limit)
        return {"tool": name, "rows": rows, "row_count": len(rows)}

    if name == "get_top_failing_pipelines":
        lim = min(max(int(args.get("limit") or 10), 1), 20)
        rows = _trim_rows(queries.top_failing_pipelines(filters, limit=lim), lim)
        return {"tool": name, "rows": rows, "row_count": len(rows)}

    if name == "get_daily_trends":
        rows = _trim_rows(queries.daily_trends(filters), 30)
        return {"tool": name, "rows": rows, "row_count": len(rows)}

    if name == "get_site_counts":
        rows = _trim_rows(queries.site_counts(filters), filters.limit)
        return {"tool": name, "rows": rows, "row_count": len(rows)}

    if name == "get_rows_by_pipeline":
        rows = _trim_rows(queries.rows_by_pipeline(filters), filters.limit)
        return {"tool": name, "rows": rows, "row_count": len(rows)}

    if name == "get_rows_by_layer":
        rows = _trim_rows(queries.rows_by_layer(filters), 10)
        return {"tool": name, "rows": rows, "row_count": len(rows)}

    if name == "get_rows_by_site":
        rows = _trim_rows(queries.rows_by_site(filters), filters.limit)
        return {"tool": name, "rows": rows, "row_count": len(rows)}

    if name == "get_pipeline_layer_matrix":
        rows = _trim_rows(queries.pipeline_layer_matrix(filters), 50)
        return {"tool": name, "rows": rows, "row_count": len(rows)}

    return {"tool": name, "error": f"Unknown tool: {name}"}


def tool_result_json(result: dict[str, Any]) -> str:
    return json.dumps(result, default=str)
