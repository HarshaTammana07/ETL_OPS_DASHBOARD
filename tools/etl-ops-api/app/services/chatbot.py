"""Rule-based chatbot intent router — whitelisted queries only."""

from __future__ import annotations

import re
from typing import Any

from app.models.filters import ChatRequest, GlobalFilters
from app.services import queries


SUGGESTED_PROMPTS = [
    "What failed today?",
    "Failures this week",
    "Which pipelines are still running?",
    "Did site AHK run successfully?",
    "Darts failures this week",
    "Data quality issues",
    "Show today's KPI summary",
    "Help",
]

MODULE_PATTERNS = {
    "darts": "%Darts%",
    "dose": "%Dose%",
    "notes": "%Note%",
    "forms": "%Form%",
    "finance": "%Finance%",
}


NON_SITE_TOKENS = {
    "BR", "SL", "GL", "KPI", "DQ", "ETL", "API", "SAMMS", "HTTP", "CDC", "SQL",
    "PPA", "INV", "FABRIC", "BRONZE", "SILVER", "GOLD", "UUID", "JSON",
}


def _extract_site_code(question: str) -> str | None:
    match = re.search(r"\bsite\s+([A-Za-z0-9]{2,6})\b", question, re.I)
    if match:
        code = match.group(1).upper()
        return code if code not in NON_SITE_TOKENS else None
    match = re.search(r"\b([A-Z]{2,4}\d?[A-Z]?)\b", question)
    if match and match.group(1) not in NON_SITE_TOKENS:
        return match.group(1)
    return None


def _classify_intent(question: str) -> tuple[str, dict[str, Any]]:
    q = question.lower().strip()

    if q in {"help", "?", "what can you ask", "what can i ask", "hi", "hello", "hey"}:
        return "help", {}

    if any(p in q for p in ["still running", "in progress", "running now", "what's running"]):
        return "running_tasks", {}

    if any(p in q for p in ["kpi", "health summary", "how are we doing", "today's summary", "etl health"]):
        return "kpi_summary", {}

    if "data quality" in q or "dq " in q or q.startswith("dq"):
        return "dq_issues", {}

    for module, pattern in MODULE_PATTERNS.items():
        if module in q and ("fail" in q or "error" in q):
            return f"module_failures_{module}", {"config_name": pattern}

    if "fail" in q or "error" in q:
        if any(p in q for p in ["week", "7 day", "7-day", "last 7"]):
            return "failures_week", {"lookback_days": 7}
        return "failures_today", {"lookback_days": 1}

    if "site" in q:
        site = _extract_site_code(question)
        if site:
            return "site_status", {"site_code": site}

    if "row count" in q and "silver" in q:
        return "silver_row_counts", {"config_name": "%Darts%", "target_name": "SL"}

    if "run" in q or "pipeline" in q:
        return "pipeline_status", {}

    return "help", {}


def handle_chat(request: ChatRequest) -> dict[str, Any]:
    intent, slots = _classify_intent(request.question)
    ref_date = request.ref_date or queries.get_default_ref_date()
    lookback = slots.get("lookback_days", request.lookback_days)

    filters = GlobalFilters(
        ref_date=ref_date,
        lookback_days=lookback,
        config_name=slots.get("config_name"),
        target_name=slots.get("target_name"),
        site_code=slots.get("site_code"),
        limit=20,
    )

    if intent == "help":
        return {
            "intent": intent,
            "summary": "I can answer questions about ETL health, failures, running tasks, site status, and data quality. Try one of the suggested prompts.",
            "columns": None,
            "rows": None,
            "deepLink": None,
            "suggestedPrompts": SUGGESTED_PROMPTS,
        }

    if intent == "kpi_summary":
        kpis = queries.today_kpis(filters)
        summary = (
            f"On {kpis['refDate']}: {kpis['totalRuns']} pipeline runs, "
            f"{kpis['successPct']}% success, {kpis['failedRuns']} failed, "
            f"{kpis['runningRuns']} running, {kpis['failedSiteCount']} failed bronze sites."
        )
        return {
            "intent": intent,
            "summary": summary,
            "columns": list(kpis.keys()),
            "rows": [kpis],
            "deepLink": f"/?refDate={kpis['refDate']}",
        }

    if intent == "running_tasks":
        tasks = queries.running_tasks(filters)
        summary = f"{len(tasks)} task(s) currently running."
        return {
            "intent": intent,
            "summary": summary,
            "columns": ["TaskName", "ConfigName", "SiteCode", "StartTime", "TargetName"] if tasks else None,
            "rows": tasks,
            "deepLink": "/",
        }

    if intent in {"failures_today", "failures_week"} or intent.startswith("module_failures_"):
        failures = queries.failed_tasks(filters)
        summary = f"Found {len(failures)} failed task(s) in the lookback window."
        deep = f"/failures?refDate={ref_date.isoformat()}&lookbackDays={lookback}"
        if filters.config_name:
            deep += f"&configName={filters.config_name.replace('%', '')}"
        return {
            "intent": intent,
            "summary": summary,
            "columns": ["StartTime", "ConfigName", "SiteCode", "TaskName", "ErrorMessage"] if failures else None,
            "rows": failures,
            "deepLink": deep,
        }

    if intent == "site_status":
        site = slots.get("site_code") or _extract_site_code(request.question)
        if not site:
            return {
                "intent": intent,
                "summary": "Please specify a site code, e.g. 'Did site AHK run successfully?'",
                "columns": None,
                "rows": None,
                "deepLink": None,
            }
        filters.site_code = site
        audits = queries.site_audit_summary(site, filters)
        if not audits:
            summary = f"No audit records found for site {site} in the last {lookback} days."
        else:
            latest = audits[0]
            summary = (
                f"Latest audit for {site}: {latest.get('TaskName', 'task')} → "
                f"{latest.get('Status', 'UNKNOWN')} at {latest.get('StartTime', 'N/A')} "
                f"({latest.get('RowsWritten', 0)} rows written)."
            )
        return {
            "intent": intent,
            "summary": summary,
            "columns": ["StartTime", "TaskName", "Status", "RowsWritten", "DataBaseName"] if audits else None,
            "rows": audits,
            "deepLink": f"/failures?siteCode={site}",
        }

    if intent == "dq_issues":
        issues = queries.data_quality_issues(filters)
        summary = f"Found {len(issues)} data quality issue(s)."
        return {
            "intent": intent,
            "summary": summary,
            "columns": ["CreatedAt", "TableName", "ValidationStatus", "RowCount", "ConfigName"] if issues else None,
            "rows": issues,
            "deepLink": f"/data-quality?refDate={ref_date.isoformat()}&lookbackDays={lookback}",
        }

    if intent == "silver_row_counts":
        filters.target_name = "SL"
        runs = queries.pipeline_runs(GlobalFilters(**{**filters.model_dump(), "limit": 5}))
        summary = f"Latest silver runs: {len(runs)} found."
        return {
            "intent": intent,
            "summary": summary,
            "columns": ["ConfigName", "Status", "StartTime", "SuccessTasks"] if runs else None,
            "rows": runs,
            "deepLink": "/pipelines",
        }

    if intent == "pipeline_status":
        runs = queries.recent_pipeline_runs(filters)
        summary = f"{len(runs)} pipeline run(s) on {ref_date.isoformat()}."
        return {
            "intent": intent,
            "summary": summary,
            "columns": ["ConfigName", "TargetName", "Status", "StartTime"] if runs else None,
            "rows": runs,
            "deepLink": f"/pipelines?refDate={ref_date.isoformat()}",
        }

    return handle_chat(ChatRequest(question="help", ref_date=ref_date, lookback_days=lookback))
