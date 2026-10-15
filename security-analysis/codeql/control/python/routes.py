# MIT-licensed analysis fixture. Never execute or deploy this file.
from flask import Flask, request
from wrappers import unsafe_shell, safe_program

app = Flask(__name__)


@app.get("/unsafe")
def unsafe_route():
    unsafe_shell(request.args["command"])
    return "done"


@app.get("/safe")
def safe_route():
    safe_program(request.args["argument"])
    return "done"
