# MIT analysis fixtures. Never execute or deploy these modules.
import subprocess

def unsafe_shell(value):
    subprocess.run(value, shell=True, check=True)

def safe_program(value):
    subprocess.run(["whoami", value], check=True)
