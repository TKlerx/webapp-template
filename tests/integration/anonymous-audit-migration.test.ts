import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Client } from "pg";
import { expect, it } from "vitest";

it("preserves existing audits and permits anonymous actors while retaining known-user foreign keys", async () => {
  const connectionString =
    process.env.TEST_DATABASE_URL ??
    "postgresql://starter:starter_e2e_password@127.0.0.1:55432/business_app_starter_e2e_test";
  if (!new URL(connectionString).pathname.endsWith("_test"))
    throw new Error("Migration tests require a dedicated _test database");
  const schema = "audit_test_" + randomUUID().replaceAll("-", "");
  const db = new Client({ connectionString });
  await db.connect();
  try {
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.query(`SET search_path TO "${schema}"`);
    const migrations = path.join(process.cwd(), "prisma/migrations");
    const latest = "20261015010000_allow_anonymous_audit_actors";
    for (const directory of readdirSync(migrations)
      .filter((name) => name !== latest && !name.endsWith(".toml"))
      .sort()) {
      await db.query(
        readFileSync(path.join(migrations, directory, "migration.sql"), "utf8"),
      );
    }
    await db.query(
      `INSERT INTO "User" (id, email, name, "authMethod", "updatedAt") VALUES ('user-1', 'test@example.com', 'Test', 'LOCAL', NOW())`,
    );
    const insert = `INSERT INTO "AuditEntry" (id, action, "entityType", "entityId", "actorId", details) VALUES ($1, 'AUTH_LOGIN_REJECTED', 'LoginAttempt', 'attempt-1', $2, '{}')`;
    await db.query(insert, ["existing-audit", "user-1"]);
    await expect(
      db.query(insert, ["anonymous-before", null]),
    ).rejects.toThrow();
    await db.query(
      readFileSync(path.join(migrations, latest, "migration.sql"), "utf8"),
    );
    await db.query(insert, ["anonymous-after", null]);
    const rows = await db.query(
      'SELECT id, "actorId" FROM "AuditEntry" ORDER BY id',
    );
    expect(rows.rows).toEqual([
      { id: "anonymous-after", actorId: null },
      { id: "existing-audit", actorId: "user-1" },
    ]);
    await expect(
      db.query(insert, ["invalid-actor", "missing-user"]),
    ).rejects.toThrow();
  } finally {
    await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.end();
  }
}, 30_000);
