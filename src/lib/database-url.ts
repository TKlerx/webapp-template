type DatabaseUrlEnv = Record<string, string | undefined>;

function firstConfiguredValue(values: Array<string | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      let parsed: URL;
      try {
        parsed = new URL(trimmed);
      } catch {
        throw new Error("A valid PostgreSQL database URL is required.");
      }
      if (
        !["postgres:", "postgresql:"].includes(parsed.protocol) ||
        !parsed.hostname ||
        parsed.pathname === "/" ||
        !parsed.pathname
      ) {
        throw new Error(
          "A PostgreSQL database URL with a database name is required.",
        );
      }
      return trimmed;
    }
  }

  throw new Error("Configure a PostgreSQL database URL for this runtime.");
}

export function resolveAppDatabaseUrl(env: DatabaseUrlEnv = process.env) {
  return firstConfiguredValue([env.APP_DATABASE_URL, env.DATABASE_URL]);
}

export function resolveMigrationDatabaseUrl(env: DatabaseUrlEnv = process.env) {
  return firstConfiguredValue([env.MIGRATION_DATABASE_URL, env.DATABASE_URL]);
}
