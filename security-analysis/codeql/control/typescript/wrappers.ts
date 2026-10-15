import { execSync, execFileSync } from "node:child_process";

export function unsafeShell(command: string) {
  execSync(command);
}

export function safeProgram(argument: string) {
  execFileSync("whoami", [argument]);
}
