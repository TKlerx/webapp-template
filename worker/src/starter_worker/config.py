from __future__ import annotations

import os
import socket
import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class WorkerConfig:
    database_url: str
    poll_interval_seconds: float
    worker_id: str


def load_config() -> WorkerConfig:
    return WorkerConfig(
        database_url=os.environ.get("DATABASE_URL", "file:./dev.db"),
        poll_interval_seconds=float(os.environ.get("WORKER_POLL_INTERVAL_SECONDS", "3")),
        worker_id=os.environ.get("WORKER_ID", f"{socket.gethostname()}-{uuid.uuid4().hex[:8]}"),
    )
