import fs from "node:fs";
import { spawnSync } from "node:child_process";

export default async function globalSetup() {
  const env = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? "file:./e2e.db",
    INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL ?? "admin@example.com",
    INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD ?? "ChangeMe123!",
  };

  const databasePath = env.DATABASE_URL.replace(/^file:/, "");
  if (databasePath && fs.existsSync(databasePath)) {
    fs.rmSync(databasePath, { force: true });
  }

  const result = spawnSync(process.execPath, ["scripts/ensure-local-db.mjs"], {
    stdio: "inherit",
    env,
  });

  if ((result.status ?? 1) !== 0) {
    throw new Error("Failed to provision the E2E database.");
  }
}
