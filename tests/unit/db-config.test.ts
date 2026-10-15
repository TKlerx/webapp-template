import { describe, expect, it } from "vitest";

import {
  resolveAppDatabaseUrl,
  resolveMigrationDatabaseUrl,
} from "@/lib/database-url";

describe("database URL resolution", () => {
  it("prefers APP_DATABASE_URL for app runtime", () => {
    expect(
      resolveAppDatabaseUrl({
        APP_DATABASE_URL: "postgresql://app:test@localhost:5432/app",
        DATABASE_URL: "postgresql://legacy:test@localhost:5432/app",
      }),
    ).toBe("postgresql://app:test@localhost:5432/app");
  });

  it("falls back to DATABASE_URL for local app runtime", () => {
    expect(
      resolveAppDatabaseUrl({
        DATABASE_URL: "postgresql://app:test@localhost:5432/app",
      }),
    ).toBe("postgresql://app:test@localhost:5432/app");
  });

  it("requires an explicitly configured database", () => {
    expect(() => resolveAppDatabaseUrl({})).toThrow("Configure a PostgreSQL");
    expect(() => resolveMigrationDatabaseUrl({})).toThrow(
      "Configure a PostgreSQL",
    );
  });

  it("prefers MIGRATION_DATABASE_URL for migration runtime", () => {
    expect(
      resolveMigrationDatabaseUrl({
        MIGRATION_DATABASE_URL: "postgresql://migrator:test@localhost:5432/app",
        DATABASE_URL: "postgresql://legacy:test@localhost:5432/app",
      }),
    ).toBe("postgresql://migrator:test@localhost:5432/app");
  });

  it.each(["file:./dev.db", "https://db/app", "postgresql://db", "not-a-url"])(
    "rejects unsupported database URL %s without exposing credentials",
    (url) => {
      expect(() => resolveAppDatabaseUrl({ DATABASE_URL: url })).toThrow(
        /PostgreSQL/,
      );
    },
  );
});
