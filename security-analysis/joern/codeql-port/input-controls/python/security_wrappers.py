import urllib.request
import logging
import pickle
import json
import os.path
import yaml
from psycopg import Cursor
from flask import redirect
FIXED_API = "https://example.com/api"

def network(value):
    return urllib.request.urlopen(value)

def fixed_network(value):
    return urllib.request.urlopen("https://example.com/api", data=value.encode())

def network_request(value):
    request = urllib.request.Request(value)
    return urllib.request.urlopen(request)

def fixed_network_request(value):
    request = urllib.request.Request("https://example.com/api", data=value.encode())
    return urllib.request.urlopen(request)

def fixed_origin(value):
    return urllib.request.urlopen(f"{FIXED_API}/{value}")

def dynamic_origin(value):
    return urllib.request.urlopen(f"https://{value}/api")

def mutated_origin(value):
    base = "https://example.com/api"
    base *= 0
    base += value
    return urllib.request.urlopen(base)

def sql(cursor: Cursor, value):
    return cursor.execute("SELECT * FROM users WHERE name = '" + value + "'")

def bound_sql(cursor: Cursor, value):
    return cursor.execute("SELECT * FROM users WHERE name = %s", (value,))

def file(value):
    return open(value)

def normalized_file(value):
    return open(os.path.abspath(value))

def fixed_file(value):
    return open("/srv/uploads/fixed.txt", "w").write(value)

def redirect_url(value):
    return redirect(value)

def fixed_redirect(value):
    return redirect("https://example.com/done")

def evaluate(value):
    return eval(value)

def parse(value):
    return json.loads(value)

def deserialize(value):
    return pickle.loads(value)

def unsafe_yaml(value):
    return yaml.load(value, Loader=yaml.Loader)

def safe_yaml(value):
    return yaml.load(value, Loader=yaml.SafeLoader)

def log_secret(value):
    logging.info(value)

def mask_secret(value):
    logging.info("[REDACTED]")

def unrelated(other, value):
    other.execute(value)
    other.urlopen(value)
    other.redirect(value)
