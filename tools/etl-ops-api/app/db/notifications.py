"""Persistent store for Teams-style failure notifications."""

from __future__ import annotations

import sqlite3

from app.config import settings
from app.db.sqlite import ensure_sample_db

NOTIFICATIONS_DDL = """
CREATE TABLE IF NOT EXISTS notifications (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Status TEXT NOT NULL,
    PipelineName TEXT,
    ConfigName TEXT,
    SourceSystem TEXT,
    TargetName TEXT,
    EnvironmentName TEXT,
    RunId TEXT,
    PipelineRunId TEXT,
    FailedCount INTEGER DEFAULT 0,
    SuccessCount INTEGER DEFAULT 0,
    StartTime TEXT,
    EndTime TEXT,
    ErrorSummary TEXT,
    FailureDetails TEXT,
    Title TEXT,
    Summary TEXT,
    Source TEXT DEFAULT 'ingest',
    CreatedAt TEXT DEFAULT (datetime('now'))
)
"""


def ensure_notifications_table(conn: sqlite3.Connection | None = None) -> None:
    ensure_sample_db()
    own = conn is None
    if own:
        conn = sqlite3.connect(settings.sqlite_path)
    assert conn is not None
    try:
        conn.execute(NOTIFICATIONS_DDL)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(CreatedAt)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(Status)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_notifications_run ON notifications(RunId)"
        )
        conn.commit()
    finally:
        if own:
            conn.close()
