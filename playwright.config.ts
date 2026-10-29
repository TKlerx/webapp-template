import { defineConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";

const port = Number(process.env.E2E_PORT ?? "3280");
const normalizedBasePath = process.env.E2E_BASE_PATH ?? "/app-starter";
const authBaseUrl = `http://localhost:${port}${normalizedBasePath}`;
const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  `postgresql://starter:starter_e2e_password@127.0.0.1:55432/business_app_starter_e2e_${Date.now()}_test`;
const reuseExistingServer = process.env.E2E_REUSE_SERVER === "1";
if (reuseExistingServer && !process.env.TEST_DATABASE_URL) {
  throw new Error("E2E_REUSE_SERVER requires an explicit TEST_DATABASE_URL.");
}

process.env.E2E_PORT = String(port);
process.env.E2E_BASE_PATH = normalizedBasePath;
process.env.DATABASE_URL = databaseUrl;
process.env.TEST_DATABASE_URL = databaseUrl;
process.env.APP_DATABASE_URL = databaseUrl;
process.env.MIGRATION_DATABASE_URL = databaseUrl;
process.env.E2E_MOCK_SSO_SECRET ??= randomBytes(32).toString("hex");
process.env.BETTERAUTH_SECRET ??= randomBytes(32).toString("hex");

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  workers: 1,
  globalSetup: "./tests/e2e/global.setup.ts",
  use: {
    baseURL: authBaseUrl,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm run prisma:generate && pnpm run build && pnpm exec next start --hostname 127.0.0.1 --port ${port}`,
    env: {
      ...process.env,
      PORT: String(port),
      BASE_PATH: normalizedBasePath,
      DATABASE_URL: databaseUrl,
      AUTH_BASE_URL: process.env.AUTH_BASE_URL ?? authBaseUrl,
      E2E_BASE_PATH: normalizedBasePath,
      INITIAL_ADMIN_EMAIL:
        process.env.INITIAL_ADMIN_EMAIL ?? "admin@example.com",
      INITIAL_ADMIN_PASSWORD:
        process.env.INITIAL_ADMIN_PASSWORD ?? "ChangeMe123!",
      BETTERAUTH_SECRET: process.env.BETTERAUTH_SECRET,
      E2E_TESTING: "1",
      E2E_MOCK_SSO: "1",
      E2E_MOCK_SSO_SECRET: process.env.E2E_MOCK_SSO_SECRET,
      E2E_DISABLE_RATE_LIMIT: "1",
      AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID ?? "replace-me",
      AZURE_AD_CLIENT_SECRET:
        process.env.AZURE_AD_CLIENT_SECRET ?? "replace-me",
      AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID ?? "replace-me",
    },
    port,
    timeout: 240 * 1000,
    reuseExistingServer,
  },
});
