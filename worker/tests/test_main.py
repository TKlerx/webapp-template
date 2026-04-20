from __future__ import annotations

import json
import os
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from starter_worker.config import WorkerConfig, load_config
from starter_worker.db import JobStore
from starter_worker.main import process_job


class WorkerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "worker-test.db"
        self._create_schema()

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_process_job_echo_returns_payload(self) -> None:
        result = process_job(
            type("Job", (), {"job_type": "echo", "payload": {"message": "hello"}})()
        )

        self.assertEqual(result["echo"], {"message": "hello"})
        self.assertIn("processedAt", result)

    def test_process_job_notification_delivery_sends_mail(self) -> None:
        with patch("starter_worker.main.send_graph_mail") as send_graph_mail:
            result = process_job(
                type(
                    "Job",
                    (),
                    {
                        "job_type": "notification_delivery",
                        "payload": {
                            "notificationId": "notification-1",
                            "recipientEmail": "user@example.com",
                            "subject": "Test",
                            "bodyText": "Hello",
                        },
                    },
                )()
            )

        send_graph_mail.assert_called_once()
        self.assertEqual(result["notificationId"], "notification-1")
        self.assertEqual(result["status"], "sent")
        self.assertIn("processedAt", result)

    def test_sqlite_job_store_claims_and_completes_job(self) -> None:
        self._insert_job(job_id="job-1", job_type="noop", payload={"message": "hello"})
        store = self._make_store()

        job = store.claim_next_job()

        self.assertIsNotNone(job)
        assert job is not None
        self.assertEqual(job.id, "job-1")
        self.assertEqual(job.job_type, "noop")
        self.assertEqual(job.attempt_count, 1)

        store.complete_job(job.id, {"message": "done"})
        row = self._fetch_job("job-1")

        self.assertEqual(row["status"], "COMPLETED")
        self.assertEqual(row["workerId"], "worker-test")
        self.assertEqual(row["attemptCount"], 1)
        self.assertEqual(json.loads(row["result"]), {"message": "done"})
        self.assertIsNotNone(row["finishedAt"])
        self.assertIsNone(row["lockedAt"])

    def test_sqlite_job_store_retries_failure_before_max_attempts(self) -> None:
        self._insert_job(job_id="job-2", job_type="echo", payload={"message": "x"})
        store = self._make_store(max_attempts=3, retry_backoff_seconds=15)

        job = store.claim_next_job()

        self.assertIsNotNone(job)
        assert job is not None
        store.fail_job(job.id, "bad job")
        row = self._fetch_job("job-2")

        self.assertEqual(row["status"], "PENDING")
        self.assertEqual(row["error"], "bad job")
        self.assertEqual(row["workerId"], "worker-test")
        self.assertIsNone(row["finishedAt"])
        self.assertIsNone(row["lockedAt"])

    def test_sqlite_job_store_marks_terminal_failure_after_max_attempts(self) -> None:
        self._insert_job(job_id="job-3", job_type="echo", payload={"message": "x"})
        store = self._make_store(max_attempts=1)

        job = store.claim_next_job()

        self.assertIsNotNone(job)
        assert job is not None
        store.fail_job(job.id, "bad job")
        row = self._fetch_job("job-3")

        self.assertEqual(row["status"], "FAILED")
        self.assertEqual(row["error"], "bad job")
        self.assertEqual(row["workerId"], "worker-test")
        self.assertIsNotNone(row["finishedAt"])
        self.assertIsNone(row["lockedAt"])

    def test_sqlite_job_store_requeues_stale_in_progress_job(self) -> None:
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                INSERT INTO BackgroundJob (
                    id, jobType, status, payload, attemptCount, availableAt, startedAt,
                    lockedAt, workerId, createdAt, updatedAt
                ) VALUES (
                    ?, ?, 'IN_PROGRESS', ?, 1, datetime('now', '-10 minutes'),
                    datetime('now', '-10 minutes'), datetime('now', '-10 minutes'),
                    'worker-old', datetime('now', '-10 minutes'), datetime('now', '-10 minutes')
                )
                """,
                ("job-4", "noop", json.dumps({"message": "hello"})),
            )
            connection.commit()

        store = self._make_store(stale_lock_seconds=60)

        recovered_count = store.requeue_stale_jobs()
        row = self._fetch_job("job-4")

        self.assertEqual(recovered_count, 1)
        self.assertEqual(row["status"], "PENDING")
        self.assertIn("Worker lock expired; job requeued.", row["error"])
        self.assertIsNone(row["lockedAt"])
        self.assertIsNone(row["workerId"])

    def test_load_config_reads_repo_env_file(self) -> None:
        env_path = Path(self.temp_dir.name) / ".env"
        env_path.write_text(
            'DATABASE_URL="postgresql://worker:test@localhost:5432/app"\n'
            'WORKER_POLL_INTERVAL_SECONDS="1.5"\n'
            'WORKER_ID="worker-from-env"\n'
            'WORKER_MAX_ATTEMPTS="5"\n'
            'WORKER_RETRY_BACKOFF_SECONDS="20"\n'
            'WORKER_STALE_LOCK_SECONDS="600"\n',
            encoding="utf-8",
        )

        with patch.dict(os.environ, {}, clear=True):
            config = load_config(env_path=env_path)

        self.assertEqual(config.database_url, "postgresql://worker:test@localhost:5432/app")
        self.assertEqual(config.poll_interval_seconds, 1.5)
        self.assertEqual(config.worker_id, "worker-from-env")
        self.assertEqual(config.max_attempts, 5)
        self.assertEqual(config.retry_backoff_seconds, 20)
        self.assertEqual(config.stale_lock_seconds, 600)

    def _make_store(
        self,
        *,
        max_attempts: int = 3,
        retry_backoff_seconds: float = 15,
        stale_lock_seconds: float = 300,
    ) -> JobStore:
        return JobStore(
            WorkerConfig(
                database_url=f"file:{self.db_path}",
                poll_interval_seconds=0.1,
                worker_id="worker-test",
                max_attempts=max_attempts,
                retry_backoff_seconds=retry_backoff_seconds,
                stale_lock_seconds=stale_lock_seconds,
            )
        )

    def _create_schema(self) -> None:
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                CREATE TABLE BackgroundJob (
                    id TEXT PRIMARY KEY,
                    jobType TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'PENDING',
                    payload TEXT,
                    result TEXT,
                    error TEXT,
                    attemptCount INTEGER NOT NULL DEFAULT 0,
                    availableAt TEXT NOT NULL,
                    startedAt TEXT,
                    lockedAt TEXT,
                    finishedAt TEXT,
                    workerId TEXT,
                    createdByUserId TEXT,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                )
                """
            )
            connection.commit()

    def _insert_job(self, job_id: str, job_type: str, payload: dict[str, object]) -> None:
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                INSERT INTO BackgroundJob (
                    id, jobType, status, payload, attemptCount,
                    availableAt, createdAt, updatedAt
                ) VALUES (?, ?, 'PENDING', ?, 0, datetime('now', '-1 minute'), datetime('now'), datetime('now'))
                """,
                (job_id, job_type, json.dumps(payload)),
            )
            connection.commit()

    def _fetch_job(self, job_id: str) -> sqlite3.Row:
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.row_factory = sqlite3.Row
            row = connection.execute(
                "SELECT * FROM BackgroundJob WHERE id = ?",
                (job_id,),
            ).fetchone()

        assert row is not None
        return row


if __name__ == "__main__":
    unittest.main()
