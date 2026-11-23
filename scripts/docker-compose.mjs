import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const args = process.argv.slice(2);
const allowMissingEnv = args[0] === "--allow-missing-env";
if (allowMissingEnv) args.shift();

if (!allowMissingEnv && !existsSync(".env.docker")) {
  console.error("Missing .env.docker.");
  console.error(
    "Create it from .env.docker.example, then run this command again:",
  );
  console.error("  Copy-Item .env.docker.example .env.docker");
  process.exit(1);
}

const composeArgs = [
  "compose",
  ...[".env", ".env.docker"]
    .filter((file) => existsSync(file))
    .flatMap((file) => ["--env-file", file]),
];
const commandArgs =
  args[0] === "up" && !args.includes("--build") && !args.includes("--no-build")
    ? ["up", "--build", ...args.slice(1)]
    : args;

const result = spawnSync("docker", [...composeArgs, ...commandArgs], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
