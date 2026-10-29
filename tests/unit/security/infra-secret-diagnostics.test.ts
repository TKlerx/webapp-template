import { afterEach, expect, it, vi } from "vitest";

vi.mock("../../../scripts/infra-plan-lib.mjs", () => ({
  createInfraPlanJson: () => ({
    resource_changes: [
      {
        address: "module.runtime.azurerm_container_app.app",
        change: {
          after: {
            secret: [
              {
                name: "worker-database-url",
                value: "private-database-sentinel",
              },
            ],
            template: [
              {
                container: [
                  {
                    env: [
                      {
                        name: "MIGRATION_DATABASE_URL",
                        value: "private-env-sentinel",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      {
        address: "module.runtime.azurerm_container_app.worker",
        change: { after: {} },
      },
      {
        address: "module.runtime.azurerm_container_app_job.migration",
        change: {
          after: {
            secret: [
              { name: "unexpected-secret", value: "private-token-sentinel" },
            ],
          },
        },
      },
    ],
  }),
}));

afterEach(() => vi.restoreAllMocks());

it("reports forbidden secret and environment names without emitting their values", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("expected-exposure-failure");
  });
  const scriptPath = "../../../scripts/infra-secret-exposure-check.mjs";
  await expect(import(scriptPath)).rejects.toThrow("expected-exposure-failure");
  const output = error.mock.calls.flat().join("\n");
  expect(output).toContain("worker-database-url");
  expect(output).toContain("MIGRATION_DATABASE_URL");
  expect(output).toContain("unexpected-secret");
  expect(output).not.toContain("private-database-sentinel");
  expect(output).not.toContain("private-env-sentinel");
  expect(output).not.toContain("private-token-sentinel");
});
