import { afterEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    backgroundJob: {
      findFirst: vi.fn(),
    },
  },
}));

const { checkDatabaseHealth, getProcessHealth } = vi.hoisted(() => ({
  checkDatabaseHealth: vi.fn(),
  getProcessHealth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/monitoring", () => ({
  checkDatabaseHealth,
  getProcessHealth,
}));

import {
  aggregateOverallStatus,
  buildOpsHealthSnapshot,
  createDiagnosticSummary,
  createEnvironmentIdentity,
  getConfigurationHealth,
  redactSensitiveValue,
  type HealthCheckResult,
} from "@/lib/ops-health";
import { resetAppVersionInfoForTests } from "@/lib/app-version";

const metadataKeys = [
  "APP_ENVIRONMENT",
  "APP_VERSION",
  "APP_REVISION",
  "APP_GIT_SHA",
  "APP_BUILD_ID",
  "APP_BUILT_AT",
  "APP_DATABASE_URL",
  "DATABASE_URL",
  "BETTERAUTH_SECRET",
  "BETTER_AUTH_SECRET",
  "NODE_ENV",
];

describe("ops health snapshot helpers", () => {
  afterEach(() => {
    for (const key of metadataKeys) {
      delete process.env[key];
    }
    resetAppVersionInfoForTests();
    vi.clearAllMocks();
  });

  it("maps app version metadata to environment identity", () => {
    process.env.APP_ENVIRONMENT = "staging";
    process.env.APP_VERSION = "staging-42";
    process.env.APP_REVISION = "abcdef1234567890";
    process.env.APP_BUILD_ID = "123.2";
    process.env.APP_BUILT_AT = "2026-06-11T09:20:17Z";

    expect(createEnvironmentIdentity()).toEqual({
      environment: "staging",
      version: "staging-42",
      revision: "abcdef123456",
      buildId: "123.2",
      builtAt: "2026-06-11T09:20:17Z",
    });
  });

  it("ignores optional worker and smoke states for overall status", () => {
    const checks: HealthCheckResult[] = [
      { key: "runtime", status: "healthy", summary: "ok" },
      { key: "database", status: "healthy", summary: "ok" },
      { key: "configuration", status: "healthy", summary: "ok" },
      { key: "worker", status: "unknown", summary: "none", optional: true },
      {
        key: "deploySmoke",
        status: "unavailable",
        summary: "none",
        optional: true,
      },
    ];

    expect(aggregateOverallStatus(checks)).toBe("healthy");
  });

  it("marks overall status degraded when a required check degrades", () => {
    expect(
      aggregateOverallStatus([
        { key: "runtime", status: "healthy", summary: "ok" },
        { key: "database", status: "degraded", summary: "down" },
        { key: "configuration", status: "healthy", summary: "ok" },
      ]),
    ).toBe("degraded");
  });

  it("redacts nested sensitive values", () => {
    expect(
      redactSensitiveValue({
        token: "abc",
        nested: {
          databaseUrl: "postgresql://user:pass@example/db",
          safe: "hello",
        },
      }),
    ).toEqual({
      token: "[REDACTED]",
      nested: {
        databaseUrl: "[REDACTED]",
        safe: "hello",
      },
    });
  });

  it("reports configuration readiness without raw values", () => {
    const result = getConfigurationHealth({
      NODE_ENV: "production",
      APP_DATABASE_URL: "postgresql://secret@example/db",
      APP_ENVIRONMENT: "prod",
      APP_VERSION: "v1",
    });

    expect(result).toMatchObject({
      key: "configuration",
      status: "degraded",
    });
    expect(JSON.stringify(result)).not.toContain("postgresql://");
  });

  it("assembles a full snapshot with safe diagnostic text", async () => {
    process.env.APP_ENVIRONMENT = "staging";
    process.env.APP_VERSION = "staging-42";
    process.env.APP_REVISION = "abcdef1234567890";
    process.env.APP_BUILD_ID = "123.2";
    process.env.APP_BUILT_AT = "2026-06-11T09:20:17Z";
    process.env.APP_DATABASE_URL = "file:./dev.db";
    checkDatabaseHealth.mockResolvedValue({ status: "ok" });
    getProcessHealth.mockReturnValue({
      status: "ok",
      uptimeSeconds: 42,
      nodeEnv: "test",
    });
    prismaMock.backgroundJob.findFirst.mockResolvedValue({
      status: "COMPLETED",
      updatedAt: new Date("2026-06-11T09:30:00Z"),
      workerId: "worker-1",
      error: null,
    });

    const snapshot = await buildOpsHealthSnapshot();

    expect(snapshot.environment.version).toBe("staging-42");
    expect(snapshot.checks.map((check) => check.key)).toEqual([
      "runtime",
      "database",
      "configuration",
      "worker",
      "deploySmoke",
    ]);
    expect(snapshot.diagnosticSummary.text).toContain("Version: staging-42");
    expect(snapshot.diagnosticSummary.text).not.toContain("file:./dev.db");
  });

  it("does not treat stale or pending jobs as worker evidence", async () => {
    checkDatabaseHealth.mockResolvedValue({ status: "ok" });
    getProcessHealth.mockReturnValue({
      status: "ok",
      uptimeSeconds: 42,
      nodeEnv: "test",
    });
    prismaMock.backgroundJob.findFirst.mockResolvedValueOnce({
      status: "COMPLETED",
      updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      workerId: "worker-old",
      error: null,
    });
    prismaMock.backgroundJob.findFirst.mockResolvedValueOnce({
      status: "PENDING",
      updatedAt: new Date(),
      workerId: null,
      error: null,
    });

    for (const status of ["old", "pending"]) {
      const snapshot = await buildOpsHealthSnapshot();
      expect(
        snapshot.checks.find((check) => check.key === "worker")?.status,
        status,
      ).toBe("unknown");
    }
  });

  it("keeps job errors and failed worker lookups out of the snapshot", async () => {
    checkDatabaseHealth.mockResolvedValue({ status: "ok" });
    getProcessHealth.mockReturnValue({
      status: "ok",
      uptimeSeconds: 42,
      nodeEnv: "test",
    });
    prismaMock.backgroundJob.findFirst.mockResolvedValueOnce({
      status: "FAILED",
      updatedAt: new Date(),
      workerId: "worker-1",
      error: "API_KEY=topsecret",
    });
    prismaMock.backgroundJob.findFirst.mockRejectedValueOnce(
      new Error("API_KEY=topsecret"),
    );

    const failedJob = await buildOpsHealthSnapshot();
    expect(JSON.stringify(failedJob)).not.toContain("topsecret");
    expect(
      failedJob.checks.find((check) => check.key === "worker")?.status,
    ).toBe("degraded");

    const failedLookup = await buildOpsHealthSnapshot();
    expect(
      failedLookup.checks.find((check) => check.key === "worker")?.status,
    ).toBe("unknown");
  });

  it("bounds a stalled worker lookup", async () => {
    checkDatabaseHealth.mockResolvedValue({ status: "ok" });
    getProcessHealth.mockReturnValue({
      status: "ok",
      uptimeSeconds: 42,
      nodeEnv: "test",
    });
    prismaMock.backgroundJob.findFirst.mockReturnValue(new Promise(() => {}));

    const snapshot = await buildOpsHealthSnapshot();
    expect(
      snapshot.checks.find((check) => check.key === "worker")?.status,
    ).toBe("unknown");
  }, 5000);

  it("keeps the snapshot when a required check rejects", async () => {
    process.env.APP_DATABASE_URL = "file:./dev.db";
    checkDatabaseHealth.mockRejectedValue(new Error("database probe failed"));
    getProcessHealth.mockReturnValue({
      status: "ok",
      uptimeSeconds: 42,
      nodeEnv: "test",
    });
    prismaMock.backgroundJob.findFirst.mockResolvedValue(null);

    const snapshot = await buildOpsHealthSnapshot();
    expect(snapshot.overallStatus).toBe("unknown");
    expect(
      snapshot.checks.find((check) => check.key === "runtime")?.status,
    ).toBe("healthy");
    expect(
      snapshot.checks.find((check) => check.key === "database")?.status,
    ).toBe("unknown");
  });

  it("creates an allowlisted diagnostic summary", () => {
    const summary = createDiagnosticSummary({
      capturedAt: "2026-06-11T09:30:00Z",
      overallStatus: "healthy",
      environment: {
        environment: "staging",
        version: "v1",
        revision: "abc",
        buildId: "run-1",
        builtAt: "2026-06-11T09:00:00Z",
      },
      checks: [
        {
          key: "runtime",
          status: "healthy",
          summary: "Authorization: Bearer nope",
        },
      ],
    });

    expect(summary.text).toContain("runtime: healthy");
    expect(summary.text).not.toContain("Bearer");
  });
});
