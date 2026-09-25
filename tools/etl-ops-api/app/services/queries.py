from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from app.db.sqlite import get_connection
from app.models.filters import GlobalFilters
from app.services.fabric_links import attach_fabric_urls


def _rows_to_dicts(rows: list) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


def _resolve_date_range(filters: GlobalFilters) -> tuple[date, date]:
    """Resolve inclusive start/end dates from from/to fields or legacy ref_date + lookback."""
    if filters.start_date_from and filters.start_date_to:
        start, end = filters.start_date_from, filters.start_date_to
        if start > end:
            start, end = end, start
        return start, end
    if filters.start_date_to:
        return filters.start_date_to, filters.start_date_to
    if filters.start_date_from:
        return filters.start_date_from, filters.start_date_from

    end = filters.ref_date or get_default_ref_date()
    if filters.lookback_days <= 1:
        return end, end
    start = end - timedelta(days=filters.lookback_days - 1)
    return start, end


def _date_range_clause(column: str, filters: GlobalFilters) -> tuple[str, list]:
    start, end = _resolve_date_range(filters)
    if start == end:
        return f"date({column}) = ?", [start.isoformat()]
    return f"date({column}) BETWEEN ? AND ?", [start.isoformat(), end.isoformat()]


def _config_name_pattern(config_name: str | None) -> str | None:
    if not config_name:
        return None
    term = config_name.strip()
    if not term:
        return None
    return term if "%" in term else f"%{term}%"


def _filter_clause(filters: GlobalFilters, prefix: str = "pr") -> tuple[str, list]:
    clauses: list[str] = []
    params: list[Any] = []

    pattern = _config_name_pattern(filters.config_name)
    if pattern:
        clauses.append(f"{prefix}.ConfigName LIKE ? COLLATE NOCASE")
        params.append(pattern)

    if filters.target_name:
        clauses.append(f"{prefix}.TargetName = ?")
        params.append(filters.target_name)

    if filters.source_system:
        clauses.append(f"{prefix}.SourceSystem LIKE ?")
        params.append(f"%{filters.source_system}%")

    if filters.status:
        clauses.append(f"{prefix}.Status = ?")
        params.append(filters.status)

    if filters.site_code:
        clauses.append(
            "EXISTS (SELECT 1 FROM taskaudit ta WHERE ta.RunId = pr.RunId AND ta.SiteCode LIKE ?)"
        )
        params.append(f"%{filters.site_code}%")

    if not clauses:
        return "", []
    return " AND " + " AND ".join(clauses), params


def _is_run_scoped(filters: GlobalFilters) -> bool:
    return bool(filters.pipeline_run_id or filters.run_id)


def _run_id_match(column: str, value: str) -> tuple[str, list[Any]]:
    """Exact match for full GUIDs; partial LIKE otherwise."""
    v = (value or "").strip()
    if not v:
        return "1=1", []
    compact = v.replace("-", "")
    if len(compact) >= 32:
        return f"{column} = ?", [v]
    pattern = v if "%" in v else f"%{v}%"
    return f"CAST({column} AS TEXT) LIKE ?", [pattern]


def _pipelinerun_where(filters: GlobalFilters) -> tuple[str, list[Any]]:
    """Date window or single-run scope for pipelinerun queries."""
    extra_sql, extra_params = _filter_clause(filters)
    if filters.pipeline_run_id:
        id_sql, id_params = _run_id_match("pr.PipelineRunId", filters.pipeline_run_id)
        return f"{id_sql}{extra_sql}", id_params + extra_params
    if filters.run_id:
        id_sql, id_params = _run_id_match("pr.RunId", filters.run_id)
        return f"{id_sql}{extra_sql}", id_params + extra_params
    date_sql, date_params = _date_range_clause("pr.StartTime", filters)
    return f"{date_sql}{extra_sql}", date_params + extra_params


def _taskaudit_where(filters: GlobalFilters) -> tuple[str, list[Any]]:
    """Date window or single-run scope for taskaudit (+ optional pr filters)."""
    extra_sql, extra_params = _taskaudit_filter_clause(filters)
    if filters.pipeline_run_id:
        return f"ta.PipelineRunId = ?{extra_sql}", [filters.pipeline_run_id] + extra_params
    if filters.run_id:
        return f"ta.RunId = ?{extra_sql}", [filters.run_id] + extra_params
    date_sql, date_params = _date_range_clause("ta.StartTime", filters)
    return f"{date_sql}{extra_sql}", date_params + extra_params


def get_run_scope_context(filters: GlobalFilters) -> dict[str, Any] | None:
    """Metadata for a single parent run or layer run scope."""
    if not _is_run_scoped(filters):
        return None

    where_sql, params = _pipelinerun_where(filters)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT RunId, PipelineRunId, ConfigId, ConfigName, PipelineName, TargetName,
                   Status, StartTime, EndTime, SuccessTasks, FailedTasks, TotalTasks,
                   CASE
                     WHEN StartTime != '' AND EndTime != ''
                     THEN CAST((julianday(EndTime) - julianday(StartTime)) * 86400 AS INTEGER)
                     ELSE NULL
                   END AS duration_seconds
            FROM pipelinerun pr
            WHERE {where_sql}
            ORDER BY CASE TargetName WHEN 'BR' THEN 1 WHEN 'BRZ' THEN 1 WHEN 'SL' THEN 2 WHEN 'GL' THEN 3 ELSE 4 END,
                     StartTime
            """,
            params,
        ).fetchall()

    if not rows:
        return None

    layers = attach_fabric_urls(_rows_to_dicts(rows))
    first = layers[0]
    starts = [r["StartTime"] for r in layers if r.get("StartTime")]
    ends = [r["EndTime"] for r in layers if r.get("EndTime")]
    return {
        "pipelineRunId": first.get("PipelineRunId") or filters.pipeline_run_id,
        "runId": first.get("RunId") if filters.run_id else None,
        "scopedRunId": filters.run_id,
        "layerCount": len(layers),
        "configNames": sorted({r["ConfigName"] for r in layers if r.get("ConfigName")}),
        "startTime": min(starts) if starts else None,
        "endTime": max(ends) if ends else None,
        "layers": layers,
    }


def get_default_ref_date() -> date:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT MAX(date(StartTime)) AS max_date FROM pipelinerun WHERE StartTime != ''"
        ).fetchone()
    if row and row["max_date"]:
        return date.fromisoformat(row["max_date"])
    return date.today()


def get_data_bounds() -> dict[str, str | None]:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT MIN(date(StartTime)) AS min_date, MAX(date(StartTime)) AS max_date
            FROM pipelinerun WHERE StartTime != ''
            """
        ).fetchone()
    return {
        "minDate": row["min_date"] if row else None,
        "maxDate": row["max_date"] if row else None,
    }


def today_kpis(filters: GlobalFilters) -> dict[str, Any]:
    start, end = _resolve_date_range(filters)
    date_sql, date_params = _date_range_clause("StartTime", filters)
    extra_sql, extra_params = _filter_clause(filters)

    with get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT
                COUNT(*) AS total_runs,
                SUM(CASE WHEN Status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
                SUM(CASE WHEN Status = 'FAILED' THEN 1 ELSE 0 END) AS failed_runs,
                COUNT(DISTINCT ConfigId) AS total_configs
            FROM pipelinerun pr
            WHERE {date_sql}{extra_sql}
            """,
            date_params + extra_params,
        ).fetchone()

        running = conn.execute(
            f"""
            SELECT COUNT(DISTINCT pr.ConfigId) AS cnt
            FROM pipelinerun pr
            WHERE pr.Status = 'RUNNING'
              AND {date_sql}{extra_sql}
            """,
            date_params + extra_params,
        ).fetchone()

        failed_sites = conn.execute(
            f"""
            SELECT COUNT(DISTINCT tq.SiteCode) AS cnt
            FROM taskqueue tq
            JOIN pipelinerun pr ON pr.RunId = tq.RunId
            WHERE tq.Status = 'FAILED'
              AND pr.TargetName = 'BR'
              AND tq.SiteCode != ''
              AND {date_sql.replace('StartTime', 'pr.StartTime')}{extra_sql}
            """,
            date_params + extra_params,
        ).fetchone()

    total = row["total_runs"] or 0
    success = row["success_count"] or 0
    failed = row["failed_runs"] or 0
    total_configs = row["total_configs"] or 0
    running_count = running["cnt"] or 0
    success_pct = round((success / total * 100) if total else 0, 1)
    failed_pct = round((failed / total * 100) if total else 0, 1)
    running_pct = round((running_count / total_configs * 100) if total_configs else 0, 1)

    return {
        "startDateFrom": start.isoformat(),
        "startDateTo": end.isoformat(),
        "refDate": end.isoformat(),
        "totalRuns": total,
        "successPct": success_pct,
        "failedRuns": failed,
        "failedPct": failed_pct,
        "runningRuns": running_count,
        "runningPct": running_pct,
        "failedSiteCount": failed_sites["cnt"] or 0,
    }


def running_tasks(filters: GlobalFilters) -> list[dict[str, Any]]:
    extra_sql, extra_params = _filter_clause(filters, "pr")
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT tq.TaskId, tq.TaskName, tq.SiteCode, tq.DataBaseName,
                   tq.StartTime, pr.ConfigId, pr.ConfigName, pr.PipelineName,
                   pr.PipelineRunId, pr.TargetName
            FROM taskqueue tq
            JOIN pipelinerun pr ON pr.RunId = tq.RunId
            WHERE tq.Status = 'RUNNING'{extra_sql}
            ORDER BY tq.StartTime DESC
            LIMIT ?
            """,
            extra_params + [filters.limit],
        ).fetchall()
    return attach_fabric_urls(_rows_to_dicts(rows))


def _recent_runs_search_clause(q: str | None) -> tuple[str, list[Any]]:
    """Optional free-text search across pipeline name / run ids."""
    term = (q or "").strip()
    if not term:
        return "", []
    pattern = term if "%" in term else f"%{term}%"
    return (
        " AND (pr.ConfigName LIKE ? COLLATE NOCASE"
        " OR pr.PipelineName LIKE ? COLLATE NOCASE"
        " OR CAST(pr.PipelineRunId AS TEXT) LIKE ?"
        " OR CAST(pr.RunId AS TEXT) LIKE ?)",
        [pattern, pattern, pattern, pattern],
    )


def _recent_runs_where(filters: GlobalFilters, q: str | None = None) -> tuple[str, list[Any]]:
    if filters.pipeline_run_id or filters.run_id:
        where_sql, params = _pipelinerun_where(filters)
    else:
        date_sql, date_params = _date_range_clause("pr.StartTime", filters)
        extra_sql, extra_params = _filter_clause(filters)
        where_sql = date_sql + extra_sql
        params = date_params + extra_params
    search_sql, search_params = _recent_runs_search_clause(q)
    return where_sql + search_sql, params + search_params


def recent_pipeline_runs(filters: GlobalFilters, q: str | None = None) -> list[dict[str, Any]]:
    where_sql, params = _recent_runs_where(filters, q)

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT pr.RunId, pr.PipelineRunId, pr.ConfigId, pr.ConfigName, pr.PipelineName,
                   pr.TargetName, pr.SourceSystem, pr.Status, pr.StartTime, pr.EndTime,
                   pr.SuccessTasks, pr.FailedTasks, pr.TotalTasks
            FROM pipelinerun pr
            WHERE {where_sql}
            ORDER BY pr.StartTime DESC
            LIMIT ? OFFSET ?
            """,
            params + [filters.limit, filters.offset],
        ).fetchall()
    return attach_fabric_urls(_rows_to_dicts(rows))


def count_recent_pipeline_runs(filters: GlobalFilters, q: str | None = None) -> int:
    where_sql, params = _recent_runs_where(filters, q)

    with get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT COUNT(*) AS cnt
            FROM pipelinerun pr
            WHERE {where_sql}
            """,
            params,
        ).fetchone()
    return int(row["cnt"] or 0)


def daily_trends(filters: GlobalFilters) -> list[dict[str, Any]]:
    where_sql, params = _pipelinerun_where(filters)

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT
                date(StartTime) AS run_date,
                SUM(CASE WHEN Status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_runs,
                SUM(CASE WHEN Status = 'FAILED' THEN 1 ELSE 0 END) AS failed_runs,
                SUM(CASE WHEN Status = 'RUNNING' THEN 1 ELSE 0 END) AS running_runs,
                COUNT(*) AS total_runs,
                AVG(
                    CASE
                      WHEN StartTime != '' AND EndTime != ''
                      THEN (julianday(EndTime) - julianday(StartTime)) * 86400
                      ELSE NULL
                    END
                ) AS avg_duration_sec
            FROM pipelinerun pr
            WHERE {where_sql}
            GROUP BY date(StartTime)
            ORDER BY run_date
            """,
            params,
        ).fetchall()

    points = []
    for row in rows:
        total = row["total_runs"] or 0
        success = row["success_runs"] or 0
        avg_dur = row["avg_duration_sec"]
        points.append(
            {
                "runDate": row["run_date"],
                "successRuns": success,
                "failedRuns": row["failed_runs"] or 0,
                "runningRuns": row["running_runs"] or 0,
                "totalRuns": total,
                "successPct": round((success / total * 100) if total else 0, 1),
                "avgDurationSec": round(float(avg_dur), 1) if avg_dur is not None else None,
            }
        )
    return points


def reliability_summary(filters: GlobalFilters) -> dict[str, Any]:
    where_sql, params = _pipelinerun_where(filters)

    with get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT
                COUNT(*) AS total_runs,
                SUM(CASE WHEN Status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_runs,
                SUM(CASE WHEN Status = 'FAILED' THEN 1 ELSE 0 END) AS failed_runs,
                SUM(CASE WHEN Status = 'RUNNING' THEN 1 ELSE 0 END) AS running_runs,
                AVG(
                    CASE
                      WHEN StartTime != '' AND EndTime != ''
                      THEN (julianday(EndTime) - julianday(StartTime)) * 86400
                      ELSE NULL
                    END
                ) AS avg_duration_sec,
                SUM(
                    CASE
                      WHEN CAST(AttemptNumber AS INTEGER) >= 2 THEN 1
                      ELSE 0
                    END
                ) AS retried_runs
            FROM pipelinerun pr
            WHERE {where_sql}
            """,
            params,
        ).fetchone()

    total = row["total_runs"] or 0
    success = row["success_runs"] or 0
    failed = row["failed_runs"] or 0
    avg_dur = row["avg_duration_sec"]
    return {
        "totalRuns": total,
        "successRuns": success,
        "failedRuns": failed,
        "runningRuns": row["running_runs"] or 0,
        "successPct": round((success / total * 100) if total else 0, 1),
        "failedPct": round((failed / total * 100) if total else 0, 1),
        "avgDurationSec": round(float(avg_dur), 1) if avg_dur is not None else None,
        "retriedRuns": row["retried_runs"] or 0,
    }


def duration_by_layer(filters: GlobalFilters) -> dict[str, Any]:
    """Average completed-run duration by layer for the window (and per day series)."""
    where_sql, params = _pipelinerun_where(filters)

    with get_connection() as conn:
        overall = conn.execute(
            f"""
            SELECT
                CASE
                  WHEN TargetName IN ('BR', 'BRZ') THEN 'BR'
                  WHEN TargetName = 'SL' THEN 'SL'
                  WHEN TargetName = 'GL' THEN 'GL'
                  ELSE 'OTHER'
                END AS layer,
                ROUND(AVG((julianday(EndTime) - julianday(StartTime)) * 86400), 1) AS avg_duration_sec,
                COUNT(*) AS run_count
            FROM pipelinerun pr
            WHERE StartTime != '' AND EndTime != ''
              AND {where_sql}
            GROUP BY layer
            ORDER BY CASE layer WHEN 'BR' THEN 1 WHEN 'SL' THEN 2 WHEN 'GL' THEN 3 ELSE 4 END
            """,
            params,
        ).fetchall()

        daily = conn.execute(
            f"""
            SELECT
                date(StartTime) AS run_date,
                CASE
                  WHEN TargetName IN ('BR', 'BRZ') THEN 'BR'
                  WHEN TargetName = 'SL' THEN 'SL'
                  WHEN TargetName = 'GL' THEN 'GL'
                  ELSE 'OTHER'
                END AS layer,
                ROUND(AVG((julianday(EndTime) - julianday(StartTime)) * 86400), 1) AS avg_duration_sec
            FROM pipelinerun pr
            WHERE StartTime != '' AND EndTime != ''
              AND {where_sql}
            GROUP BY date(StartTime), layer
            ORDER BY run_date, layer
            """,
            params,
        ).fetchall()

    by_date: dict[str, dict[str, Any]] = {}
    for row in daily:
        d = row["run_date"]
        point = by_date.setdefault(d, {"runDate": d, "BR": None, "SL": None, "GL": None, "OTHER": None})
        point[row["layer"]] = row["avg_duration_sec"]

    return {
        "byLayer": [
            {
                "layer": r["layer"],
                "avgDurationSec": r["avg_duration_sec"],
                "runCount": r["run_count"],
            }
            for r in overall
        ],
        "daily": list(by_date.values()),
    }

def failures_by_layer(filters: GlobalFilters) -> list[dict[str, Any]]:
    where_sql, params = _pipelinerun_where(filters)

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT
                CASE
                  WHEN TargetName IN ('BR', 'BRZ') THEN 'BR'
                  WHEN TargetName = 'SL' THEN 'SL'
                  WHEN TargetName = 'GL' THEN 'GL'
                  ELSE 'OTHER'
                END AS layer,
                SUM(CASE WHEN Status = 'FAILED' THEN 1 ELSE 0 END) AS failed_runs,
                COUNT(*) AS total_runs
            FROM pipelinerun pr
            WHERE {where_sql}
            GROUP BY layer
            ORDER BY CASE layer WHEN 'BR' THEN 1 WHEN 'SL' THEN 2 WHEN 'GL' THEN 3 ELSE 4 END
            """,
            params,
        ).fetchall()

    out = []
    for row in rows:
        total = row["total_runs"] or 0
        failed = row["failed_runs"] or 0
        out.append(
            {
                "layer": row["layer"],
                "failedRuns": failed,
                "totalRuns": total,
                "failedPct": round((failed / total * 100) if total else 0, 1),
            }
        )
    return out


def _taskaudit_filter_clause(filters: GlobalFilters) -> tuple[str, list[Any]]:
    """Join filters for taskaudit + pipelinerun (alias ta / pr)."""
    clauses: list[str] = []
    params: list[Any] = []
    pattern = _config_name_pattern(filters.config_name)
    if pattern:
        clauses.append("pr.ConfigName LIKE ? COLLATE NOCASE")
        params.append(pattern)
    if filters.target_name:
        clauses.append("pr.TargetName = ?")
        params.append(filters.target_name)
    if filters.source_system:
        clauses.append("pr.SourceSystem LIKE ?")
        params.append(f"%{filters.source_system}%")
    if filters.site_code:
        clauses.append("ta.SiteCode LIKE ?")
        params.append(f"%{filters.site_code}%")
    if not clauses:
        return "", []
    return " AND " + " AND ".join(clauses), params


def daily_task_trends(filters: GlobalFilters) -> list[dict[str, Any]]:
    where_sql, params = _taskaudit_where(filters)

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT
                date(ta.StartTime) AS run_date,
                SUM(CASE WHEN ta.Status = 'FAILED' THEN 1 ELSE 0 END) AS failed_tasks,
                SUM(CASE WHEN ta.Status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_tasks,
                COUNT(*) AS total_tasks,
                SUM(COALESCE(CAST(ta.RowsRead AS INTEGER), 0)) AS rows_read,
                SUM(COALESCE(CAST(ta.RowsWritten AS INTEGER), 0)) AS rows_written
            FROM taskaudit ta
            JOIN pipelinerun pr ON pr.RunId = ta.RunId
            WHERE {where_sql}
            GROUP BY date(ta.StartTime)
            ORDER BY run_date
            """,
            params,
        ).fetchall()

    points = []
    for row in rows:
        total = row["total_tasks"] or 0
        failed = row["failed_tasks"] or 0
        points.append(
            {
                "runDate": row["run_date"],
                "failedTasks": failed,
                "successTasks": row["success_tasks"] or 0,
                "totalTasks": total,
                "failedTaskPct": round((failed / total * 100) if total else 0, 1),
                "rowsRead": row["rows_read"] or 0,
                "rowsWritten": row["rows_written"] or 0,
            }
        )
    return points


def task_activity_summary(filters: GlobalFilters) -> dict[str, Any]:
    where_sql, params = _taskaudit_where(filters)

    with get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT
                COUNT(*) AS total_tasks,
                SUM(CASE WHEN ta.Status = 'FAILED' THEN 1 ELSE 0 END) AS failed_tasks,
                SUM(CASE WHEN ta.Status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_tasks,
                SUM(COALESCE(CAST(ta.RowsRead AS INTEGER), 0)) AS rows_read,
                SUM(COALESCE(CAST(ta.RowsWritten AS INTEGER), 0)) AS rows_written,
                COUNT(DISTINCT CASE
                    WHEN ta.Status = 'FAILED' AND ta.SiteCode IS NOT NULL AND TRIM(ta.SiteCode) != ''
                    THEN ta.SiteCode
                END) AS failing_site_raw_count
            FROM taskaudit ta
            JOIN pipelinerun pr ON pr.RunId = ta.RunId
            WHERE {where_sql}
            """,
            params,
        ).fetchone()

        site_rows = conn.execute(
            f"""
            SELECT ta.SiteCode
            FROM taskaudit ta
            JOIN pipelinerun pr ON pr.RunId = ta.RunId
            WHERE ta.Status = 'FAILED'
              AND {where_sql}
            """,
            params,
        ).fetchall()

    clean_sites = {_clean_site_code(s["SiteCode"]) for s in site_rows}
    clean_sites.discard("")

    total = row["total_tasks"] or 0
    failed = row["failed_tasks"] or 0
    return {
        "totalTasks": total,
        "failedTasks": failed,
        "successTasks": row["success_tasks"] or 0,
        "failedTaskPct": round((failed / total * 100) if total else 0, 1),
        "rowsRead": row["rows_read"] or 0,
        "rowsWritten": row["rows_written"] or 0,
        "failingSites": len(clean_sites),
    }


def top_failing_sites(filters: GlobalFilters, limit: int = 10) -> list[dict[str, Any]]:
    where_sql, params = _taskaudit_where(filters)

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT ta.SiteCode, pr.ConfigName, ta.StartTime
            FROM taskaudit ta
            JOIN pipelinerun pr ON pr.RunId = ta.RunId
            WHERE ta.Status = 'FAILED'
              AND {where_sql}
            """,
            params,
        ).fetchall()

    buckets: dict[str, dict[str, Any]] = {}
    for row in rows:
        site = _clean_site_code(row["SiteCode"])
        if not site:
            continue
        bucket = buckets.setdefault(
            site,
            {"SiteCode": site, "failureCount": 0, "pipelines": set(), "lastFailure": ""},
        )
        bucket["failureCount"] += 1
        if row["ConfigName"]:
            bucket["pipelines"].add(row["ConfigName"])
        start = row["StartTime"] or ""
        if start > (bucket["lastFailure"] or ""):
            bucket["lastFailure"] = start

    cleaned = [
        {
            "SiteCode": b["SiteCode"],
            "failureCount": b["failureCount"],
            "pipelineCount": len(b["pipelines"]),
            "lastFailure": b["lastFailure"],
        }
        for b in buckets.values()
    ]
    cleaned.sort(key=lambda x: x["failureCount"], reverse=True)
    return cleaned[:limit]


def top_failing_pipelines(filters: GlobalFilters, limit: int = 10) -> list[dict[str, Any]]:
    date_sql, date_params = _date_range_clause("StartTime", filters)
    extra_sql, extra_params = _filter_clause(filters)

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT ConfigName, COUNT(*) AS failure_count
            FROM pipelinerun pr
            WHERE Status = 'FAILED'
              AND {date_sql}{extra_sql}
            GROUP BY ConfigName
            ORDER BY failure_count DESC
            LIMIT ?
            """,
            date_params + extra_params + [limit],
        ).fetchall()
    return _rows_to_dicts(rows)


def pipelines_overview(filters: GlobalFilters) -> list[dict[str, Any]]:
    date_sql, date_params = _date_range_clause("pr.StartTime", filters)

    config_filter = " AND ec.ConfigName != '' AND length(ec.ConfigId) <= 12"
    config_params: list[Any] = []
    pattern = _config_name_pattern(filters.config_name)
    if pattern:
        config_filter += " AND ec.ConfigName LIKE ? COLLATE NOCASE"
        config_params.append(pattern)
    if filters.target_name:
        config_filter += " AND ec.TargetName = ?"
        config_params.append(filters.target_name)
    if filters.source_system:
        config_filter += " AND ec.SourceSystem LIKE ?"
        config_params.append(f"%{filters.source_system}%")

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT
                ec.ConfigId,
                ec.ConfigName,
                ec.SourceSystem,
                ec.TargetName,
                ec.IsActive,
                COUNT(DISTINCT pr.RunId) AS runs_in_window,
                SUM(CASE WHEN pr.Status = 'FAILED' THEN 1 ELSE 0 END) AS failed_runs,
                MAX(pr.StartTime) AS last_run
            FROM etlconfig ec
            LEFT JOIN pipelinerun pr
                ON pr.ConfigId = ec.ConfigId
               AND {date_sql}
            WHERE 1=1{config_filter}
            GROUP BY ec.ConfigId, ec.ConfigName, ec.SourceSystem, ec.TargetName, ec.IsActive
            ORDER BY runs_in_window DESC, ec.ConfigName, ec.TargetName
            """,
            date_params + config_params,
        ).fetchall()
    return _rows_to_dicts(rows)


def pipeline_runs(filters: GlobalFilters) -> list[dict[str, Any]]:
    date_sql, date_params = _date_range_clause("pr.StartTime", filters)
    extra_sql, extra_params = _filter_clause(filters)

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT pr.RunId, pr.PipelineRunId, pr.ConfigId, pr.ConfigName, pr.PipelineName,
                   pr.TargetName, pr.Status, pr.StartTime, pr.EndTime, pr.SuccessTasks, pr.FailedTasks
            FROM pipelinerun pr
            WHERE {date_sql}{extra_sql}
            ORDER BY pr.StartTime DESC
            LIMIT ? OFFSET ?
            """,
            date_params + extra_params + [filters.limit, filters.offset],
        ).fetchall()
    return attach_fabric_urls(_rows_to_dicts(rows))


def pipeline_layers(pipeline_run_id: str) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT RunId, PipelineRunId, ConfigId, ConfigName, PipelineName, TargetName, Status,
                   StartTime, EndTime, SuccessTasks, FailedTasks, TotalTasks,
                   CASE
                     WHEN StartTime != '' AND EndTime != ''
                     THEN CAST((julianday(EndTime) - julianday(StartTime)) * 86400 AS INTEGER)
                     ELSE NULL
                   END AS duration_seconds
            FROM pipelinerun
            WHERE PipelineRunId = ?
            ORDER BY CASE TargetName WHEN 'BR' THEN 1 WHEN 'SL' THEN 2 WHEN 'GL' THEN 3 ELSE 4 END
            """,
            (pipeline_run_id,),
        ).fetchall()
    return attach_fabric_urls(_rows_to_dicts(rows))


def run_task_details(
    run_id: str | None = None,
    pipeline_run_id: str | None = None,
    config_id: str | None = None,
    limit: int = 5000,
) -> list[dict[str, Any]]:
    """Task-level detail for a pipeline layer run — prefer taskaudit (errors + row counts)."""
    if not run_id and not pipeline_run_id:
        return []

    with get_connection() as conn:
        clauses: list[str] = []
        params: list[Any] = []
        if run_id:
            clauses.append("ta.RunId = ?")
            params.append(run_id)
        if pipeline_run_id:
            clauses.append("ta.PipelineRunId = ?")
            params.append(pipeline_run_id)
        where = " OR ".join(clauses)
        config_sql = ""
        if config_id:
            config_sql = " AND (ta.ConfigId = ? OR ta.ConfigId = '' OR ta.ConfigId IS NULL)"
            params.append(config_id)

        rows = conn.execute(
            f"""
            SELECT
                ta.TaskId,
                ta.TaskName,
                ta.TableName,
                ta.StepName,
                ta.Status,
                ta.SiteCode,
                ta.SiteName,
                COALESCE(
                    NULLIF(ta.DataBaseName, ''),
                    NULLIF(tq.DataBaseName, ''),
                    (SELECT tq2.DataBaseName FROM taskqueue tq2 WHERE tq2.SiteCode = ta.SiteCode AND tq2.DataBaseName != '' LIMIT 1),
                    ''
                ) AS DataBaseName,
                ta.RowsRead,
                ta.RowsWritten,
                ta.RowsFailed,
                ta.DurationSeconds,
                ta.StartTime,
                ta.EndTime,
                substr(COALESCE(NULLIF(ta.ErrorMessage, ''), tq.ErrorMessage, ''), 1, 2000) AS ErrorMessage,
                ta.PipelineRunId,
                ta.RunId
            FROM taskaudit ta
            LEFT JOIN taskqueue tq ON tq.TaskId = ta.TaskId
            WHERE ({where}){config_sql}
            ORDER BY
                CASE ta.Status WHEN 'FAILED' THEN 0 ELSE 1 END,
                ta.StartTime DESC
            LIMIT ?
            """,
            params + [limit],
        ).fetchall()

        if rows:
            return [_normalize_failure_row(dict(r)) for r in rows]

        q_clauses: list[str] = []
        q_params: list[Any] = []
        if run_id:
            q_clauses.append("RunId = ?")
            q_params.append(run_id)
        if pipeline_run_id:
            q_clauses.append("PipelineRunId = ?")
            q_params.append(pipeline_run_id)
        q_where = " OR ".join(q_clauses)
        q_config = ""
        if config_id:
            q_config = " AND (ConfigId = ? OR ConfigId = '' OR ConfigId IS NULL)"
            q_params.append(config_id)

        queue_rows = conn.execute(
            f"""
            SELECT TaskId, TaskName, TargetTable AS TableName, '' AS StepName, Status,
                   SiteCode, SiteName,
                   COALESCE(
                       NULLIF(DataBaseName, ''),
                       (SELECT tq2.DataBaseName FROM taskqueue tq2 WHERE tq2.SiteCode = taskqueue.SiteCode AND tq2.DataBaseName != '' LIMIT 1),
                       ''
                   ) AS DataBaseName,
                   '' AS RowsRead, '' AS RowsWritten, '' AS RowsFailed, '' AS DurationSeconds,
                   StartTime, EndTime, substr(ErrorMessage, 1, 2000) AS ErrorMessage,
                   PipelineRunId, RunId
            FROM taskqueue
            WHERE ({q_where}){q_config}
            ORDER BY CASE Status WHEN 'FAILED' THEN 0 ELSE 1 END, StartTime DESC
            LIMIT ?
            """,
            q_params + [limit],
        ).fetchall()
        return [_normalize_failure_row(dict(r)) for r in queue_rows]


def _clean_site_code(value: str | None) -> str:
    """Drop garbage SiteCode values (error JSON leaked into the column)."""
    if not value:
        return ""
    code = value.strip()
    if not code or len(code) > 12:
        return ""
    if any(tok in code.lower() for tok in ("error", "message", "notebook", "config", "{", "\\", '"')):
        return ""
    return code


def _normalize_failure_row(row: dict[str, Any]) -> dict[str, Any]:
    site = _clean_site_code(row.get("SiteCode"))
    if not site:
        site = _clean_site_code(row.get("ConfigSiteCode"))
    db = (row.get("DataBaseName") or row.get("ConfigDataBaseName") or "").strip()
    if any(tok in db.lower() for tok in ("error", "message", "notebook", "{", "\\")):
        db = ""
    site_name = (row.get("SiteName") or "").strip()
    if any(tok in site_name.lower() for tok in ("error", "message", "runid", "{", "\\")):
        site_name = ""

    row["SiteCode"] = site
    row["DataBaseName"] = db
    row["SiteName"] = site_name
    row.pop("ConfigSiteCode", None)
    row.pop("ConfigDataBaseName", None)
    return row


def _failed_tasks_where(filters: GlobalFilters, *, no_site_only: bool = False) -> tuple[str, list[Any]]:
    date_sql, date_params = _date_range_clause("tq.StartTime", filters)
    extra_clauses: list[str] = []
    extra_params: list[Any] = []
    site_expr = _resolved_site_code_sql()

    pattern = _config_name_pattern(filters.config_name)
    if pattern:
        extra_clauses.append("pr.ConfigName LIKE ? COLLATE NOCASE")
        extra_params.append(pattern)
    if no_site_only:
        extra_clauses.append(f"({site_expr}) = ''")
    elif filters.site_code:
        extra_clauses.append(f"upper({site_expr}) = upper(?)")
        extra_params.append(filters.site_code.strip())
    if filters.method:
        extra_clauses.append("tc.Method LIKE ?")
        extra_params.append(f"%{filters.method}%")
    if filters.target_name:
        extra_clauses.append("pr.TargetName = ?")
        extra_params.append(filters.target_name)

    extra_sql = (" AND " + " AND ".join(extra_clauses)) if extra_clauses else ""
    return f"tq.Status = 'FAILED' AND {date_sql}{extra_sql}", date_params + extra_params


def count_failed_tasks(filters: GlobalFilters, *, no_site_only: bool = False) -> int:
    where_sql, params = _failed_tasks_where(filters, no_site_only=no_site_only)
    with get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT COUNT(*) AS cnt
            FROM taskqueue tq
            JOIN pipelinerun pr ON pr.RunId = tq.RunId
            LEFT JOIN taskconfig tc ON tc.TaskConfigId = tq.TaskConfigId
            WHERE {where_sql}
            """,
            params,
        ).fetchone()
    return int(row["cnt"] or 0)


def failed_tasks(filters: GlobalFilters, *, no_site_only: bool = False) -> list[dict[str, Any]]:
    where_sql, params = _failed_tasks_where(filters, no_site_only=no_site_only)

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT tq.StartTime, pr.ConfigId, pr.ConfigName, pr.PipelineName, pr.TargetName,
                   tq.SiteCode, tq.DataBaseName, tq.SiteName,
                   tc.SiteCode AS ConfigSiteCode, tc.DataBaseName AS ConfigDataBaseName,
                   tq.TaskName, tq.TargetTable, tq.Status,
                   substr(
                     COALESCE(
                       NULLIF(tq.ErrorMessage, ''),
                       (
                         SELECT ta.ErrorMessage
                         FROM taskaudit ta
                         WHERE ta.TaskId = tq.TaskId
                           AND ta.ErrorMessage != ''
                         ORDER BY ta.StartTime DESC
                         LIMIT 1
                       ),
                       ''
                     ),
                     1, 500
                   ) AS ErrorMessage,
                   tq.PipelineRunId, tq.TaskId
            FROM taskqueue tq
            JOIN pipelinerun pr ON pr.RunId = tq.RunId
            LEFT JOIN taskconfig tc ON tc.TaskConfigId = tq.TaskConfigId
            WHERE {where_sql}
            ORDER BY tq.StartTime DESC
            LIMIT ? OFFSET ?
            """,
            params + [filters.limit, filters.offset],
        ).fetchall()

    cleaned = [_normalize_failure_row(dict(r)) for r in rows]
    return attach_fabric_urls(cleaned)


def _failure_task_extra_clause(filters: GlobalFilters) -> tuple[str, list[Any]]:
    extra_clauses: list[str] = []
    extra_params: list[Any] = []
    pattern = _config_name_pattern(filters.config_name)
    if pattern:
        extra_clauses.append("pr.ConfigName LIKE ? COLLATE NOCASE")
        extra_params.append(pattern)
    if filters.target_name:
        extra_clauses.append("pr.TargetName = ?")
        extra_params.append(filters.target_name)
    extra_sql = (" AND " + " AND ".join(extra_clauses)) if extra_clauses else ""
    return extra_sql, extra_params


def _resolved_site_code_sql() -> str:
    """SQL expression: best valid site code from taskqueue or taskconfig."""
    return """
        CASE
            WHEN length(tq.SiteCode) BETWEEN 2 AND 12
                 AND instr(tq.SiteCode, char(123)) = 0
                 AND instr(lower(tq.SiteCode), 'error') = 0
                 AND instr(tq.SiteCode, char(92)) = 0
            THEN tq.SiteCode
            WHEN length(tc.SiteCode) BETWEEN 2 AND 12
                 AND instr(tc.SiteCode, char(123)) = 0
                 AND instr(lower(tc.SiteCode), 'error') = 0
            THEN tc.SiteCode
            ELSE ''
        END
    """


def _bronze_layer_sql(prefix: str = "pr") -> str:
    return f"{prefix}.TargetName IN ('BR', 'BRZ')"


def site_failure_summary(filters: GlobalFilters) -> list[dict[str, Any]]:
    """Aggregate failed Bronze tasks by valid SiteCode (sites only exist on BR layer)."""
    date_sql, date_params = _date_range_clause("tq.StartTime", filters)
    extra_sql, extra_params = _failure_task_extra_clause(filters)
    site_expr = _resolved_site_code_sql()
    bronze_sql = f" AND {_bronze_layer_sql()}"

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT * FROM (
                SELECT
                    {site_expr} AS SiteCode,
                    MAX(COALESCE(NULLIF(tq.DataBaseName, ''), NULLIF(tc.DataBaseName, ''), '')) AS DataBaseName,
                    MAX(COALESCE(NULLIF(tq.SiteName, ''), '')) AS SiteName,
                    COUNT(*) AS failure_count,
                    COUNT(DISTINCT pr.ConfigName) AS pipeline_count,
                    MAX(tq.StartTime) AS last_failure,
                    MAX(pr.ConfigName) AS sample_pipeline
                FROM taskqueue tq
                JOIN pipelinerun pr ON pr.RunId = tq.RunId
                LEFT JOIN taskconfig tc ON tc.TaskConfigId = tq.TaskConfigId
                WHERE tq.Status = 'FAILED'
                  AND {date_sql}{bronze_sql}{extra_sql}
                GROUP BY 1
            ) site_agg
            WHERE SiteCode != ''
            ORDER BY failure_count DESC, SiteCode
            LIMIT ?
            """,
            date_params + extra_params + [filters.limit],
        ).fetchall()
    return _rows_to_dicts(rows)


def failure_overview(filters: GlobalFilters) -> dict[str, Any]:
    date_sql, date_params = _date_range_clause("tq.StartTime", filters)
    extra_sql, extra_params = _failure_task_extra_clause(filters)
    site_expr = _resolved_site_code_sql()

    with get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT
                COUNT(*) AS total_failures,
                SUM(CASE WHEN pr.TargetName = 'BR' THEN 1 ELSE 0 END) AS bronze_failures,
                SUM(CASE WHEN pr.TargetName = 'SL' THEN 1 ELSE 0 END) AS silver_failures,
                SUM(CASE WHEN pr.TargetName = 'GL' THEN 1 ELSE 0 END) AS gold_failures,
                COUNT(DISTINCT pr.ConfigName) AS pipeline_count,
                COUNT(DISTINCT CASE WHEN ({site_expr}) != '' THEN ({site_expr}) END) AS site_count,
                SUM(CASE WHEN ({site_expr}) = '' THEN 1 ELSE 0 END) AS no_site_failures
            FROM taskqueue tq
            JOIN pipelinerun pr ON pr.RunId = tq.RunId
            LEFT JOIN taskconfig tc ON tc.TaskConfigId = tq.TaskConfigId
            WHERE tq.Status = 'FAILED'
              AND {date_sql}{extra_sql}
            """,
            date_params + extra_params,
        ).fetchone()

    return {
        "totalFailures": row["total_failures"] or 0,
        "bronzeFailures": row["bronze_failures"] or 0,
        "silverFailures": row["silver_failures"] or 0,
        "goldFailures": row["gold_failures"] or 0,
        "pipelineCount": row["pipeline_count"] or 0,
        "siteCount": row["site_count"] or 0,
        "noSiteFailures": row["no_site_failures"] or 0,
    }


def site_audit_summary(site_code: str, filters: GlobalFilters) -> list[dict[str, Any]]:
    """Failed tasks for a site (kept for API compatibility)."""
    site_filters = GlobalFilters(**{**filters.model_dump(), "site_code": site_code})
    return failed_tasks(site_filters)


def _dq_issue_filters(filters: GlobalFilters) -> tuple[str, list[Any]]:
    """Shared date + catalog filters for dataquality queries (etlconfig join)."""
    date_sql, date_params = _date_range_clause("dq.CreatedAt", filters)
    config_filter = ""
    config_params: list[Any] = []
    pattern = _config_name_pattern(filters.config_name)
    if pattern:
        config_filter += " AND ec.ConfigName LIKE ? COLLATE NOCASE"
        config_params.append(pattern)
    if filters.target_name:
        config_filter += " AND ec.TargetName = ?"
        config_params.append(filters.target_name)
    where = (
        f"dq.ValidationStatus NOT IN ('PASS', 'SUCCESS', 'PASSED', '')"
        f" AND {date_sql}{config_filter}"
    )
    return where, date_params + config_params


def count_data_quality_issues(filters: GlobalFilters) -> int:
    where, params = _dq_issue_filters(filters)
    with get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT COUNT(*) AS c
            FROM dataquality dq
            LEFT JOIN etlconfig ec ON ec.ConfigId = dq.ConfigId
            WHERE {where}
            """,
            params,
        ).fetchone()
    return int(row["c"] if row else 0)


def data_quality_overview(filters: GlobalFilters) -> dict[str, Any]:
    where, params = _dq_issue_filters(filters)
    with get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT
                COUNT(*) AS totalIssues,
                SUM(CASE WHEN dq.ValidationStatus = 'FAILED' THEN 1 ELSE 0 END) AS failedCount,
                SUM(CASE WHEN dq.ValidationStatus = 'ZERO_ROWS' THEN 1 ELSE 0 END) AS zeroRowsCount,
                COUNT(DISTINCT dq.TableName) AS tableCount,
                COUNT(DISTINCT ec.ConfigName) AS pipelineCount,
                SUM(CASE WHEN CAST(dq.NullCount AS INTEGER) > 0 THEN 1 ELSE 0 END) AS nullIssues,
                SUM(CASE WHEN CAST(dq.DuplicateCount AS INTEGER) > 0 THEN 1 ELSE 0 END) AS duplicateIssues
            FROM dataquality dq
            LEFT JOIN etlconfig ec ON ec.ConfigId = dq.ConfigId
            WHERE {where}
            """,
            params,
        ).fetchone()
    if not row:
        return {
            "totalIssues": 0,
            "failedCount": 0,
            "zeroRowsCount": 0,
            "tableCount": 0,
            "pipelineCount": 0,
            "nullIssues": 0,
            "duplicateIssues": 0,
        }
    return dict(row)


def data_quality_issues(filters: GlobalFilters) -> list[dict[str, Any]]:
    where, params = _dq_issue_filters(filters)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT dq.DqId, dq.CreatedAt, dq.TableName, dq.RowCount, dq.NullCount,
                   dq.DuplicateCount, dq.ValidationStatus, dq.PipelineRunId, dq.RunId,
                   dq.ConfigId, ec.ConfigName, ec.TargetName, ec.PipelineName
            FROM dataquality dq
            LEFT JOIN etlconfig ec ON ec.ConfigId = dq.ConfigId
            WHERE {where}
            ORDER BY dq.CreatedAt DESC
            LIMIT ? OFFSET ?
            """,
            params + [filters.limit, filters.offset],
        ).fetchall()
    return attach_fabric_urls(_rows_to_dicts(rows))


def search_runs(
    run_id: str | None = None,
    pipeline_run_id: str | None = None,
    site_code: str | None = None,
    ref_date: date | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    clauses: list[str] = []
    params: list[Any] = []

    if run_id:
        clauses.append("(pr.RunId = ? OR tq.RunId = ? OR ta.RunId = ?)")
        params.extend([run_id, run_id, run_id])
    if pipeline_run_id:
        clauses.append("(pr.PipelineRunId = ? OR tq.PipelineRunId = ? OR ta.PipelineRunId = ?)")
        params.extend([pipeline_run_id, pipeline_run_id, pipeline_run_id])
    if site_code:
        clauses.append("(tq.SiteCode = ? OR ta.SiteCode = ?)")
        params.extend([site_code, site_code])
    if ref_date:
        clauses.append("date(pr.StartTime) = ?")
        params.append(ref_date.isoformat())

    if not clauses:
        return []

    where = " AND ".join(clauses)

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT DISTINCT
                pr.RunId, pr.PipelineRunId, pr.ConfigId, pr.ConfigName, pr.PipelineName,
                pr.TargetName, pr.Status, pr.StartTime, pr.EndTime, tq.SiteCode,
                tq.TaskName AS queue_task, ta.RowsWritten, ta.DurationSeconds
            FROM pipelinerun pr
            LEFT JOIN taskqueue tq ON tq.RunId = pr.RunId
            LEFT JOIN taskaudit ta ON ta.RunId = pr.RunId
            WHERE {where}
            ORDER BY pr.StartTime DESC
            LIMIT ?
            """,
            params + [limit],
        ).fetchall()
    return attach_fabric_urls(_rows_to_dicts(rows))


def list_config_names(q: str | None = None) -> list[str]:
    pattern = _config_name_pattern(q)
    with get_connection() as conn:
        if pattern:
            rows = conn.execute(
                """
                SELECT DISTINCT ConfigName FROM pipelinerun
                WHERE ConfigName LIKE ? COLLATE NOCASE
                ORDER BY ConfigName
                LIMIT 50
                """,
                (pattern,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT DISTINCT ConfigName FROM pipelinerun ORDER BY ConfigName"
            ).fetchall()
    return [row["ConfigName"] for row in rows]


def list_source_systems() -> list[str]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT DISTINCT SourceSystem FROM etlconfig WHERE SourceSystem != '' ORDER BY SourceSystem"
        ).fetchall()
    return [row["SourceSystem"] for row in rows]


def site_counts(filters: GlobalFilters) -> list[dict[str, Any]]:
    """Count unique sites processing by pipeline/layer for the date window."""
    where_sql, params = _taskaudit_where(filters)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT
                ta.SiteCode,
                pr.ConfigName,
                pr.TargetName,
                COUNT(DISTINCT ta.TaskId) AS task_count,
                SUM(CASE WHEN ta.Status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
                SUM(CASE WHEN ta.Status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count
            FROM taskaudit ta
            JOIN pipelinerun pr ON pr.RunId = ta.RunId
            WHERE {where_sql}
              AND ta.SiteCode != ''
            GROUP BY ta.SiteCode, pr.ConfigName, pr.TargetName
            ORDER BY ta.SiteCode, pr.ConfigName
            """,
            params,
        ).fetchall()
    return _rows_to_dicts(rows)


def rows_by_pipeline(filters: GlobalFilters) -> list[dict[str, Any]]:
    """Total rows read/written by pipeline for the date window."""
    where_sql, params = _taskaudit_where(filters)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT
                pr.ConfigName,
                COUNT(DISTINCT ta.TaskId) AS task_count,
                SUM(CAST(ta.RowsRead AS INTEGER)) AS total_rows_read,
                SUM(CAST(ta.RowsWritten AS INTEGER)) AS total_rows_written,
                SUM(CASE WHEN ta.Status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
                SUM(CASE WHEN ta.Status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count
            FROM taskaudit ta
            JOIN pipelinerun pr ON pr.RunId = ta.RunId
            WHERE {where_sql}
            GROUP BY pr.ConfigName
            ORDER BY total_rows_written DESC
            """,
            params,
        ).fetchall()
    return _rows_to_dicts(rows)


def rows_by_layer(filters: GlobalFilters) -> list[dict[str, Any]]:
    """Total rows read/written by layer (BR/SL/GL) for the date window."""
    where_sql, params = _taskaudit_where(filters)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT
                pr.TargetName,
                COUNT(DISTINCT ta.TaskId) AS task_count,
                SUM(CAST(ta.RowsRead AS INTEGER)) AS total_rows_read,
                SUM(CAST(ta.RowsWritten AS INTEGER)) AS total_rows_written,
                SUM(CASE WHEN ta.Status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
                SUM(CASE WHEN ta.Status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count
            FROM taskaudit ta
            JOIN pipelinerun pr ON pr.RunId = ta.RunId
            WHERE {where_sql}
            GROUP BY pr.TargetName
            ORDER BY total_rows_written DESC
            """,
            params,
        ).fetchall()
    return _rows_to_dicts(rows)


def rows_by_site(filters: GlobalFilters) -> list[dict[str, Any]]:
    """Total rows read/written by site for the date window."""
    where_sql, params = _taskaudit_where(filters)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT
                ta.SiteCode,
                COUNT(DISTINCT ta.TaskId) AS task_count,
                SUM(CAST(ta.RowsRead AS INTEGER)) AS total_rows_read,
                SUM(CAST(ta.RowsWritten AS INTEGER)) AS total_rows_written,
                SUM(CASE WHEN ta.Status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
                SUM(CASE WHEN ta.Status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count
            FROM taskaudit ta
            JOIN pipelinerun pr ON pr.RunId = ta.RunId
            WHERE {where_sql}
              AND ta.SiteCode != ''
            GROUP BY ta.SiteCode
            ORDER BY total_rows_written DESC
            """,
            params,
        ).fetchall()
    return _rows_to_dicts(rows)


def pipeline_layer_matrix(filters: GlobalFilters) -> list[dict[str, Any]]:
    """Rows by pipeline × layer matrix for the date window."""
    where_sql, params = _taskaudit_where(filters)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT
                pr.ConfigName,
                pr.TargetName,
                COUNT(DISTINCT ta.TaskId) AS task_count,
                SUM(CAST(ta.RowsRead AS INTEGER)) AS total_rows_read,
                SUM(CAST(ta.RowsWritten AS INTEGER)) AS total_rows_written,
                SUM(CASE WHEN ta.Status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
                SUM(CASE WHEN ta.Status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count
            FROM taskaudit ta
            JOIN pipelinerun pr ON pr.RunId = ta.RunId
            WHERE {where_sql}
            GROUP BY pr.ConfigName, pr.TargetName
            ORDER BY pr.ConfigName, pr.TargetName
            """,
            params,
        ).fetchall()
    return _rows_to_dicts(rows)
