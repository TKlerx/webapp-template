from dataclasses import dataclass
import json
import os

@dataclass
class BackgroundJob:
    payload: dict

class JobStore:
    def claim_next_job(self) -> BackgroundJob:
        # Stand-in for a persisted queue payload; this input is externally supplied.
        return BackgroundJob(json.loads(os.environ["EXAMPLE_JOB_PAYLOAD"]))
