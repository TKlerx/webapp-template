from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone

from .config import load_config
from .db import BackgroundJob, JobStore


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

    raise ValueError(f"Unsupported job type: {job.job_type}")


def main() -> None:
    config = load_config()
    store = JobStore(config)
    logger.info("worker.started worker_id=%s poll_interval=%s", config.worker_id, config.poll_interval_seconds)

    while True:
        job = store.claim_next_job()
        if job is None:
            time.sleep(config.poll_interval_seconds)
            continue

        logger.info("job.claimed id=%s type=%s attempt=%s", job.id, job.job_type, job.attempt_count)
        try:
            result = process_job(job)
            store.complete_job(job.id, result)
            logger.info("job.completed id=%s result=%s", job.id, json.dumps(result))
        except Exception as error:  # noqa: BLE001
            store.fail_job(job.id, str(error))
            logger.exception("job.failed id=%s", job.id)


if __name__ == "__main__":
    main()
