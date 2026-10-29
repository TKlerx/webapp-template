import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://starter:starter_e2e_password@127.0.0.1:55432/business_app_starter_e2e_test",
      APP_DATABASE_URL: "",
      MIGRATION_DATABASE_URL: "",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
    include: [
      "tests/unit/**/*.test.ts",
      "tests/unit/**/*.test.tsx",
      "tests/integration/**/*.test.ts",
      "tests/integration/**/*.test.tsx",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
