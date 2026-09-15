"""Teams failure notification ingest + query."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from pydantic import BaseModel

from app.db.notifications import ensure_notifications_table
from app.db.sqlite import get_connection
from app.models.filters import GlobalFilters
from app.services.fabric_links import attach_fabric_urls
from app.services.queries import (
    _clean_site_code,
    _config_name_pattern,
    _date_range_clause,
    _rows_to_dicts,
)


class NotificationIngest(BaseModel):
    status: str = "FAILED"
    pipeline_name: str | None = None
    config_name: str | None = None
    source_system: str | None = None
    target_name: str | None = None
    environment_name: str | None = None
    run_id: str | None = None
    pipeline_run_id: str | None = None
    failed_count: int = 0
    success_count: int = 0
    start_time: str | None = None
    end_time: str | None = None
    error_summary: str | None = None
    failure_details: str | None = None
    title: str | None = None
    summary: str | None = None
    source: str = "teams_webhook"


def _normalize_status(status: str | None) -> str:
    value = (status or "FAILED").strip().upper()
    if value in ("FAILED", "FAILURE", "ERROR"):
        return "FAILED"
    if value in ("SUCCEEDED", "SUCCESS", "COMPLETED"):
        return "SUCCESS"
    return value


def _layer_label(target_name: str | None) -> str:
    mapping = {"BR": "Bronze", "SL": "Silver", "GL": "Gold", "ALL": "Bronze/Silver/Gold"}
    key = (target_name or "").strip().upper()
    return mapping.get(key, target_name or "—")


def _display_config(config_name: str | None) -> str:
    return (config_name or "").replace(" Pipeline", "").replace(" pipeline", "")


def _build_title(payload: NotificationIngest) -> str:
    if payload.title:
        return payload.title
    env = payload.environment_name or "Fabric"
    layer = _layer_label(payload.target_name)
    source = payload.source_system or "Unknown"
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    return f"{env}: Failed - {source} - {layer} - {stamp}"


def _build_summary(payload: NotificationIngest) -> str:
    if payload.summary:
        return payload.summary
    return f"Pipeline Failed - {payload.pipeline_name or payload.config_name or 'ETL'}"


def ingest_notification(payload: NotificationIngest) -> dict[str, Any]:
    """Store a failure notification (Teams dual-write). Success payloads are ignored."""
    ensure_notifications_table()
    status = _normalize_status(payload.status)
    if status != "FAILED":
        return {"stored": False, "reason": "failures_only", "status": status}

    title = _build_title(payload)
    summary = _build_summary(payload)

    with get_connection() as conn:
        ensure_notifications_table(conn)
        # Dedupe same run failure within a short window
        if payload.run_id:
            existing = conn.execute(
                """
                SELECT Id FROM notifications
                WHERE Status = 'FAILED' AND RunId = ?
                  AND datetime(CreatedAt) >= datetime('now', '-2 hours')
                ORDER BY Id DESC LIMIT 1
                """,
                (payload.run_id,),
            ).fetchone()
            if existing:
                return {"stored": False, "reason": "duplicate", "id": existing["Id"]}

        cur = conn.execute(
            """
            INSERT INTO notifications (
                Status, PipelineName, ConfigName, SourceSystem, TargetName, EnvironmentName,
                RunId, PipelineRunId, FailedCount, SuccessCount, StartTime, EndTime,
                ErrorSummary, FailureDetails, Title, Summary, Source, CreatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """,
            (
                status,
                payload.pipeline_name or "",
                payload.config_name or "",
                payload.source_system or "",
                payload.target_name or "",
                payload.environment_name or "",
                payload.run_id or "",
                payload.pipeline_run_id or "",
                payload.failed_count or 0,
                payload.success_count or 0,
                payload.start_time or "",
                payload.end_time or "",
                (payload.error_summary or "")[:4000],
                (payload.failure_details or "")[:12000],
                title,
                summary,
                payload.source or "teams_webhook",
            ),
        )
        conn.commit()
        return {"stored": True, "id": cur.lastrowid, "status": status}


def list_notifications(filters: GlobalFilters, *, limit: int = 50, offset: int = 0) -> dict[str, Any]:
    ensure_notifications_table()
    date_sql, date_params = _date_range_clause("COALESCE(NULLIF(StartTime,''), CreatedAt)", filters)

    clauses = ["Status = 'FAILED'", date_sql]
    params: list[Any] = list(date_params)

    pattern = _config_name_pattern(filters.config_name)
    if pattern:
        clauses.append("ConfigName LIKE ? COLLATE NOCASE")
        params.append(pattern)
    if filters.target_name:
        clauses.append("TargetName = ?")
        params.append(filters.target_name)
    if filters.source_system:
        clauses.append("SourceSystem LIKE ?")
        params.append(f"%{filters.source_system}%")

    where = " AND ".join(clauses)

    with get_connection() as conn:
        ensure_notifications_table(conn)
        total = conn.execute(
            f"SELECT COUNT(*) AS cnt FROM notifications WHERE {where}",
            params,
        ).fetchone()["cnt"]

        rows = conn.execute(
            f"""
            SELECT Id, Status, PipelineName, ConfigName, SourceSystem, TargetName, EnvironmentName,
                   RunId, PipelineRunId, FailedCount, SuccessCount, StartTime, EndTime,
                   ErrorSummary, FailureDetails, Title, Summary, Source, CreatedAt
            FROM notifications
            WHERE {where}
            ORDER BY COALESCE(NULLIF(EndTime,''), NULLIF(StartTime,''), CreatedAt) DESC
            LIMIT ? OFFSET ?
            """,
            params + [limit, offset],
        ).fetchall()

    items = attach_fabric_urls(_rows_to_dicts(rows))
    return {"items": items, "total": int(total or 0), "limit": limit, "offset": offset}


def notification_summary(filters: GlobalFilters) -> dict[str, Any]:
    ensure_notifications_table()
    date_sql, date_params = _date_range_clause("COALESCE(NULLIF(StartTime,''), CreatedAt)", filters)

    clauses = ["Status = 'FAILED'", date_sql]
    params: list[Any] = list(date_params)
    pattern = _config_name_pattern(filters.config_name)
    if pattern:
        clauses.append("ConfigName LIKE ? COLLATE NOCASE")
        params.append(pattern)
    if filters.target_name:
        clauses.append("TargetName = ?")
        params.append(filters.target_name)

    where = " AND ".join(clauses)

    with get_connection() as conn:
        ensure_notifications_table(conn)
        row = conn.execute(
            f"""
            SELECT
                COUNT(*) AS total_alerts,
                COUNT(DISTINCT ConfigName) AS pipelines,
                SUM(COALESCE(FailedCount, 0)) AS failed_tasks,
                SUM(CASE WHEN TargetName IN ('BR','BRZ') THEN 1 ELSE 0 END) AS bronze,
                SUM(CASE WHEN TargetName = 'SL' THEN 1 ELSE 0 END) AS silver,
                SUM(CASE WHEN TargetName = 'GL' THEN 1 ELSE 0 END) AS gold
            FROM notifications
            WHERE {where}
            """,
            params,
        ).fetchone()

    return {
        "totalAlerts": row["total_alerts"] or 0,
        "pipelines": row["pipelines"] or 0,
        "failedTasks": row["failed_tasks"] or 0,
        "byLayer": {
            "BR": row["bronze"] or 0,
            "SL": row["silver"] or 0,
            "GL": row["gold"] or 0,
        },
    }


def backfill_from_audit(filters: GlobalFilters, *, limit: int = 200) -> dict[str, Any]:
    """
    Seed failure alerts from pipelinerun/taskaudit for a date window.
    Used because Teams webhooks cannot be queried for past messages.
    """
    ensure_notifications_table()
    date_sql, date_params = _date_range_clause("pr.StartTime", filters)

    with get_connection() as conn:
        ensure_notifications_table(conn)
        runs = conn.execute(
            f"""
            SELECT pr.RunId, pr.PipelineRunId, pr.ConfigName, pr.PipelineName, pr.SourceSystem,
                   pr.TargetName, pr.Status, pr.StartTime, pr.EndTime, pr.FailedTasks
            FROM pipelinerun pr
            WHERE pr.Status = 'FAILED' AND {date_sql}
            ORDER BY pr.StartTime DESC
            LIMIT ?
            """,
            date_params + [limit],
        ).fetchall()

        inserted = 0
        skipped = 0
        for run in runs:
            run_id = run["RunId"] or ""
            if run_id:
                exists = conn.execute(
                    "SELECT 1 FROM notifications WHERE RunId = ? AND Status = 'FAILED' LIMIT 1",
                    (run_id,),
                ).fetchone()
                if exists:
                    skipped += 1
                    continue

            err_row = conn.execute(
                """
                SELECT TaskName, ErrorMessage, SiteCode
                FROM taskaudit
                WHERE Status = 'FAILED' AND (RunId = ? OR PipelineRunId = ?)
                  AND ErrorMessage IS NOT NULL AND TRIM(ErrorMessage) != ''
                ORDER BY StartTime DESC
                LIMIT 3
                """,
                (run_id, run["PipelineRunId"] or ""),
            ).fetchall()

            details_parts = []
            for i, err in enumerate(err_row, start=1):
                site = _clean_site_code(err["SiteCode"])
                site_bit = f" [{site}]" if site else ""
                details_parts.append(
                    f"Failure {i}\n\nTask Name : {err['TaskName']}{site_bit}\n\nError :\n{(err['ErrorMessage'] or '')[:1500]}\n"
                )
            error_summary = (err_row[0]["ErrorMessage"][:500] if err_row else "Pipeline failed.")
            failure_details = "\n--------------------------------------------------\n".join(details_parts) if details_parts else error_summary

            target = run["TargetName"] or ""
            env = "BHG-DATA-PLATFORM-CORE-DEV"
            title = (
                f"{env}: Failed - {run['SourceSystem'] or 'Unknown'} - "
                f"{_layer_label(target)} - {(run['EndTime'] or run['StartTime'] or '')[:19].replace('T', ' ')}"
            )

            conn.execute(
                """
                INSERT INTO notifications (
                    Status, PipelineName, ConfigName, SourceSystem, TargetName, EnvironmentName,
                    RunId, PipelineRunId, FailedCount, SuccessCount, StartTime, EndTime,
                    ErrorSummary, FailureDetails, Title, Summary, Source, CreatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 'audit_backfill', ?)
                """,
                (
                    "FAILED",
                    run["PipelineName"] or "",
                    run["ConfigName"] or "",
                    run["SourceSystem"] or "",
                    target,
                    env,
                    run_id,
                    run["PipelineRunId"] or "",
                    int(run["FailedTasks"] or 0) or 1,
                    run["StartTime"] or "",
                    run["EndTime"] or "",
                    error_summary,
                    failure_details[:12000],
                    title,
                    f"Pipeline Failed - {run['PipelineName'] or run['ConfigName']}",
                    run["EndTime"] or run["StartTime"] or datetime.now(timezone.utc).isoformat(),
                ),
            )
            inserted += 1
        conn.commit()

    return {"inserted": inserted, "skipped": skipped, "scanned": len(runs)}
