"""Load CSV exports into SQLite for local development."""

from __future__ import annotations

import csv
import sqlite3
from pathlib import Path

from app.config import settings

TABLE_FILES = {
    "etlconfig": "etlconfig.csv",
    "taskconfig": "taskconfig.csv",
    "pipelinerun": "pipelinerun.csv",
    "taskqueue": "taskqueue.csv",
    "taskaudit": "taskaudit.csv",
    "dataquality": "dataquality.csv",
}

# Columns needed for dashboard queries (skip heavy JSON fields in config tables).
TABLE_COLUMNS: dict[str, list[str] | None] = {
    "etlconfig": [
        "ConfigId", "ConfigName", "PipelineName", "SourceSystem",
        "TargetName", "IsActive", "CreatedAt",
    ],
    "taskconfig": [
        "TaskConfigId", "ConfigId", "TaskName", "Method", "TargetTable",
        "LoadType", "IsActive", "SiteCode", "DataBaseName", "SiteName",
    ],
    "pipelinerun": None,
    "taskqueue": None,
    "taskaudit": None,
    "dataquality": None,
}


def _is_valid_etlconfig_row(row: list[str]) -> bool:
    """Drop CSV parse artifacts from multiline ConnectionConfig JSON."""
    if len(row) < 2:
        return False
    config_id = (row[0] or "").strip()
    config_name = (row[1] or "").strip()
    if not config_name:
        return False
    if not config_id or len(config_id) > 12:
        return False
    if any(ch in config_id for ch in ('"', "{", "}", "\\", ":", "http")):
        return False
    return config_id.replace("-", "").isalnum()


def _load_csv(csv_path: Path, columns: list[str] | None, table: str | None = None) -> tuple[list[str], list[list[str]]]:
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            return [], []
        fieldnames = list(reader.fieldnames)
        use_cols = columns if columns else fieldnames
        rows: list[list[str]] = []
        for record in reader:
            row = [record.get(col, "") or "" for col in use_cols]
            if table == "etlconfig" and not _is_valid_etlconfig_row(row):
                continue
            rows.append(row)
        return use_cols, rows


def ensure_sample_db(force: bool = False) -> Path:
    db_path = settings.sqlite_path
    db_path.parent.mkdir(parents=True, exist_ok=True)

    if db_path.exists() and not force:
        return db_path

    conn = sqlite3.connect(db_path)
    try:
        for table, filename in TABLE_FILES.items():
            csv_path = settings.data_dir / filename
            if not csv_path.exists():
                raise FileNotFoundError(f"Missing CSV: {csv_path}")

            columns, rows = _load_csv(csv_path, TABLE_COLUMNS.get(table), table=table)
            placeholders = ", ".join("?" * len(columns))
            col_sql = ", ".join(f'"{c}"' for c in columns)
            conn.execute(f'DROP TABLE IF EXISTS "{table}"')
            conn.execute(f'CREATE TABLE "{table}" ({col_sql})')
            if rows:
                conn.executemany(
                    f'INSERT INTO "{table}" ({col_sql}) VALUES ({placeholders})',
                    rows,
                )

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_pipelinerun_start ON pipelinerun(StartTime)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_pipelinerun_config ON pipelinerun(ConfigName)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_taskqueue_run ON taskqueue(RunId)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_taskqueue_status ON taskqueue(Status)"
        )
        conn.commit()
    finally:
        conn.close()

    return db_path


def get_connection() -> sqlite3.Connection:
    ensure_sample_db()
    conn = sqlite3.connect(settings.sqlite_path, timeout=30.0)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 30000")
    conn.row_factory = sqlite3.Row
    return conn
