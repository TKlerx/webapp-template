from db import BackgroundJob, JobStore
from wrappers import unsafe_shell, safe_program

def unsafe_payload(task: BackgroundJob):
    unsafe_shell(task.payload["command"])

def safe_payload(task: BackgroundJob):
    safe_program(task.payload["command"])

def unsafe_claimed(store: JobStore):
    task = store.claim_next_job()
    unsafe_shell(task.payload["command"])

def safe_claimed(store: JobStore):
    task = store.claim_next_job()
    safe_program(task.payload["command"])

def unrelated_payload(task):
    unsafe_shell(task.payload["command"])

def unrelated_claimed(store):
    task = store.claim_next_job()
    unsafe_shell(task.payload["command"])

def unsafe_constructed():
    store = JobStore()
    task = store.claim_next_job()
    unsafe_shell(task.payload["command"])

def safe_constructed():
    store = JobStore()
    task = store.claim_next_job()
    safe_program(task.payload["command"])
