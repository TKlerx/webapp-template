import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const cliDir = path.join(repoRoot, "cli");

function listGoFiles(dir) {
  const entries = readdirSync(dir);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (entry === "vendor" || entry === "dist") {
        continue;
      }
      files.push(...listGoFiles(fullPath));
      continue;
    }

    if (entry.endsWith(".go")) {
      files.push(fullPath);
    }
  }

  return files;
}

function runGofmt(args, options = {}) {
  console.log(`> gofmt ${args.join(" ")}`);
  const result = spawnSync("gofmt", args, {
    cwd: options.cwd ?? cliDir,
    stdio: options.capture ? "pipe" : "inherit",
    encoding: "utf8",
  });

  handleResult("gofmt", args, result, options);
  return result;
}

function runGo(args, options = {}) {
  console.log(`> go ${args.join(" ")}`);
  const result = spawnSync("go", args, {
    cwd: options.cwd ?? cliDir,
    stdio: options.capture ? "pipe" : "inherit",
    encoding: "utf8",
  });

  handleResult("go", args, result, options);
  return result;
}

function handleResult(command, args, result, options = {}) {
  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    if (options.capture) {
      process.stdout.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
    }
    process.exitCode = result.status ?? 1;
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

const goFiles = listGoFiles(cliDir);
const gofmt = runGofmt(["-l", ...goFiles], { cwd: repoRoot, capture: true });
const unformatted = (gofmt.stdout ?? "").trim();

if (unformatted) {
  console.error("Go files need formatting:");
  console.error(unformatted);
  process.exit(1);
}

runGo(["vet", "./..."]);
runGo(["run", "honnef.co/go/tools/cmd/staticcheck", "./..."]);
runGo(["test", "./..."]);
runGo(["build", "./..."]);
