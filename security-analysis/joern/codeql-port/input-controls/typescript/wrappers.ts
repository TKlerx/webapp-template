// MIT analysis fixtures. Never execute or deploy these modules.
import { execSync, execFileSync } from "node:child_process";
export function unsafeShell(value: string) { execSync(value); }
export function safeProgram(value: string) { execFileSync("whoami", [value]); }
