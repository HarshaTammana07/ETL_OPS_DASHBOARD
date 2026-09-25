"""Background and on-demand synchronization from Microsoft Fabric Lakehouse into local SQLite cache."""

from __future__ import annotations

import asyncio
import json
import logging
import sqlite3
import struct
import subprocess
import time
from datetime import datetime, timezone
from typing import Any

try:
    import pyodbc
except ImportError:
    pyodbc = None  # type: ignore

from app.config import settings

logger = logging.getLogger("fabric_sync")


class FabricTokenManager:
    """Caches the Azure Entra ID token to avoid repeated CLI calls."""
    _token_struct: bytes | None = None
    _expires_at: float = 0.0

    @classmethod
    def get_token_struct(cls) -> bytes:
        now = time.time()
        if cls._token_struct and now < cls._expires_at - 300:
            return cls._token_struct

        logger.info("Acquiring fresh Azure Entra ID access token for Fabric...")
        try:
            res = subprocess.run(
                "az account get-access-token --resource https://database.windows.net",
                shell=True,
                capture_output=True,
                text=True,
                check=True,
            )
            data = json.loads(res.stdout)
            access_token = data["accessToken"]
            token_bytes = access_token.encode("utf-16-le")
            cls._token_struct = struct.pack(f"<I{len(token_bytes)}s", len(token_bytes), token_bytes)
            cls._expires_at = float(data.get("expires_on", now + 3000))
            return cls._token_struct
        except Exception as exc:
            raise RuntimeError(f"Azure CLI token acquisition failed: {exc}") from exc


class FabricSyncState:
    is_syncing: bool = False
    last_sync_time: str | None = None
    last_duration_sec: float | None = None
    last_error: str | None = None
    last_stats: dict[str, Any] | None = None


state = FabricSyncState()


def get_fabric_connection() -> Any:
    if pyodbc is None:
        raise RuntimeError(
            "pyodbc is not installed. Direct Microsoft Fabric sync requires pyodbc and ODBC Driver 18 for SQL Server."
        )
    token_struct = FabricTokenManager.get_token_struct()
    conn_str = (
        f"Driver={{ODBC Driver 18 for SQL Server}};"
        f"Server={settings.fabric_sql_server};"
        f"Database={settings.fabric_database};"
        f"Encrypt=yes;"
        f"TrustServerCertificate=no;"
    )
    return pyodbc.connect(conn_str, attrs_before={1256: token_struct}, timeout=30)


def _get_sqlite_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in cursor.fetchall()]


def _insert_rows(sqlite_conn: sqlite3.Connection, table: str, target_cols: list[str], rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0

    col_names = ", ".join(f'"{c}"' for c in target_cols)
    placeholders = ", ".join("?" for _ in target_cols)
    sql = f'INSERT INTO "{table}" ({col_names}) VALUES ({placeholders})'

    tuples = []
    for r in rows:
        tuples.append([str(r.get(c, "") if r.get(c) is not None else "") for c in target_cols])

    sqlite_conn.executemany(sql, tuples)
    return len(tuples)


def _delete_by_run_ids(sqlite_conn: sqlite3.Connection, table: str, run_ids: list[str]) -> None:
    if not run_ids:
        return
    chunk_size = 500
    for i in range(0, len(run_ids), chunk_size):
        chunk = run_ids[i:i + chunk_size]
        placeholders = ", ".join("?" for _ in chunk)
        sqlite_conn.execute(f'DELETE FROM "{table}" WHERE RunId IN ({placeholders})', chunk)


def sync_from_fabric(lookback_days: int = 7, full_sync: bool = False) -> dict[str, Any]:
    """
    Synchronizes delta or full data from Microsoft Fabric into local SQLite.
    Uses delete-and-insert for modified runs to cleanly handle Fabric run history.
    """
    if state.is_syncing:
        return {"status": "skipped", "reason": "Sync already in progress"}

    if pyodbc is None:
        logger.info("Fabric live sync skipped: pyodbc is not installed in this environment.")
        return {"status": "skipped", "reason": "pyodbc is not installed"}

    if not settings.fabric_sync_enabled:
        return {"status": "skipped", "reason": "Fabric sync is disabled in settings"}

    state.is_syncing = True
    start_time = time.time()
    stats: dict[str, Any] = {}

    sqlite_conn = sqlite3.connect(settings.sqlite_path, timeout=30.0)
    sqlite_conn.execute("PRAGMA journal_mode = WAL")
    sqlite_conn.execute("PRAGMA busy_timeout = 30000")
    try:
        fabric_conn = get_fabric_connection()
        fabric_cursor = fabric_conn.cursor()

        pr_cols = _get_sqlite_columns(sqlite_conn, "pipelinerun")
        ta_cols = _get_sqlite_columns(sqlite_conn, "taskaudit")
        tq_cols = _get_sqlite_columns(sqlite_conn, "taskqueue")
        tc_cols = _get_sqlite_columns(sqlite_conn, "taskconfig")
        ec_cols = _get_sqlite_columns(sqlite_conn, "etlconfig")
        dq_cols = _get_sqlite_columns(sqlite_conn, "dataquality")

        # 1. Sync master config tables on full sync
        if full_sync:
            fabric_cursor.execute("SELECT * FROM [meta].[etlconfig]")
            cols = [d[0] for d in fabric_cursor.description]
            ec_rows = [dict(zip(cols, row)) for row in fabric_cursor.fetchall()]
            sqlite_conn.execute('DELETE FROM "etlconfig"')
            stats["etlconfig"] = _insert_rows(sqlite_conn, "etlconfig", ec_cols, ec_rows)

            fabric_cursor.execute("SELECT * FROM [meta].[taskconfig]")
            cols = [d[0] for d in fabric_cursor.description]
            tc_rows = [dict(zip(cols, row)) for row in fabric_cursor.fetchall()]
            sqlite_conn.execute('DELETE FROM "taskconfig"')
            stats["taskconfig"] = _insert_rows(sqlite_conn, "taskconfig", tc_cols, tc_rows)

        # 2. Sync Pipeline Runs (lookback days + any currently RUNNING)
        if full_sync:
            runs_query = "SELECT * FROM [meta].[pipelinerun] ORDER BY StartTime DESC"
            fabric_cursor.execute(runs_query)
        else:
            runs_query = """
                SELECT * FROM [meta].[pipelinerun]
                WHERE StartTime >= DATEADD(day, -?, GETUTCDATE())
                   OR Status = 'RUNNING'
                ORDER BY StartTime DESC
            """
            fabric_cursor.execute(runs_query, (lookback_days,))

        cols = [d[0] for d in fabric_cursor.description]
        raw_runs = fabric_cursor.fetchall()
        run_dicts = [dict(zip(cols, r)) for r in raw_runs]

        synced_run_ids = list({str(r.get("RunId")) for r in run_dicts if r.get("RunId")})

        if synced_run_ids:
            # Delete old versions of these runs across tables
            _delete_by_run_ids(sqlite_conn, "pipelinerun", synced_run_ids)
            _delete_by_run_ids(sqlite_conn, "taskqueue", synced_run_ids)
            _delete_by_run_ids(sqlite_conn, "taskaudit", synced_run_ids)
            _delete_by_run_ids(sqlite_conn, "dataquality", synced_run_ids)

            # Insert updated runs
            stats["pipelinerun"] = _insert_rows(sqlite_conn, "pipelinerun", pr_cols, run_dicts)

            # Fetch and insert associated task queue, audit, data quality
            chunk_size = 500
            total_ta = 0
            total_tq = 0
            total_dq = 0

            for i in range(0, len(synced_run_ids), chunk_size):
                chunk = synced_run_ids[i:i + chunk_size]
                placeholders = ", ".join("?" for _ in chunk)

                # Task Queue
                fabric_cursor.execute(f"SELECT * FROM [meta].[taskqueue] WHERE RunId IN ({placeholders})", chunk)
                tq_rows = [dict(zip([d[0] for d in fabric_cursor.description], r)) for r in fabric_cursor.fetchall()]
                total_tq += _insert_rows(sqlite_conn, "taskqueue", tq_cols, tq_rows)

                # Task Audit
                fabric_cursor.execute(f"SELECT * FROM [meta].[taskaudit] WHERE RunId IN ({placeholders})", chunk)
                ta_rows = [dict(zip([d[0] for d in fabric_cursor.description], r)) for r in fabric_cursor.fetchall()]
                total_ta += _insert_rows(sqlite_conn, "taskaudit", ta_cols, ta_rows)

                # Data Quality
                fabric_cursor.execute(f"SELECT * FROM [meta].[dataquality] WHERE RunId IN ({placeholders})", chunk)
                dq_rows = [dict(zip([d[0] for d in fabric_cursor.description], r)) for r in fabric_cursor.fetchall()]
                total_dq += _insert_rows(sqlite_conn, "dataquality", dq_cols, dq_rows)

            stats["taskqueue"] = total_tq
            stats["taskaudit"] = total_ta
            stats["dataquality"] = total_dq
        else:
            stats["pipelinerun"] = 0

        sqlite_conn.commit()
        fabric_conn.close()

        # Auto-seed failure alerts from newly synced runs so alerts are always live
        try:
            from datetime import timedelta
            from app.models.filters import GlobalFilters
            from app.services.notifications import backfill_from_audit
            now_dt = datetime.now(timezone.utc)
            start_str = (now_dt - timedelta(days=lookback_days + 1)).strftime("%Y-%m-%d")
            bf_res = backfill_from_audit(GlobalFilters(start_date_from=start_str), limit=500)
            stats["alerts_seeded"] = bf_res.get("inserted", 0)
        except Exception as alert_err:
            logger.warning(f"Fabric sync alerts backfill notice: {alert_err}")

        duration = round(time.time() - start_time, 2)
        state.last_sync_time = datetime.now(timezone.utc).isoformat()
        state.last_duration_sec = duration
        state.last_stats = stats
        state.last_error = None

        logger.info(f"Fabric sync complete in {duration}s: {stats}")
        return {"status": "ok", "duration_sec": duration, "stats": stats}

    except Exception as exc:
        duration = round(time.time() - start_time, 2)
        state.last_error = str(exc)
        state.last_duration_sec = duration
        logger.error(f"Fabric sync failed after {duration}s: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc), "duration_sec": duration}

    finally:
        state.is_syncing = False
        sqlite_conn.close()


async def run_periodic_sync_loop() -> None:
    """Background async worker that sleeps and runs delta sync periodically."""
    if not settings.fabric_sync_enabled:
        logger.info("Fabric background sync is disabled in settings.")
        return

    # Wait 2 seconds on startup before initial sync
    await asyncio.sleep(2)
    logger.info("Starting initial Fabric delta sync...")

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, sync_from_fabric, 14, False)

    while True:
        try:
            await asyncio.sleep(settings.fabric_sync_interval_seconds)
            await loop.run_in_executor(None, sync_from_fabric, 3, False)
        except asyncio.CancelledError:
            logger.info("Fabric periodic sync cancelled.")
            break
        except Exception as err:
            logger.error(f"Unexpected error in sync loop: {err}")
            await asyncio.sleep(10)
