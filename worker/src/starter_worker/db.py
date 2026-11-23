from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg
from psycopg.rows import dict_row

from .config import WorkerConfig

PRISMA_ONLY_QUERY_PARAMS = frozenset({"connection_limit", "schema"})


def normalize_postgres_database_url(database_url: str) -> str:
    parsed = urlsplit(database_url)
    if parsed.scheme not in {"postgres", "postgresql"} or not parsed.hostname:
        raise ValueError("A PostgreSQL database URL is required")
    query = urlencode(
        [
            (key, value)
            for key, value in parse_qsl(parsed.query, keep_blank_values=True)
            if key not in PRISMA_ONLY_QUERY_PARAMS
        ],
    )
    return urlunsplit(parsed._replace(query=query))


@dataclass
class BackgroundJob:
    id: str
    job_type: str
    payload: dict[str, Any]
    attempt_count: int


class JobStore:
    def __init__(self, config: WorkerConfig) -> None:
        self._config = config
        self._schema = dict(parse_qsl(urlsplit(config.database_url).query)).get("schema")
        self._postgres_database_url = normalize_postgres_database_url(
            config.database_url,
        )

    def _connect(self, **kwargs: Any) -> psycopg.Connection[Any]:
        connection = psycopg.connect(self._postgres_database_url, **kwargs)
        if self._schema:
            try:
                connection.execute(
                    "SELECT pg_catalog.set_config('search_path', pg_catalog.quote_ident(%s), false)",
                    (self._schema,),
                )
            except Exception:
                connection.close()
                raise
        return connection

    def renew_claim(self, job: BackgroundJob) -> bool:
        with self._connect(connect_timeout=5) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE "BackgroundJob" SET "lockedAt" = NOW()
                    WHERE id = %s AND status = 'IN_PROGRESS'
                      AND "attemptCount" = %s AND "workerId" = %s
                    """,
                    (job.id, job.attempt_count, self._config.worker_id),
                )
                return cursor.rowcount == 1

    def complete_job(self, job: BackgroundJob, result: dict[str, Any]) -> bool:
        payload = json.dumps(result)

        with self._connect() as connection:
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
                    WHERE id = %s AND status = 'IN_PROGRESS'
                      AND "attemptCount" = %s AND "workerId" = %s
                    """,
                    (payload, job.id, job.attempt_count, self._config.worker_id),
                )
                if cursor.rowcount != 1:
                    return False
                notification_id = job.payload.get("notificationId")
                if job.job_type == "notification_delivery" and notification_id:
                    cursor.execute(
                        """
                        UPDATE "Notification"
                        SET status = 'SENT', "retryCount" = %s, "lastError" = NULL,
                            "sentAt" = NOW(), "updatedAt" = NOW(),
                            "providerMessageId" = COALESCE(%s, "providerMessageId")
                        WHERE id = %s AND status <> 'BOUNCED'
                        """,
                        (job.attempt_count - 1, result.get("providerMessageId"), notification_id),
                    )
            connection.commit()
            return True

    def mark_notification_processing(self, notification_id: str, attempt_count: int) -> None:
        retry_count = max(attempt_count - 1, 0)

        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE "Notification"
                    SET status = 'SENDING',
                        "retryCount" = %s,
                        "updatedAt" = NOW()
                    WHERE id = %s AND status NOT IN ('SENT', 'BOUNCED')
                    """,
                    (retry_count, notification_id),
                )
            connection.commit()

    def mark_notification_failed(
        self,
        notification_id: str,
        error: str,
        attempt_count: int,
        *,
        will_retry: bool,
    ) -> None:
        retry_count = max(attempt_count - 1, 0)
        status = "RETRYING" if will_retry else "FAILED"

        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE "Notification"
                    SET status = %s,
                        "retryCount" = %s,
                        "lastError" = %s,
                        "updatedAt" = NOW()
                    WHERE id = %s
                    """,
                    (status, retry_count, error, notification_id),
                )
            connection.commit()

    def find_inbound_email(
        self, provider_message_id: str, mailbox: str, internet_message_id: str | None,
    ) -> dict[str, Any] | None:

        with self._connect(row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, "processingStatus" FROM "InboundEmail"
                    WHERE "providerMessageId" = %s OR (mailbox = %s AND "internetMessageId" = %s)
                    ORDER BY ("providerMessageId" = %s) DESC, "createdAt" ASC
                    LIMIT 1
                    """,
                    (provider_message_id, mailbox, internet_message_id, provider_message_id),
                )
                return cursor.fetchone()

    def create_inbound_email(self, payload: dict[str, Any]) -> str:
        reference_ids = json.dumps(payload.get("referenceIds") or [])

        with self._connect() as connection:
            with connection.cursor() as pg_cursor:
                pg_cursor.execute(
                    """
                    INSERT INTO "InboundEmail" (
                        id, "providerMessageId", mailbox, "internetMessageId", "conversationId",
                        "senderEmail", "senderName", subject, "bodyPreview", "bodyText", "bodyHtml",
                        "inReplyTo", "referenceIds", "receivedAt", "processingStatus", "createdAt", "updatedAt"
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'RECEIVED', NOW(), NOW()
                    )
                    """,
                    (
                        payload["id"],
                        payload["providerMessageId"],
                        payload["mailbox"],
                        payload.get("internetMessageId"),
                        payload.get("conversationId"),
                        payload.get("senderEmail"),
                        payload.get("senderName"),
                        payload.get("subject") or "",
                        payload.get("bodyPreview"),
                        payload.get("bodyText"),
                        payload.get("bodyHtml"),
                        payload.get("inReplyTo"),
                        reference_ids,
                        payload["receivedAt"],
                    ),
                )
            connection.commit()
        return str(payload["id"])

    def update_inbound_email(
        self,
        inbound_email_id: str,
        *,
        processing_status: str,
        processing_notes: str,
        correlated_notification_id: str | None = None,
        linked_entity_type: str | None = None,
        linked_entity_id: str | None = None,
    ) -> None:

        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE "InboundEmail"
                    SET "processingStatus" = %s,
                        "processingNotes" = %s,
                        "correlatedNotificationId" = %s,
                        "linkedEntityType" = %s,
                        "linkedEntityId" = %s,
                        "updatedAt" = NOW()
                    WHERE id = %s
                    """,
                    (
                        processing_status,
                        processing_notes,
                        correlated_notification_id,
                        linked_entity_type,
                        linked_entity_id,
                        inbound_email_id,
                    ),
                )
            connection.commit()

    def mark_notification_bounced(self, notification_id: str, error: str) -> None:

        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE "Notification"
                    SET status = 'BOUNCED',
                        "lastError" = %s,
                        "updatedAt" = NOW()
                    WHERE id = %s
                    """,
                    (error, notification_id),
                )
            connection.commit()

    def find_notification_by_provider_message_id(
        self, provider_message_ids: list[str]
    ) -> dict[str, object] | None:
        if not provider_message_ids:
            return None

        with self._connect() as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT id, "providerMessageId"
                    FROM "Notification"
                    WHERE "providerMessageId" = ANY(%s)
                    LIMIT 1
                    """,
                    (provider_message_ids,),
                )
                return cursor.fetchone()

    def mark_teams_outbound_processing(self, outbound_message_id: str, attempt_count: int) -> None:

        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE "TeamsOutboundMessage"
                    SET status = 'SENDING',
                        "attemptCount" = %s,
                        "updatedAt" = NOW()
                    WHERE id = %s AND status <> 'SENT'
                    """,
                    (attempt_count, outbound_message_id),
                )
            connection.commit()

    def mark_teams_outbound_failed(
        self,
        outbound_message_id: str,
        error: str,
        attempt_count: int,
        *,
        will_retry: bool,
    ) -> None:
        status = "RETRYING" if will_retry else "FAILED"

        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE "TeamsOutboundMessage"
                    SET status = %s,
                        "attemptCount" = %s,
                        "lastError" = %s,
                        "updatedAt" = NOW()
                    WHERE id = %s AND status <> 'SENT'
                    """,
                    (status, attempt_count, error, outbound_message_id),
                )
            connection.commit()

    def has_teams_inbound_message(self, team_id: str, channel_id: str, provider_message_id: str) -> bool:

        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    'SELECT 1 FROM "TeamsInboundMessage" WHERE "teamId" = %s AND "channelId" = %s AND "providerMessageId" = %s LIMIT 1',
                    (team_id, channel_id, provider_message_id),
                )
                row = cursor.fetchone()
            connection.commit()
            return row is not None

    def create_teams_inbound_message(self, payload: dict[str, Any]) -> str:

        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO "TeamsInboundMessage" (
                        id, "subscriptionId", "providerMessageId", "teamId", "channelId", "senderDisplayName",
                        "senderUserId", content, "contentType", truncated, "processingStatus",
                        "processingNotes", "messageCreatedAt", "createdAt", "updatedAt"
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'RECEIVED', NULL, %s, NOW(), NOW())
                    """,
                    (
                        payload["id"],
                        payload["subscriptionId"],
                        payload["providerMessageId"],
                        payload["teamId"],
                        payload["channelId"],
                        payload.get("senderDisplayName"),
                        payload.get("senderUserId"),
                        payload.get("content"),
                        payload.get("contentType"),
                        bool(payload.get("truncated")),
                        payload["messageCreatedAt"],
                    ),
                )
            connection.commit()
        return str(payload["id"])

    def update_teams_subscription_poll_state(
        self,
        subscription_id: str,
        delta_token: str | None,
    ) -> None:

        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE "TeamsIntakeSubscription"
                    SET "deltaToken" = %s,
                        "lastPolledAt" = NOW(),
                        "updatedAt" = NOW()
                    WHERE id = %s
                    """,
                    (delta_token, subscription_id),
                )
            connection.commit()

    def list_active_teams_subscriptions(self) -> list[dict[str, Any]]:

        with self._connect(row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, "teamId", "channelId", "deltaToken"
                    FROM "TeamsIntakeSubscription"
                    WHERE active = true
                    ORDER BY "createdAt" ASC
                    """
                )
                rows = cursor.fetchall()
            connection.commit()
            return list(rows)

    def create_teams_intake_poll_job_if_missing(self) -> bool:

        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_xact_lock(665780422, 1)")
                cursor.execute(
                    """
                    SELECT 1 FROM "BackgroundJob"
                    WHERE "jobType" = 'teams_intake_poll'
                      AND status IN ('PENDING', 'IN_PROGRESS')
                    LIMIT 1
                    """
                )
                if cursor.fetchone():
                    connection.commit()
                    return False

                cursor.execute(
                    """
                    INSERT INTO "BackgroundJob" (
                        id, "jobType", status, payload, "attemptCount", "availableAt", "createdAt", "updatedAt"
                    ) VALUES (
                        md5(random()::text || clock_timestamp()::text),
                        'teams_intake_poll',
                        'PENDING',
                        '{}',
                        0,
                        NOW(),
                        NOW(),
                        NOW()
                    )
                    """
                )
            connection.commit()
            return True

    def get_teams_integration_flags(self) -> dict[str, bool]:

        with self._connect(row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT "sendEnabled", "intakeEnabled"
                    FROM "TeamsIntegrationConfig"
                    ORDER BY "createdAt" ASC
                    LIMIT 1
                    """
                )
                row = cursor.fetchone()
            connection.commit()
            if not row:
                return {"sendEnabled": False, "intakeEnabled": False}
            return {
                "sendEnabled": bool(row["sendEnabled"]),
                "intakeEnabled": bool(row["intakeEnabled"]),
            }

    def claim_next_job(self) -> BackgroundJob | None:
        with self._connect(row_factory=dict_row) as connection:
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

    def requeue_stale_jobs(self) -> int:
        with self._connect(row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    WITH stale AS (
                        SELECT id, "attemptCount" >= CASE
                            WHEN "jobType" = 'teams_message_delivery' THEN %s
                            ELSE %s
                        END AS exhausted
                        FROM "BackgroundJob"
                        WHERE status = 'IN_PROGRESS'
                          AND "lockedAt" <= NOW() - (%s * INTERVAL '1 second')
                        FOR UPDATE SKIP LOCKED
                    )
                    UPDATE "BackgroundJob" job
                    SET status = (CASE WHEN stale.exhausted THEN 'FAILED' ELSE 'PENDING' END)::"BackgroundJobStatus",
                        error = CASE
                            WHEN stale.exhausted THEN 'Worker lock expired; retry limit reached.'
                            WHEN error IS NULL OR error = '' THEN 'Worker lock expired; job requeued.'
                            ELSE error || E'\nWorker lock expired; job requeued.'
                        END,
                        "availableAt" = NOW(),
                        "lockedAt" = NULL,
                        "workerId" = NULL,
                        "finishedAt" = CASE WHEN stale.exhausted THEN NOW() ELSE NULL END,
                        "updatedAt" = NOW()
                    FROM stale
                    WHERE job.id = stale.id
                    RETURNING job."jobType", job.payload, job."attemptCount", stale.exhausted
                    """,
                    (
                        self._config.max_attempts_for("teams_message_delivery"),
                        self._config.max_attempts,
                        self._config.stale_lock_seconds,
                    ),
                )
                recovered = cursor.fetchall()
                for row in recovered:
                    if row["exhausted"]:
                        self._update_delivery_failure(
                            cursor, row["jobType"], _parse_payload(row["payload"]),
                            row["attemptCount"], "Worker lock expired; retry limit reached.",
                            should_retry=False,
                        )
            connection.commit()
            return len(recovered)

    def fail_job(self, job: BackgroundJob, error: str) -> bool:
        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id FROM "BackgroundJob"
                    WHERE id = %s AND status = 'IN_PROGRESS'
                      AND "attemptCount" = %s AND "workerId" = %s
                    FOR UPDATE
                    """,
                    (job.id, job.attempt_count, self._config.worker_id),
                )
                row = cursor.fetchone()
                if row is None:
                    return False

                attempt_count = job.attempt_count
                job_type = job.job_type
                should_retry = attempt_count < self._config.max_attempts_for(job_type)
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
                            + timedelta(seconds=self._retry_delay_seconds(attempt_count, job_type)),
                            job.id,
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
                        (error, job.id),
                    )
                self._update_delivery_failure(
                    cursor, job_type, job.payload, attempt_count, error,
                    should_retry=should_retry,
                )
            connection.commit()
            return True

    @staticmethod
    def _update_delivery_failure(
        cursor: psycopg.Cursor[Any],
        job_type: str,
        payload: dict[str, Any],
        attempt_count: int,
        error: str,
        *,
        should_retry: bool,
    ) -> None:
        status = "RETRYING" if should_retry else "FAILED"
        notification_id = payload.get("notificationId")
        if job_type == "notification_delivery" and isinstance(notification_id, str) and notification_id:
            cursor.execute(
                """
                UPDATE "Notification" SET status = %s, "retryCount" = %s,
                    "lastError" = %s, "updatedAt" = NOW()
                WHERE id = %s AND status NOT IN ('SENT', 'BOUNCED')
                """,
                (status, attempt_count - 1, error, notification_id),
            )
        outbound_id = payload.get("teamsOutboundMessageId")
        if job_type == "teams_message_delivery" and isinstance(outbound_id, str) and outbound_id:
            cursor.execute(
                """
                UPDATE "TeamsOutboundMessage" SET status = %s, "attemptCount" = %s,
                    "lastError" = %s, "updatedAt" = NOW()
                WHERE id = %s AND status <> 'SENT'
                """,
                (status, attempt_count, error, outbound_id),
            )

    def _retry_delay_seconds(self, attempt_count: int, job_type: str = "") -> float:
        multiplier = 1 if job_type == "teams_message_delivery" else max(attempt_count, 1)
        return max(self._config.retry_backoff_seconds, 0) * multiplier


def _parse_payload(value: str | None) -> dict[str, Any]:
    if not value:
        return {}

    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {"raw": value}

    return parsed if isinstance(parsed, dict) else {"value": parsed}
