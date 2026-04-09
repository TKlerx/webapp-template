from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row

from .config import WorkerConfig


@dataclass
class BackgroundJob:
    id: str
    job_type: str
    payload: dict[str, Any]
    attempt_count: int


class JobStore:
    def __init__(self, config: WorkerConfig) -> None:
        self._config = config
        self._is_sqlite = config.database_url.startswith("file:")
        self._sqlite_path = None
        if self._is_sqlite:
            self._sqlite_path = Path(config.database_url.removeprefix("file:")).resolve()

    def claim_next_job(self) -> BackgroundJob | None:
        if self._is_sqlite:
            return self._claim_sqlite_job()

        return self._claim_postgres_job()

    def requeue_stale_jobs(self) -> int:
        if self._is_sqlite:
            return self._requeue_stale_sqlite_jobs()

        return self._requeue_stale_postgres_jobs()

    def complete_job(self, job_id: str, result: dict[str, Any]) -> None:
        payload = json.dumps(result)
        if self._is_sqlite:
            with closing(sqlite3.connect(self._sqlite_path)) as connection:
                connection.execute(
                    """
                    UPDATE BackgroundJob
                    SET status = 'COMPLETED',
                        result = ?,
                        error = NULL,
                        lockedAt = NULL,
                        finishedAt = CURRENT_TIMESTAMP,
                        updatedAt = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (payload, job_id),
                )
                connection.commit()
            return

        with psycopg.connect(self._config.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE "BackgroundJob"
                    SET status = 'COMPLETED',
                        result = %s,
                        error = NULL,
                        "lockedAt" = NULL,
                        "finishedAt" = NOW(),
                        "updatedAt" = NOW()
                    WHERE id = %s
                    """,
                    (payload, job_id),
                )
            connection.commit()

    def fail_job(self, job_id: str, error: str) -> None:
        if self._is_sqlite:
            self._fail_sqlite_job(job_id, error)
            return

        self._fail_postgres_job(job_id, error)

    def _claim_sqlite_job(self) -> BackgroundJob | None:
        with closing(sqlite3.connect(self._sqlite_path)) as connection:
            connection.row_factory = sqlite3.Row
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                """
                SELECT id, jobType, payload, attemptCount
                FROM BackgroundJob
                WHERE status = 'PENDING'
                  AND datetime(availableAt) <= datetime('now')
                ORDER BY createdAt ASC
                LIMIT 1
                """
            ).fetchone()

            if row is None:
                connection.commit()
                return None

            connection.execute(
                """
                UPDATE BackgroundJob
                SET status = 'IN_PROGRESS',
                    attemptCount = attemptCount + 1,
                    startedAt = COALESCE(startedAt, CURRENT_TIMESTAMP),
                    lockedAt = CURRENT_TIMESTAMP,
                    workerId = ?,
                    updatedAt = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (self._config.worker_id, row["id"]),
            )
            connection.commit()

            return BackgroundJob(
                id=row["id"],
                job_type=row["jobType"],
                payload=_parse_payload(row["payload"]),
                attempt_count=row["attemptCount"] + 1,
            )

    def _claim_postgres_job(self) -> BackgroundJob | None:
        with psycopg.connect(self._config.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    WITH next_job AS (
                        SELECT id
                        FROM "BackgroundJob"
                        WHERE status = 'PENDING'
                          AND "availableAt" <= NOW()
                        ORDER BY "createdAt" ASC
                        FOR UPDATE SKIP LOCKED
                        LIMIT 1
                    )
                    UPDATE "BackgroundJob" job
                    SET status = 'IN_PROGRESS',
                        "attemptCount" = job."attemptCount" + 1,
                        "startedAt" = COALESCE(job."startedAt", NOW()),
                        "lockedAt" = NOW(),
                        "workerId" = %s,
                        "updatedAt" = NOW()
                    FROM next_job
                    WHERE job.id = next_job.id
                    RETURNING job.id, job."jobType", job.payload, job."attemptCount"
                    """,
                    (self._config.worker_id,),
                )
                row = cursor.fetchone()
            connection.commit()

        if row is None:
            return None

        return BackgroundJob(
            id=row["id"],
            job_type=row["jobType"],
            payload=_parse_payload(row["payload"]),
            attempt_count=row["attemptCount"],
        )

    def _requeue_stale_sqlite_jobs(self) -> int:
        with closing(sqlite3.connect(self._sqlite_path)) as connection:
            cursor = connection.execute(
                """
                UPDATE BackgroundJob
                SET status = 'PENDING',
                    error = CASE
                        WHEN error IS NULL OR error = '' THEN 'Worker lock expired; job requeued.'
                        ELSE error || '\nWorker lock expired; job requeued.'
                    END,
                    availableAt = CURRENT_TIMESTAMP,
                    lockedAt = NULL,
                    workerId = NULL,
                    updatedAt = CURRENT_TIMESTAMP
                WHERE status = 'IN_PROGRESS'
                  AND lockedAt IS NOT NULL
                  AND datetime(lockedAt) <= datetime('now', ?)
                """,
                (f"-{self._config.stale_lock_seconds} seconds",),
            )
            connection.commit()
            return int(cursor.rowcount or 0)

    def _requeue_stale_postgres_jobs(self) -> int:
        with psycopg.connect(self._config.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE "BackgroundJob"
                    SET status = 'PENDING',
                        error = CASE
                            WHEN error IS NULL OR error = '' THEN 'Worker lock expired; job requeued.'
                            ELSE error || E'\nWorker lock expired; job requeued.'
                        END,
                        "availableAt" = NOW(),
                        "lockedAt" = NULL,
                        "workerId" = NULL,
                        "updatedAt" = NOW()
                    WHERE status = 'IN_PROGRESS'
                      AND "lockedAt" IS NOT NULL
                      AND "lockedAt" <= NOW() - (%s * INTERVAL '1 second')
                    """,
                    (self._config.stale_lock_seconds,),
                )
                row_count = int(cursor.rowcount or 0)
            connection.commit()
            return row_count

    def _fail_sqlite_job(self, job_id: str, error: str) -> None:
        with closing(sqlite3.connect(self._sqlite_path)) as connection:
            connection.row_factory = sqlite3.Row
            row = connection.execute(
                "SELECT attemptCount FROM BackgroundJob WHERE id = ?",
                (job_id,),
            ).fetchone()
            if row is None:
                return

            attempt_count = int(row["attemptCount"])
            should_retry = attempt_count < self._config.max_attempts
            if should_retry:
                connection.execute(
                    """
                    UPDATE BackgroundJob
                    SET status = 'PENDING',
                        error = ?,
                        availableAt = ?,
                        lockedAt = NULL,
                        finishedAt = NULL,
                        updatedAt = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (error, _sqlite_timestamp_after_seconds(self._retry_delay_seconds(attempt_count)), job_id),
                )
            else:
                connection.execute(
                    """
                    UPDATE BackgroundJob
                    SET status = 'FAILED',
                        error = ?,
                        lockedAt = NULL,
                        finishedAt = CURRENT_TIMESTAMP,
                        updatedAt = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (error, job_id),
                )
            connection.commit()

    def _fail_postgres_job(self, job_id: str, error: str) -> None:
        with psycopg.connect(self._config.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    'SELECT "attemptCount" FROM "BackgroundJob" WHERE id = %s',
                    (job_id,),
                )
                row = cursor.fetchone()
                if row is None:
                    connection.commit()
                    return

                attempt_count = int(row[0])
                should_retry = attempt_count < self._config.max_attempts
                if should_retry:
                    cursor.execute(
                        """
                        UPDATE "BackgroundJob"
                        SET status = 'PENDING',
                            error = %s,
                            "availableAt" = %s,
                            "lockedAt" = NULL,
                            "finishedAt" = NULL,
                            "updatedAt" = NOW()
                        WHERE id = %s
                        """,
                        (
                            error,
                            datetime.now(timezone.utc)
                            + timedelta(seconds=self._retry_delay_seconds(attempt_count)),
                            job_id,
                        ),
                    )
                else:
                    cursor.execute(
                        """
                        UPDATE "BackgroundJob"
                        SET status = 'FAILED',
                            error = %s,
                            "lockedAt" = NULL,
                            "finishedAt" = NOW(),
                            "updatedAt" = NOW()
                        WHERE id = %s
                        """,
                        (error, job_id),
                    )
            connection.commit()

    def _retry_delay_seconds(self, attempt_count: int) -> float:
        multiplier = max(attempt_count, 1)
        return max(self._config.retry_backoff_seconds, 0) * multiplier


def _parse_payload(value: str | None) -> dict[str, Any]:
    if not value:
        return {}

    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {"raw": value}

    return parsed if isinstance(parsed, dict) else {"value": parsed}


def _sqlite_timestamp_after_seconds(delay_seconds: float) -> str:
    scheduled_for = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
    return scheduled_for.strftime("%Y-%m-%d %H:%M:%S")
