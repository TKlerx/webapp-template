from db import BackgroundJob
from psycopg import Cursor
import security_wrappers as sinks

def unsafe_ssrf(task: BackgroundJob):
    sinks.network(task.payload["value"])

def safe_ssrf(task: BackgroundJob):
    sinks.fixed_network(task.payload["value"])

def unsafe_ssrf_request(task: BackgroundJob):
    sinks.network_request(task.payload["value"])

def safe_ssrf_request(task: BackgroundJob):
    sinks.fixed_network_request(task.payload["value"])

def safe_fixed_origin(task: BackgroundJob):
    sinks.fixed_origin(task.payload["value"])

def unsafe_dynamic_origin(task: BackgroundJob):
    sinks.dynamic_origin(task.payload["value"])

def unsafe_mutated_origin(task: BackgroundJob):
    sinks.mutated_origin(task.payload["value"])

def unsafe_sql(task: BackgroundJob, cursor: Cursor):
    sinks.sql(cursor, task.payload["value"])

def safe_sql(task: BackgroundJob, cursor: Cursor):
    sinks.bound_sql(cursor, task.payload["value"])

def unsafe_path(task: BackgroundJob):
    sinks.file(task.payload["value"])

def unsafe_normalized_path(task: BackgroundJob):
    sinks.normalized_file(task.payload["value"])

def safe_path(task: BackgroundJob):
    sinks.fixed_file(task.payload["value"])

def unsafe_redirect(task: BackgroundJob):
    sinks.redirect_url(task.payload["value"])

def safe_redirect(task: BackgroundJob):
    sinks.fixed_redirect(task.payload["value"])

def unsafe_code(task: BackgroundJob):
    sinks.evaluate(task.payload["value"])

def safe_code(task: BackgroundJob):
    sinks.parse(task.payload["value"])

def unsafe_deserialization(task: BackgroundJob):
    sinks.deserialize(task.payload["value"])

def unsafe_yaml(task: BackgroundJob):
    sinks.unsafe_yaml(task.payload["value"])

def safe_deserialization(task: BackgroundJob):
    sinks.safe_yaml(task.payload["value"])

def unsafe_logging(task: BackgroundJob):
    sinks.log_secret(task.payload["password"])

def safe_logging(task: BackgroundJob):
    sinks.mask_secret(task.payload["password"])

def unrelated_sinks(task: BackgroundJob, other):
    sinks.unrelated(other, task.payload["value"])
