from __future__ import annotations

import os
import socket
import uuid
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class WorkerConfig:
    database_url: str
    poll_interval_seconds: float
    worker_id: str


def load_shared_env(env_path: Path | None = None) -> None:
    root_env_path = env_path or Path(__file__).resolve().parents[3] / ".env"
    load_dotenv(root_env_path, override=False)


def load_config(env_path: Path | None = None) -> WorkerConfig:
    load_shared_env(env_path)

    return WorkerConfig(
        database_url=os.environ.get("DATABASE_URL", "file:./dev.db"),
        poll_interval_seconds=float(os.environ.get("WORKER_POLL_INTERVAL_SECONDS", "3")),
        worker_id=os.environ.get("WORKER_ID", f"{socket.gethostname()}-{uuid.uuid4().hex[:8]}"),
    )
