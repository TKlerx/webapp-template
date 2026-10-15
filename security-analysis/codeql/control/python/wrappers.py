import subprocess


def unsafe_shell(command):
    subprocess.run(command, shell=True, check=True)


def safe_program(argument):
    subprocess.run(["whoami", argument], check=True)
