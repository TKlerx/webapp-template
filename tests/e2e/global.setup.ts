import { spawnSync } from "node:child_process";

export default async function globalSetup() {
  const env = {
    ...process.env,
    INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL ?? "admin@example.com",
    INITIAL_ADMIN_PASSWORD:
      process.env.INITIAL_ADMIN_PASSWORD ?? "ChangeMe123!",
  };
  const ownsDatabase =
    process.env.TEST_DATABASE_URL === process.env.E2E_OWNED_DATABASE_URL &&
    Boolean(process.env.TEST_DATABASE_URL);

  const provision = (args: string[] = []) =>
    spawnSync(process.execPath, ["scripts/ensure-e2e-db.mjs", ...args], {
      stdio: "inherit",
      env,
    }).status === 0;

  if (!provision()) {
    if (ownsDatabase) provision(["--cleanup"]);
    throw new Error("Failed to provision the E2E database.");
  }
  return () => {
    if (ownsDatabase && !provision(["--cleanup"])) {
      throw new Error("Failed to remove the Playwright test database.");
    }
  };
}
