from __future__ import annotations

import json
import os
import uuid
import tempfile
import unittest
from typing import Any
from urllib.parse import urlencode, urlsplit

import psycopg
from psycopg.rows import dict_row
from psycopg import sql
from pathlib import Path
from unittest.mock import patch

from starter_worker.config import WorkerConfig, load_config
from starter_worker.db import JobStore, normalize_postgres_database_url
from starter_worker.main import (
    _log_job_claimed,
    _log_job_completed,
    _log_job_failed,
    _log_jobs_requeued_stale,
    _log_teams_poll_scheduled,
    process_inbound_mail_poll,
    process_job,
    process_teams_intake_poll,
)


class WorkerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.base_url = os.environ.get(
            "TEST_DATABASE_URL",
            "postgresql://starter:starter_e2e_password@127.0.0.1:55432/business_app_starter_e2e_test",
        )
        if not urlsplit(self.base_url).path.endswith("_test"):
            raise ValueError("Worker database tests require a dedicated database ending in _test")
        self.schema = "worker_test_" + uuid.uuid4().hex
        separator = "&" if "?" in self.base_url else "?"
        self.database_url = (
            self.base_url + separator + urlencode({"options": "-csearch_path=" + self.schema})
        )
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
                            "recipientName": "User",
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

    def test_process_job_rejects_invalid_notification_payload(self) -> None:
        with self.assertRaises(ValueError):
            process_job(
                type(
                    "Job",
                    (),
                    {
                        "job_type": "notification_delivery",
                        "payload": {"notificationId": "notification-1"},
                    },
                )()
            )

    def test_process_job_rejects_unknown_notification_fields(self) -> None:
        with self.assertRaises(ValueError):
            process_job(
                type(
                    "Job",
                    (),
                    {
                        "job_type": "notification_delivery",
                        "payload": {
                            "notificationId": "notification-1",
                            "recipientEmail": "user@example.com",
                            "recipientName": "User",
                            "subject": "Test",
                            "bodyText": "Hello",
                            "unexpected": True,
                        },
                    },
                )()
            )

    def test_process_job_teams_delivery_sends_message(self) -> None:
        with patch(
            "starter_worker.main.send_teams_channel_message", return_value={"id": "graph-1"}
        ) as send_teams:
            result = process_job(
                type(
                    "Job",
                    (),
                    {
                        "job_type": "teams_message_delivery",
                        "id": "claimed-job-1",
                        "payload": {
                            "teamsOutboundMessageId": "outbound-1",
                            "targetId": "target-1",
                            "teamId": "team-1",
                            "channelId": "channel-1",
                            "content": "<p>hello</p>",
                        },
                    },
                )()
            )

        send_teams.assert_called_once_with("claimed-job-1")
        self.assertEqual(result["teamsOutboundMessageId"], "outbound-1")
        self.assertEqual(result["graphMessageId"], "graph-1")
        self.assertEqual(result["status"], "sent")

    def test_process_job_rejects_invalid_teams_payload(self) -> None:
        with self.assertRaises(ValueError):
            process_job(
                type(
                    "Job",
                    (),
                    {
                        "job_type": "teams_message_delivery",
                        "payload": {
                            "teamsOutboundMessageId": "outbound-1",
                            "teamId": "",
                            "channelId": "channel-1",
                            "content": "hello",
                        },
                    },
                )()
            )

    def test_process_job_rejects_bad_delivery_payloads_before_sending(self) -> None:
        valid_payloads: dict[str, dict[str, object]] = {
            "notification_delivery": {
                "notificationId": "notification-1",
                "recipientEmail": "user@example.com",
                "recipientName": "User",
                "subject": "Test",
                "bodyText": "Hello",
            },
            "teams_message_delivery": {
                "teamsOutboundMessageId": "outbound-1",
                "teamId": "team-1",
                "channelId": "channel-1",
                "content": "hello",
            },
        }
        with (
            patch("starter_worker.main.send_graph_mail") as send_mail,
            patch("starter_worker.main.send_teams_channel_message") as send_teams,
        ):
            for job_type, payload in valid_payloads.items():
                for invalid in [
                    {**payload, "unexpected": True},
                    {**payload, "bodyHtml": 42}
                    if job_type == "notification_delivery"
                    else {**payload, "contentType": "javascript"},
                    {**payload, "bodyText": b"Hello"}
                    if job_type == "notification_delivery"
                    else {**payload, "content": b"hello"},
                ]:
                    with self.subTest(job_type=job_type, payload=invalid):
                        with self.assertRaises(ValueError):
                            process_job(
                                type("Job", (), {"job_type": job_type, "payload": invalid})()
                            )
            send_mail.assert_not_called()
            send_teams.assert_not_called()

    def test_process_inbound_mail_poll_stores_bounces_and_entity_links(self) -> None:
        with (
            patch(
                "starter_worker.main.list_graph_mail_messages",
                return_value=[
                    {"id": "msg-bounce"},
                    {"id": "msg-link"},
                ],
            ),
            patch(
                "starter_worker.main.get_graph_mail_message",
                side_effect=[
                    {
                        "id": "msg-bounce",
                        "subject": "Undeliverable [notification:notification-1]",
                        "bodyPreview": "Delivery failed",
                        "receivedDateTime": "2026-04-20T10:00:00Z",
                        "from": {
                            "emailAddress": {
                                "address": "postmaster@example.com",
                                "name": "Postmaster",
                            }
                        },
                        "body": {
                            "contentType": "text",
                            "content": "Delivery failed [notification:notification-1]",
                        },
                        "internetMessageHeaders": [
                            {
                                "name": "In-Reply-To",
                                "value": "<provider-message-1@example.com>",
                            }
                        ],
                    },
                    {
                        "id": "msg-link",
                        "subject": "Question [ref:Scope:scope-7]",
                        "bodyPreview": "Can you help?",
                        "receivedDateTime": "2026-04-20T10:05:00Z",
                        "from": {
                            "emailAddress": {"address": "person@example.com", "name": "Person"}
                        },
                        "body": {
                            "contentType": "text",
                            "content": "Following up on [ref:Scope:scope-7]",
                        },
                        "internetMessageHeaders": [],
                    },
                ],
            ),
        ):
            self._insert_notification(
                "notification-1",
                provider_message_id="<provider-message-1@example.com>",
            )
            store = self._make_store()
            result = process_inbound_mail_poll(store, {"mailbox": "shared@example.com"})

        self.assertEqual(result["created"], 2)
        self.assertEqual(result["bounced"], 1)
        self.assertEqual(result["linked"], 1)

        inbound_bounce = self._fetch_inbound_email("msg-bounce")
        inbound_link = self._fetch_inbound_email("msg-link")
        bounced_notification = self._fetch_notification("notification-1")

        self.assertEqual(inbound_bounce["processingStatus"], "PROCESSED")
        self.assertEqual(inbound_bounce["correlatedNotificationId"], "notification-1")
        self.assertEqual(inbound_link["processingStatus"], "PROCESSED")
        self.assertEqual(inbound_link["linkedEntityType"], "Scope")
        self.assertEqual(inbound_link["linkedEntityId"], "scope-7")
        self.assertEqual(bounced_notification["status"], "BOUNCED")

    def test_process_inbound_mail_poll_ignores_spoofed_bounce_content(self) -> None:
        with (
            patch(
                "starter_worker.main.list_graph_mail_messages",
                return_value=[{"id": "msg-bounce-spoof"}],
            ),
            patch(
                "starter_worker.main.get_graph_mail_message",
                return_value={
                    "id": "msg-bounce-spoof",
                    "subject": "Undeliverable [notification:notification-1]",
                    "bodyPreview": "Delivery failed",
                    "receivedDateTime": "2026-04-20T10:00:00Z",
                    "from": {
                        "emailAddress": {
                            "address": "postmaster@example.com",
                            "name": "Postmaster",
                        }
                    },
                    "body": {
                        "contentType": "text",
                        "content": "Delivery failed [notification:notification-1]",
                    },
                    "internetMessageHeaders": [
                        {
                            "name": "In-Reply-To",
                            "value": "<different-provider-message@example.com>",
                        }
                    ],
                },
            ),
        ):
            self._insert_notification(
                "notification-1",
                provider_message_id="<provider-message-1@example.com>",
            )
            store = self._make_store()
            result = process_inbound_mail_poll(store, {"mailbox": "shared@example.com"})

        self.assertEqual(result["created"], 1)
        self.assertEqual(result["bounced"], 0)
        self.assertEqual(result["ignored"], 1)

        inbound_bounce = self._fetch_inbound_email("msg-bounce-spoof")
        notification = self._fetch_notification("notification-1")

        self.assertEqual(inbound_bounce["processingStatus"], "IGNORED")
        self.assertEqual(notification["status"], "SENT")

    def test_postgres_job_store_claims_and_completes_job(self) -> None:
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

    def test_postgres_job_store_retries_failure_before_max_attempts(self) -> None:
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

    def test_postgres_job_store_marks_terminal_failure_after_max_attempts(self) -> None:
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

    def test_teams_retries_stay_fixed_and_stop_after_three_attempts(self) -> None:
        self._insert_job("teams-retry", "teams_message_delivery", {})
        store = self._make_store(max_attempts=9, retry_backoff_seconds=15)
        for attempt in range(1, 4):
            job = store.claim_next_job()
            assert job is not None
            self.assertEqual(job.attempt_count, attempt)
            store.fail_job(job.id, "send failed")
            row = self._fetch_job(job.id)
            if attempt == 3:
                self.assertEqual(row["status"], "FAILED")
                self.assertIsNotNone(row["finishedAt"])
            else:
                self.assertEqual(row["status"], "PENDING")
                self.assertAlmostEqual((row["availableAt"] - row["updatedAt"]).total_seconds(), 15, delta=1)
                with self._connect() as connection:
                    connection.execute('UPDATE "BackgroundJob" SET "availableAt" = NOW() WHERE id = %s', (job.id,))
        self.assertEqual(store._retry_delay_seconds(2, "notification_delivery"), 30)

    def test_worker_retry_cannot_overwrite_a_persisted_teams_delivery_receipt(self) -> None:
        with self._connect() as connection:
            connection.execute('''INSERT INTO "TeamsDeliveryTarget" (id, name, "teamId", "channelId", "createdByUserId", "updatedAt")
                VALUES ('target', 'Target', 'team', 'channel', 'admin-1', NOW())''')
            connection.execute('''INSERT INTO "TeamsOutboundMessage" (id, "targetId", "eventType", content, status, "graphMessageId", "sentAt", "updatedAt")
                VALUES ('outbound', 'target', 'USER_CREATED', 'Hello', 'SENT', 'graph-receipt', NOW(), NOW())''')
        store = self._make_store()
        store.mark_teams_outbound_processing("outbound", 2)
        store.mark_teams_outbound_failed("outbound", "response lost", 2, will_retry=True)
        with self._connect() as connection:
            row = connection.execute('SELECT status, "graphMessageId", "lastError", "sentAt" FROM "TeamsOutboundMessage" WHERE id = %s', ("outbound",)).fetchone()
        assert row is not None
        self.assertEqual(row["status"], "SENT")
        self.assertEqual(row["graphMessageId"], "graph-receipt")
        self.assertIsNone(row["lastError"])
        self.assertIsNotNone(row["sentAt"])

    def test_postgres_job_store_requeues_stale_in_progress_job(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO "BackgroundJob" (
                    id, "jobType", status, payload, "attemptCount", "availableAt", "startedAt",
                    "lockedAt", "workerId", "createdAt", "updatedAt"
                ) VALUES (
                    %s, %s, 'IN_PROGRESS', %s, 1, (NOW() - INTERVAL '10 minutes'),
                    (NOW() - INTERVAL '10 minutes'), (NOW() - INTERVAL '10 minutes'),
                    'worker-old', (NOW() - INTERVAL '10 minutes'), (NOW() - INTERVAL '10 minutes')
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

    def test_process_teams_intake_poll_stores_messages_and_updates_delta(self) -> None:
        with self._connect() as connection:
            connection.execute('''INSERT INTO "TeamsIntegrationConfig" (id, "intakeEnabled", "updatedAt") VALUES ('default', true, NOW())''')
            connection.execute(
                """
                INSERT INTO "TeamsIntakeSubscription" (
                    id, "teamId", "channelId", active, "deltaToken", "createdByUserId", "createdAt", "updatedAt"
                ) VALUES (
                    'sub-1', 'team-1', 'channel-1', true, NULL, 'admin-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """
            )
            connection.commit()

        with patch(
            "starter_worker.main.list_teams_channel_messages",
            return_value={
                "value": [
                    {
                        "id": "teams-msg-1",
                        "createdDateTime": "2026-04-27T10:00:00Z",
                        "body": {"contentType": "html", "content": "<p>hi</p>"},
                        "from": {"user": {"id": "u-1", "displayName": "User One"}},
                    }
                ],
                "@odata.deltaLink": "/delta-token-1",
            },
        ):
            store = self._make_store()
            with patch.dict(os.environ, {"TEAMS_ENABLED": "true"}):
                result = process_teams_intake_poll(store)

        self.assertEqual(result["created"], 1)
        with self._connect() as connection:
            row = connection.execute(
                'SELECT "providerMessageId" FROM "TeamsInboundMessage" WHERE "providerMessageId" = %s',
                ("teams-msg-1",),
            ).fetchone()
            self.assertIsNotNone(row)
            sub = connection.execute(
                'SELECT "deltaToken" FROM "TeamsIntakeSubscription" WHERE id = \'sub-1\'',
            ).fetchone()
            assert sub is not None
            self.assertIsNone(sub["deltaToken"])

        with self._connect() as connection:
            connection.execute('UPDATE "TeamsIntegrationConfig" SET "intakeEnabled" = false')
        with patch.dict(os.environ, {"TEAMS_ENABLED": "true"}), patch("starter_worker.main.list_teams_channel_messages") as graph:
            self.assertEqual(process_teams_intake_poll(store)["subscriptions"], 0)
            graph.assert_not_called()

    def test_load_config_reads_repo_env_file(self) -> None:
        env_path = Path(self.temp_dir.name) / ".env"
        env_path.write_text(
            'DATABASE_URL="postgresql://worker:test@localhost:5432/app"\n'
            'WORKER_POLL_INTERVAL_SECONDS="1.5"\n'
            'WORKER_ID="worker-from-env"\n'
            'WORKER_MAX_ATTEMPTS="5"\n'
            'WORKER_RETRY_BACKOFF_SECONDS="20"\n'
            'WORKER_STALE_LOCK_SECONDS="600"\n'
            'TEAMS_POLL_INTERVAL_SECONDS="45"\n',
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
        self.assertEqual(config.teams_poll_interval_seconds, 45)

    def test_load_config_prefers_worker_database_url(self) -> None:
        env_path = Path(self.temp_dir.name) / ".env"
        env_path.write_text(
            'DATABASE_URL="postgresql://legacy:test@localhost:5432/app"\n'
            'WORKER_DATABASE_URL="postgresql://worker:test@localhost:5432/app"\n',
            encoding="utf-8",
        )

        with patch.dict(os.environ, {}, clear=True):
            config = load_config(env_path=env_path)

        self.assertEqual(config.database_url, "postgresql://worker:test@localhost:5432/app")

    def test_load_config_rejects_invalid_numeric_settings(self) -> None:
        with (
            patch.dict(
                os.environ, {"WORKER_MAX_ATTEMPTS": "0", "DATABASE_URL": self.base_url}, clear=True
            ),
            self.assertRaises(ValueError),
        ):
            load_config(env_path=Path(self.temp_dir.name) / ".env")

    def test_worker_rejects_missing_and_unsupported_database_urls_without_exposing_credentials(
        self,
    ) -> None:
        for url in ["", "file:./dev.db", "https://worker:private-password@db/app"]:
            with self.subTest(url=url), patch.dict(os.environ, {"DATABASE_URL": url}, clear=True):
                with self.assertRaises(ValueError) as error:
                    load_config(env_path=Path(self.temp_dir.name) / ".env")
                self.assertNotIn("private-password", str(error.exception))
        with self.assertRaises(ValueError):
            normalize_postgres_database_url("file:./dev.db")

    def test_worker_lifecycle_logs_use_structured_events(self) -> None:
        job = type(
            "Job",
            (),
            {"id": "job-1", "job_type": "noop", "attempt_count": 2},
        )()

        error = RuntimeError("bad job")
        with patch("starter_worker.main.worker_logger") as worker_logger:
            _log_jobs_requeued_stale(3)
            _log_teams_poll_scheduled()
            _log_job_claimed(job)
            _log_job_completed(job, {"status": "ok", "token": "secret"})
            _log_job_failed(job, error)

        worker_logger.warning.assert_called_once_with("jobs.requeued_stale", count=3)
        worker_logger.info.assert_any_call("teams.poll_scheduled")
        worker_logger.info.assert_any_call(
            "job.claimed",
            jobId="job-1",
            jobType="noop",
            attempt=2,
        )
        worker_logger.info.assert_any_call(
            "job.completed",
            jobId="job-1",
            jobType="noop",
            status="completed",
            result={"status": "ok", "token": "[REDACTED]"},
        )
        worker_logger.exception.assert_called_once_with(
            "job.failed",
            error,
            jobId="job-1",
            jobType="noop",
            attempt=2,
        )

    def test_worker_strips_prisma_only_postgres_url_params(self) -> None:
        url = normalize_postgres_database_url(
            "postgresql://worker:test@localhost:5432/app?connection_limit=10&sslmode=require"
        )

        self.assertEqual(
            url,
            "postgresql://worker:test@localhost:5432/app?sslmode=require",
        )

    def _make_store(
        self,
        *,
        max_attempts: int = 3,
        retry_backoff_seconds: float = 15,
        stale_lock_seconds: float = 300,
    ) -> JobStore:
        return JobStore(
            WorkerConfig(
                database_url=self.database_url,
                poll_interval_seconds=0.1,
                worker_id="worker-test",
                max_attempts=max_attempts,
                retry_backoff_seconds=retry_backoff_seconds,
                stale_lock_seconds=stale_lock_seconds,
                teams_poll_interval_seconds=60,
            )
        )

    def _connect(self) -> psycopg.Connection[dict[str, Any]]:
        return psycopg.connect(self.database_url, row_factory=dict_row, connect_timeout=10)

    def _drop_schema(self) -> None:
        with psycopg.connect(self.base_url, autocommit=True, connect_timeout=10) as connection:
            # psycopg Identifier quotes the generated schema name; this is not string interpolation.
            # nosemgrep: python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query
            connection.execute(
                sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(self.schema))
            )

    def _create_schema(self) -> None:
        with psycopg.connect(self.base_url, autocommit=True, connect_timeout=10) as connection:
            # psycopg Identifier quotes the generated schema name; this is not string interpolation.
            # nosemgrep: python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query
            connection.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(self.schema)))
        self.addCleanup(self._drop_schema)
        migrations = Path(__file__).resolve().parents[2] / "prisma/migrations"
        with self._connect() as connection:
            for migration in sorted(migrations.glob("*/migration.sql")):
                connection.execute(migration.read_text(encoding="utf-8"))
            connection.execute("""INSERT INTO "User" (id, email, name, "authMethod", "updatedAt")
                VALUES ('admin-1', 'admin@example.com', 'Admin', 'LOCAL', NOW())""")

    def _insert_job(self, job_id: str, job_type: str, payload: dict[str, object]) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO "BackgroundJob" (
                    id, "jobType", status, payload, "attemptCount",
                    "availableAt", "createdAt", "updatedAt"
                ) VALUES (%s, %s, 'PENDING', %s, 0, (NOW() - INTERVAL '1 minutes'), NOW(), NOW())
                """,
                (job_id, job_type, json.dumps(payload)),
            )
            connection.commit()

    def _fetch_job(self, job_id: str) -> dict[str, Any]:
        with self._connect() as connection:
            row: dict[str, Any] | None = connection.execute(
                'SELECT * FROM "BackgroundJob" WHERE id = %s',
                (job_id,),
            ).fetchone()

        assert row is not None
        return row

    def _insert_notification(
        self,
        notification_id: str,
        *,
        provider_message_id: str | None = None,
    ) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO "NotificationEvent" (id, "eventType", payload) VALUES (%s, 'USER_CREATED', '{}')""",
                ("event-" + notification_id,),
            )
            connection.execute(
                """INSERT INTO "Notification" (id, "eventId", "recipientEmail", subject, "bodyText", "providerMessageId", status, "lastError", "updatedAt")
                VALUES (%s, %s, 'recipient@example.com', 'Test', 'Test', %s, 'SENT', NULL, CURRENT_TIMESTAMP)
                """,
                (
                    notification_id,
                    "event-" + notification_id,
                    provider_message_id or f"<provider-{notification_id}@example.com>",
                ),
            )
            connection.commit()

    def _fetch_notification(self, notification_id: str) -> dict[str, Any]:
        with self._connect() as connection:
            row: dict[str, Any] | None = connection.execute(
                'SELECT * FROM "Notification" WHERE id = %s',
                (notification_id,),
            ).fetchone()

        assert row is not None
        return row

    def _fetch_inbound_email(self, inbound_email_id: str) -> dict[str, Any]:
        with self._connect() as connection:
            row: dict[str, Any] | None = connection.execute(
                'SELECT * FROM "InboundEmail" WHERE id = %s',
                (inbound_email_id,),
            ).fetchone()

        assert row is not None
        return row


if __name__ == "__main__":
    unittest.main()
