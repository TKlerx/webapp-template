from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone

from .config import load_config
from .db import BackgroundJob, JobStore
from .graph_mail import send_graph_mail


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

logger = logging.getLogger("starter-worker")


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
        notification_id = str(job.payload.get("notificationId") or "").strip()
        if not notification_id:
            raise ValueError("notification_delivery job payload is missing notificationId")

        send_graph_mail(job.payload)
        return {
            "notificationId": notification_id,
            "status": "sent",
            "processedAt": datetime.now(timezone.utc).isoformat(),
        }

    raise ValueError(f"Unsupported job type: {job.job_type}")


def main() -> None:
    config = load_config()
    store = JobStore(config)
    logger.info(
        "worker.started worker_id=%s poll_interval=%s max_attempts=%s retry_backoff=%s stale_lock=%s",
        config.worker_id,
        config.poll_interval_seconds,
        config.max_attempts,
        config.retry_backoff_seconds,
        config.stale_lock_seconds,
    )

    while True:
        recovered_count = store.requeue_stale_jobs()
        if recovered_count:
            logger.warning("jobs.requeued_stale count=%s", recovered_count)

        job = store.claim_next_job()
        if job is None:
            time.sleep(config.poll_interval_seconds)
            continue

        logger.info("job.claimed id=%s type=%s attempt=%s", job.id, job.job_type, job.attempt_count)
        try:
            notification_id = str(job.payload.get("notificationId") or "").strip()
            if job.job_type == "notification_delivery" and notification_id:
                store.mark_notification_processing(notification_id, job.attempt_count)

            result = process_job(job)
            store.complete_job(job.id, result)
            if job.job_type == "notification_delivery" and notification_id:
                store.mark_notification_sent(notification_id, job.attempt_count)
            logger.info("job.completed id=%s result=%s", job.id, json.dumps(result))
        except Exception as error:  # noqa: BLE001
            notification_id = str(job.payload.get("notificationId") or "").strip()
            if job.job_type == "notification_delivery" and notification_id:
                store.mark_notification_failed(
                    notification_id,
                    str(error),
                    job.attempt_count,
                    will_retry=job.attempt_count < config.max_attempts,
                )
            store.fail_job(job.id, str(error))
            logger.exception("job.failed id=%s attempt=%s", job.id, job.attempt_count)


if __name__ == "__main__":
    main()
