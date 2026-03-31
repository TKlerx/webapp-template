from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from starter_worker.config import WorkerConfig
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

    def test_sqlite_job_store_claims_and_completes_job(self) -> None:
        self._insert_job(job_id="job-1", job_type="noop", payload={"message": "hello"})
        store = JobStore(
            WorkerConfig(
                database_url=f"file:{self.db_path}",
                poll_interval_seconds=0.1,
                worker_id="worker-test",
            )
        )

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

    def test_sqlite_job_store_marks_failure(self) -> None:
        self._insert_job(job_id="job-2", job_type="echo", payload={"message": "x"})
        store = JobStore(
            WorkerConfig(
                database_url=f"file:{self.db_path}",
                poll_interval_seconds=0.1,
                worker_id="worker-test",
            )
        )

        job = store.claim_next_job()

        self.assertIsNotNone(job)
        assert job is not None
        store.fail_job(job.id, "bad job")
        row = self._fetch_job("job-2")

        self.assertEqual(row["status"], "FAILED")
        self.assertEqual(row["error"], "bad job")
        self.assertEqual(row["workerId"], "worker-test")
        self.assertIsNotNone(row["finishedAt"])

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
