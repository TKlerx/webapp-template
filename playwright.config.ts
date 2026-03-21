import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? "3280");

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  globalSetup: "./tests/e2e/global.setup.ts",
  globalTeardown: "./tests/e2e/global.teardown.ts",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npm run start",
    env: {
      ...process.env,
      PORT: String(port),
    },
    port,
    timeout: 240 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});

