import { spawnSync } from "node:child_process";

const DEFAULT_E2E_DATABASE_URL =
  "postgresql://starter:starter_e2e_password@localhost:55432/business_app_starter_e2e?schema=e2e";

const databaseUrl =
  process.env.DATABASE_URL?.trim() || DEFAULT_E2E_DATABASE_URL;

if (databaseUrl.startsWith("file:")) {
  runStep(
    "Provision local SQLite E2E database",
    "node scripts/ensure-local-db.mjs",
    {
      DATABASE_URL: databaseUrl,
    },
  );
  process.exit(0);
}

if (
  !databaseUrl.startsWith("postgresql://") &&
  !databaseUrl.startsWith("postgres://")
) {
  throw new Error(
    "E2E DATABASE_URL must be a PostgreSQL URL or an explicit file: SQLite URL.",
  );
}

const parsed = new URL(databaseUrl);
const containerName =
  process.env.E2E_POSTGRES_CONTAINER || "webapp-template-e2e-postgres";
const postgresUser = decodeURIComponent(parsed.username || "starter");
const postgresPassword = decodeURIComponent(
  parsed.password || "starter_e2e_password",
);
const postgresDb =
  parsed.pathname.replace(/^\//, "") || "business_app_starter_e2e";
const hostPort = parsed.port || "55432";

ensureDockerPostgres();

const env = {
  DATABASE_URL: databaseUrl,
  MIGRATION_DATABASE_URL: databaseUrl,
  INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL ?? "admin@example.com",
  INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD ?? "ChangeMe123!",
  PRISMA_CONFIG_PATH: "prisma.config.postgres.ts",
};

runStep(
  "Generate PostgreSQL Prisma client",
  "pnpm exec prisma generate --config prisma.config.postgres.ts",
  env,
);
runStep(
  "Reset PostgreSQL E2E schema",
  "pnpm exec prisma migrate reset --force --config prisma.config.postgres.ts",
  env,
);
runStep("Seed PostgreSQL E2E data", "pnpm exec tsx prisma/seed.ts", env);

function ensureDockerPostgres() {
  const existing = runNativeCaptured("docker", [
    "ps",
    "-a",
    "--filter",
    `name=^/${containerName}$`,
    "--format",
    "{{.Names}}:{{.Status}}",
  ]).trim();

  if (existing) {
    if (!existing.includes("Up ")) {
      runNativeStep("Start PostgreSQL E2E container", "docker", [
        "start",
        containerName,
      ]);
    }
  } else {
    runNativeStep("Create PostgreSQL E2E container", "docker", [
      "run",
      "-d",
      "--name",
      containerName,
      "-p",
      `${hostPort}:5432`,
      "-e",
      `POSTGRES_USER=${postgresUser}`,
      "-e",
      `POSTGRES_PASSWORD=${postgresPassword}`,
      "-e",
      `POSTGRES_DB=${postgresDb}`,
      "postgres:18-alpine",
    ]);
  }

  waitForPostgres();
}

function waitForPostgres() {
  const deadline = Date.now() + 60_000;
  let lastOutput = "";

  while (Date.now() < deadline) {
    const result = spawnSync(
      "docker",
      [
        "exec",
        containerName,
        "pg_isready",
        "-U",
        postgresUser,
        "-d",
        postgresDb,
      ],
      { encoding: "utf8" },
    );
    lastOutput = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    if ((result.status ?? 1) === 0) {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }

  throw new Error(
    `Timed out waiting for PostgreSQL E2E container. Last output: ${lastOutput}`,
  );
}

function runStep(label, commandLine, envOverrides = {}) {
  console.log(`> ${label}`);
  const result = spawnSync(getShellCommand(), getShellArgs(commandLine), {
    stdio: "inherit",
    env: {
      ...process.env,
      ...envOverrides,
    },
  });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNativeStep(label, command, args, envOverrides = {}) {
  console.log(`> ${label}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...envOverrides,
    },
  });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNativeCaptured(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: process.env,
  });

  if ((result.status ?? 1) !== 0) {
    return "";
  }

  return result.stdout ?? "";
}

function getShellCommand() {
  return process.platform === "win32" ? "cmd.exe" : "/bin/sh";
}

function getShellArgs(commandLine) {
  return process.platform === "win32"
    ? ["/c", commandLine]
    : ["-lc", commandLine];
}
