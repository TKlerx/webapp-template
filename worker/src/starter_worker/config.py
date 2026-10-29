from __future__ import annotations

import os
import socket
import uuid
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field, field_validator


class WorkerConfig(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", hide_input_in_errors=True)

    database_url: str
    poll_interval_seconds: float = Field(gt=0)
    worker_id: str
    max_attempts: int = Field(ge=1)
    retry_backoff_seconds: float = Field(ge=0)
    stale_lock_seconds: float = Field(gt=0)
    teams_poll_interval_seconds: float = Field(gt=0)

    def max_attempts_for(self, job_type: str) -> int:
        return min(self.max_attempts, 3) if job_type == "teams_message_delivery" else self.max_attempts

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        parsed = urlsplit(value)
        if (
            parsed.scheme not in {"postgres", "postgresql"}
            or not parsed.hostname
            or not parsed.path.strip("/")
        ):
            raise ValueError("A PostgreSQL URL with a database name is required")
        return value


def load_shared_env(env_path: Path | None = None) -> None:
    root_env_path = env_path or Path(__file__).resolve().parents[3] / ".env"
    load_dotenv(root_env_path, override=False)


def load_config(env_path: Path | None = None) -> WorkerConfig:
    load_shared_env(env_path)
    database_url = os.environ.get("WORKER_DATABASE_URL") or os.environ.get("DATABASE_URL", "")

    return WorkerConfig.model_validate(
        {
            "database_url": database_url,
            "poll_interval_seconds": os.environ.get("WORKER_POLL_INTERVAL_SECONDS", "3"),
            "worker_id": os.environ.get(
                "WORKER_ID", f"{socket.gethostname()}-{uuid.uuid4().hex[:8]}"
            ),
            "max_attempts": os.environ.get("WORKER_MAX_ATTEMPTS", "3"),
            "retry_backoff_seconds": os.environ.get("WORKER_RETRY_BACKOFF_SECONDS", "15"),
            "stale_lock_seconds": os.environ.get("WORKER_STALE_LOCK_SECONDS", "300"),
            "teams_poll_interval_seconds": os.environ.get("TEAMS_POLL_INTERVAL_SECONDS", "60"),
        }
    )
