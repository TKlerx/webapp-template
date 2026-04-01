import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? "3280");
const normalizedBasePath = process.env.E2E_BASE_PATH ?? "/app-starter";
const authBaseUrl = `http://localhost:${port}${normalizedBasePath}`;

process.env.E2E_PORT = String(port);
process.env.E2E_BASE_PATH = normalizedBasePath;

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  globalSetup: "./tests/e2e/global.setup.ts",
  globalTeardown: "./tests/e2e/global.teardown.ts",
  use: {
    baseURL: authBaseUrl,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npm run start",
    env: {
      ...process.env,
      PORT: String(port),
      BASE_PATH: normalizedBasePath,
      DATABASE_URL: process.env.DATABASE_URL ?? "file:./e2e.db",
      AUTH_BASE_URL: process.env.AUTH_BASE_URL ?? authBaseUrl,
      E2E_BASE_PATH: normalizedBasePath,
      INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL ?? "admin@example.com",
      INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD ?? "ChangeMe123!",
      E2E_MOCK_SSO: "1",
      E2E_ALLOW_PROD_MOCK_SSO: "1",
      E2E_DISABLE_RATE_LIMIT: "1",
      AZURE_AD_CLIENT_ID: "replace-me",
      AZURE_AD_CLIENT_SECRET: "replace-me",
      AZURE_AD_TENANT_ID: "replace-me",
    },
    port,
    timeout: 240 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});

