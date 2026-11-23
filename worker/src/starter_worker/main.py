from __future__ import annotations

import logging
import os
import re
import time
from datetime import datetime, timezone
from threading import Event, Thread
from typing import Any
from uuid import uuid4

from .config import load_config
from .contracts import NotificationDeliveryPayload, TeamsMessageDeliveryPayload
from .db import BackgroundJob, JobStore
from .graph_mail import get_graph_mail_message, list_graph_mail_messages, send_graph_mail
from .graph_teams import iter_teams_channel_pages, send_teams_channel_message
from .logging import create_worker_logger, sanitize_log_meta


worker_logger = create_worker_logger()

NOTIFICATION_REFERENCE_PATTERN = re.compile(r"\[notification:([a-zA-Z0-9_-]+)\]", re.IGNORECASE)
ENTITY_REFERENCE_PATTERN = re.compile(r"\[ref:([a-zA-Z0-9_.-]+):([^\]\s]+)\]", re.IGNORECASE)
BOUNCE_SUBJECT_PATTERN = re.compile(
    r"(undeliverable|delivery (?:has )?failed|delivery status notification|failure notice|returned mail)",
    re.IGNORECASE,
)
BOUNCE_SENDER_PATTERN = re.compile(r"(mailer-daemon|postmaster)", re.IGNORECASE)


def process_job(job: BackgroundJob) -> dict[str, object]:
    if job.job_type == "noop":
        return {
            "message": "noop processed",
            "processedAt": datetime.now(timezone.utc).isoformat(),
        }

    if job.job_type == "echo":
        return {
            "echo": job.payload,
            "processedAt": datetime.now(timezone.utc).isoformat(),
        }

    if job.job_type == "notification_delivery":
        notification_payload = NotificationDeliveryPayload.model_validate(job.payload)

        reference = send_graph_mail(notification_payload.model_dump())
        return {
            "notificationId": notification_payload.notificationId,
            "providerMessageId": reference,
            "providerStatus": "accepted",
            "status": "sent",
            "processedAt": datetime.now(timezone.utc).isoformat(),
        }

    if job.job_type == "teams_message_delivery":
        teams_payload = TeamsMessageDeliveryPayload.model_validate(job.payload)

        response = send_teams_channel_message(job.id)
        return {
            "teamsOutboundMessageId": teams_payload.teamsOutboundMessageId,
            "graphMessageId": str(response.get("id") or "").strip() or None,
            "status": "sent",
            "processedAt": datetime.now(timezone.utc).isoformat(),
        }

    raise ValueError(f"Unsupported job type: {job.job_type}")


def process_teams_intake_poll(store: JobStore) -> dict[str, object]:
    if not _is_teams_enabled() or not store.get_teams_integration_flags()["intakeEnabled"]:
        return {"subscriptions": 0, "created": 0, "duplicates": 0}
    subscriptions = store.list_active_teams_subscriptions()
    created = 0
    duplicates = 0

    failures: list[Exception] = []
    for subscription in subscriptions:
        payload = {"teamId": subscription["teamId"], "channelId": subscription["channelId"], "top": 50}
        try:
            for messages in iter_teams_channel_pages(payload):
                for message in messages:
                    provider_message_id = str(message.get("id") or "").strip()
                    if not provider_message_id:
                        continue

                    if store.has_teams_inbound_message(subscription["teamId"], subscription["channelId"], provider_message_id):
                        duplicates += 1
                        continue

                    body = message.get("body") or {}
                    from_info = (
                        (message.get("from") or {}).get("user")
                        or (message.get("from") or {}).get("application")
                        or {}
                    )
                    content = str(body.get("content") or "")
                    content_type = str(body.get("contentType") or "html").lower()
                    truncated_content, truncated = _truncate_text(content, 64 * 1024)

                    store.create_teams_inbound_message(
                        {
                            "id": uuid4().hex,
                            "subscriptionId": subscription["id"],
                            "providerMessageId": provider_message_id,
                            "teamId": subscription["teamId"],
                            "channelId": subscription["channelId"],
                            "senderDisplayName": str(from_info.get("displayName") or "").strip() or None,
                            "senderUserId": str(from_info.get("id") or "").strip() or None,
                            "content": truncated_content,
                            "contentType": "text" if content_type == "text" else "html",
                            "truncated": truncated,
                            "messageCreatedAt": str(
                                message.get("createdDateTime") or datetime.now(timezone.utc).isoformat()
                            ),
                        }
                    )
                    created += 1

            store.update_teams_subscription_poll_state(subscription["id"], None)
        except Exception as error:  # noqa: BLE001 - Other subscriptions still need to be polled.
            failures.append(error)

    if failures:
        raise RuntimeError(f"Teams intake failed for {len(failures)} subscription(s): {failures[0]}") from failures[0]

    return {
        "subscriptions": len(subscriptions),
        "created": created,
        "duplicates": duplicates,
        "processedAt": datetime.now(timezone.utc).isoformat(),
    }


def process_inbound_mail_poll(store: JobStore, payload: dict[str, object]) -> dict[str, object]:
    mailbox = (
        str(payload.get("mailbox") or "").strip()
        or str(os.environ.get("MAIL_DEFAULT_MAILBOX") or "").strip()
    )
    if not mailbox:
        raise ValueError("MAIL_DEFAULT_MAILBOX is required for inbound_mail_poll jobs.")

    listed_messages = list_graph_mail_messages(payload)
    created = 0
    duplicates = 0
    bounced = 0
    linked = 0
    ignored = 0

    for summary in listed_messages:
        provider_message_id = str(summary.get("id") or "").strip()
        if not provider_message_id:
            continue

        existing = store.find_inbound_email(
            provider_message_id, mailbox, summary.get("internetMessageId"),
        )
        if existing and existing["processingStatus"] != "RECEIVED":
            duplicates += 1
            continue

        message = get_graph_mail_message(mailbox, provider_message_id)
        if not existing and message.get("internetMessageId") and not summary.get("internetMessageId"):
            existing = store.find_inbound_email(provider_message_id, mailbox, message["internetMessageId"])
            if existing and existing["processingStatus"] != "RECEIVED":
                duplicates += 1
                continue
        inbound_email_id = existing["id"] if existing else provider_message_id
        mail = _parse_inbound_message(mailbox, inbound_email_id, provider_message_id, message)
        if not existing:
            store.create_inbound_email(mail)
            created += 1

        references = (
            mail["subject"], mail["bodyPreview"] or "", mail["bodyHtml"] or mail["bodyText"] or "",
            mail["inReplyTo"] or "", mail["referenceIds"],
        )
        notification_id = _extract_notification_reference(*references)
        entity_reference = _extract_entity_reference(*references)
        is_bounce = _is_bounce_like(mail["senderEmail"] or "", mail["subject"])

        bounce_status = _try_process_bounce_notification(
            store,
            is_bounce=is_bounce,
            inbound_email_id=inbound_email_id,
            provider_message_id=provider_message_id,
            notification_id=notification_id,
            in_reply_to=mail["inReplyTo"],
            reference_ids=mail["referenceIds"],
        )
        if bounce_status is not None:
            if bounce_status == "bounced":
                bounced += 1
            else:
                ignored += 1
            continue

        if entity_reference is not None:
            store.update_inbound_email(
                inbound_email_id,
                processing_status="PROCESSED",
                processing_notes="Entity reference marker detected.",
                linked_entity_type=entity_reference["entity_type"],
                linked_entity_id=entity_reference["entity_id"],
            )
            linked += 1
            continue

        store.update_inbound_email(
            inbound_email_id,
            processing_status="IGNORED",
            processing_notes="No notification or entity reference markers detected.",
        )
        ignored += 1

    return {
        "mailbox": mailbox,
        "created": created,
        "duplicates": duplicates,
        "bounced": bounced,
        "linked": linked,
        "ignored": ignored,
        "processedAt": datetime.now(timezone.utc).isoformat(),
    }


def _parse_inbound_message(
    mailbox: str, inbound_id: str, provider_id: str, message: dict[str, Any],
) -> dict[str, Any]:
    sender = (message.get("from") or {}).get("emailAddress") or {}
    body = message.get("body") or {}
    body_content = str(body.get("content") or "")
    is_html = str(body.get("contentType") or "").lower() == "html"
    headers = message.get("internetMessageHeaders")
    return {
        "id": inbound_id,
        "providerMessageId": provider_id,
        "mailbox": mailbox,
        "internetMessageId": message.get("internetMessageId"),
        "conversationId": message.get("conversationId"),
        "senderEmail": str(sender.get("address") or "").strip().lower() or None,
        "senderName": str(sender.get("name") or "").strip() or None,
        "subject": str(message.get("subject") or ""),
        "bodyPreview": str(message.get("bodyPreview") or "") or None,
        "bodyText": None if is_html else body_content,
        "bodyHtml": body_content if is_html else None,
        "inReplyTo": _find_header(headers, "In-Reply-To") or None,
        "referenceIds": (_find_header(headers, "References") or "").split(),
        "receivedAt": str(message.get("receivedDateTime") or datetime.now(timezone.utc).isoformat()),
    }


def _try_process_bounce_notification(
    store: JobStore,
    *,
    is_bounce: bool,
    inbound_email_id: str,
    provider_message_id: str,
    notification_id: str | None,
    in_reply_to: str | None,
    reference_ids: list[str],
) -> str | None:
    if not is_bounce:
        return None

    return _process_bounce_notification(
        store,
        inbound_email_id=inbound_email_id,
        provider_message_id=provider_message_id,
        notification_id=notification_id,
        in_reply_to=in_reply_to,
        reference_ids=reference_ids,
    )


def _process_bounce_notification(
    store: JobStore,
    *,
    inbound_email_id: str,
    provider_message_id: str,
    notification_id: str | None,
    in_reply_to: str | None,
    reference_ids: list[str],
) -> str:
    provider_message_candidates = _provider_message_id_candidates(
        [in_reply_to or "", *reference_ids]
    )
    notification = store.find_notification_by_provider_message_id(provider_message_candidates)

    if notification is None:
        store.update_inbound_email(
            inbound_email_id,
            processing_status="IGNORED",
            processing_notes="Bounce-like message lacked verified provider-message correlation.",
        )
        return "ignored"

    correlated_notification_id = str(notification.get("id") or "")
    if notification_id and correlated_notification_id != notification_id:
        store.update_inbound_email(
            inbound_email_id,
            processing_status="IGNORED",
            processing_notes=(
                "Bounce-like message content disagreed with provider-message correlation."
            ),
        )
        return "ignored"

    store.mark_notification_bounced(
        correlated_notification_id,
        f"Bounce/NDR received for inbound email {provider_message_id}",
    )
    store.update_inbound_email(
        inbound_email_id,
        processing_status="PROCESSED",
        processing_notes="Bounce correlated to notification delivery reference.",
        correlated_notification_id=correlated_notification_id,
    )
    return "bounced"


def _extract_notification_reference(
    subject: str,
    body_preview: str,
    body_content: str,
    in_reply_to: str,
    reference_ids: list[str],
) -> str | None:
    for candidate in [subject, body_preview, body_content, in_reply_to, *reference_ids]:
        match = NOTIFICATION_REFERENCE_PATTERN.search(candidate or "")
        if match and match.group(1):
            return match.group(1)
    return None


def _extract_entity_reference(
    subject: str,
    body_preview: str,
    body_content: str,
    in_reply_to: str,
    reference_ids: list[str],
) -> dict[str, str] | None:
    for candidate in [subject, body_preview, body_content, in_reply_to, *reference_ids]:
        match = ENTITY_REFERENCE_PATTERN.search(candidate or "")
        if match and match.group(1) and match.group(2):
            return {
                "entity_type": match.group(1),
                "entity_id": match.group(2),
            }
    return None


def _is_bounce_like(sender_email: str, subject: str) -> bool:
    return bool(BOUNCE_SENDER_PATTERN.search(sender_email or "")) or bool(
        BOUNCE_SUBJECT_PATTERN.search(subject or "")
    )


def _provider_message_id_candidates(values: list[str]) -> list[str]:
    candidates: set[str] = set()
    for value in values:
        normalized = _normalize_message_id(value)
        if not normalized:
            continue
        candidates.add(normalized)
        candidates.add(f"<{normalized}>")
    return sorted(candidates)


def _normalize_message_id(value: str) -> str:
    trimmed = value.strip().lower()
    if trimmed.startswith("<") and trimmed.endswith(">"):
        return trimmed[1:-1]
    return trimmed


def _find_header(headers: object, name: str) -> str:
    if not isinstance(headers, list):
        return ""

    for header in headers:
        if not isinstance(header, dict):
            continue
        if str(header.get("name") or "").lower() == name.lower():
            return str(header.get("value") or "")
    return ""


def _truncate_text(content: str, limit_bytes: int) -> tuple[str, bool]:
    encoded = content.encode("utf-8")
    if len(encoded) <= limit_bytes:
        return content, False

    marker = b"..."[:limit_bytes]
    preview = encoded[: limit_bytes - len(marker)].decode("utf-8", errors="ignore")
    return preview + marker.decode("ascii"), True


def _log_worker_started(config: object) -> None:
    worker_logger.info(
        "worker.started",
        workerId=getattr(config, "worker_id", None),
        pollIntervalSeconds=getattr(config, "poll_interval_seconds", None),
        maxAttempts=getattr(config, "max_attempts", None),
        retryBackoffSeconds=getattr(config, "retry_backoff_seconds", None),
        staleLockSeconds=getattr(config, "stale_lock_seconds", None),
    )


def _log_jobs_requeued_stale(count: int) -> None:
    worker_logger.warning("jobs.requeued_stale", count=count)


def _log_teams_poll_scheduled() -> None:
    worker_logger.info("teams.poll_scheduled")


def _log_job_claimed(job: BackgroundJob) -> None:
    worker_logger.info(
        "job.claimed",
        jobId=job.id,
        jobType=job.job_type,
        attempt=job.attempt_count,
    )


def _log_job_completed(job: BackgroundJob, result: dict[str, object]) -> None:
    worker_logger.info(
        "job.completed",
        jobId=job.id,
        jobType=job.job_type,
        status="completed",
        result=sanitize_log_meta(result),
    )


def _log_job_failed(job: BackgroundJob, error: BaseException) -> None:
    worker_logger.exception(
        "job.failed",
        error,
        jobId=job.id,
        jobType=job.job_type,
        attempt=job.attempt_count,
    )


def _maintain_claim(store: JobStore, job: BackgroundJob, stopped: Event, interval: float) -> None:
    while not stopped.wait(interval):
        try:
            if not store.renew_claim(job):
                return
        except Exception as error:  # noqa: BLE001
            worker_logger.exception("job.heartbeat_failed", error, jobId=job.id)


def _execute_claimed_job(store: JobStore, job: BackgroundJob) -> dict[str, object]:
    notification_id = str(job.payload.get("notificationId") or "").strip()
    if job.job_type == "notification_delivery" and notification_id:
        store.mark_notification_processing(notification_id, job.attempt_count)
    teams_outbound_id = str(job.payload.get("teamsOutboundMessageId") or "").strip()
    if job.job_type == "teams_message_delivery" and teams_outbound_id:
        store.mark_teams_outbound_processing(teams_outbound_id, job.attempt_count)

    if job.job_type == "inbound_mail_poll":
        return process_inbound_mail_poll(store, job.payload)
    if job.job_type == "teams_intake_poll":
        return process_teams_intake_poll(store)
    return process_job(job)


def main() -> None:
    config = load_config()
    logging.basicConfig(
        level={
            "debug": logging.DEBUG,
            "info": logging.INFO,
            "warn": logging.WARNING,
            "error": logging.ERROR,
        }.get(os.environ.get("LOG_LEVEL", "").strip().lower(), logging.INFO),
        format="%(message)s",
    )
    store = JobStore(config)
    _log_worker_started(config)

    next_teams_poll_at = 0.0
    while True:
        recovered_count = store.requeue_stale_jobs()
        if recovered_count:
            _log_jobs_requeued_stale(recovered_count)

        if _is_teams_enabled():
            flags = store.get_teams_integration_flags()
            if flags["intakeEnabled"] and time.time() >= next_teams_poll_at:
                created_poll_job = store.create_teams_intake_poll_job_if_missing()
                next_teams_poll_at = time.time() + max(config.teams_poll_interval_seconds, 1)
                if created_poll_job:
                    _log_teams_poll_scheduled()

        job = store.claim_next_job()
        if job is None:
            time.sleep(config.poll_interval_seconds)
            continue

        _log_job_claimed(job)
        stopped = Event()
        heartbeat = Thread(
            target=_maintain_claim,
            args=(store, job, stopped, min(config.stale_lock_seconds / 3, 30)),
            daemon=True,
        )
        heartbeat.start()
        try:
            result = _execute_claimed_job(store, job)
            if store.complete_job(job, result):
                _log_job_completed(job, result)
        except Exception as error:  # noqa: BLE001
            store.fail_job(job, str(error))
            _log_job_failed(job, error)
        finally:
            stopped.set()
            heartbeat.join(timeout=5)


def _is_teams_enabled() -> bool:
    value = str(os.environ.get("TEAMS_ENABLED") or "false").strip().lower()
    return value in {"1", "true", "yes"}


if __name__ == "__main__":
    main()
