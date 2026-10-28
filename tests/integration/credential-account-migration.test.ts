import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect, it } from "vitest";

it("migrates password identities without changing hashes or OAuth identities", async () => {
  const connectionString =
    process.env.TEST_DATABASE_URL ??
    "postgresql://starter:starter_e2e_password@127.0.0.1:55432/business_app_starter_e2e_test";
  if (!new URL(connectionString).pathname.endsWith("_test"))
    throw new Error("Migration tests require a dedicated _test database");
  const db = new Client({ connectionString });
  const schema = "credential_test_" + randomUUID().replaceAll("-", "");
  await db.connect();
  try {
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.query(`SET search_path TO "${schema}"`);
    await db.query(`CREATE TABLE "Account" (
      id TEXT PRIMARY KEY, "providerId" TEXT NOT NULL, "accountId" TEXT NOT NULL,
      "userId" TEXT NOT NULL, password TEXT, UNIQUE ("providerId", "accountId")
    )`);
    await db.query(`INSERT INTO "Account" VALUES
      ('legacy', 'credential', 'member@example.com', 'user-1', 'existing-hash'),
      ('current', 'credential', 'user-2', 'user-2', 'current-hash'),
      ('oauth', 'microsoft', 'external-subject', 'user-1', NULL)`);
    const migration = readFileSync(
      "prisma/migrations/20261028000000_align_credential_account_ids/migration.sql",
      "utf8",
    );
    await db.query(migration);
    await db.query(migration);
    const result = await db.query('SELECT * FROM "Account" ORDER BY id');
    expect(result.rows).toEqual([
      {
        id: "current",
        providerId: "credential",
        accountId: "user-2",
        userId: "user-2",
        password: "current-hash",
      },
      {
        id: "legacy",
        providerId: "credential",
        accountId: "user-1",
        userId: "user-1",
        password: "existing-hash",
      },
      {
        id: "oauth",
        providerId: "microsoft",
        accountId: "external-subject",
        userId: "user-1",
        password: null,
      },
    ]);
  } finally {
    await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.end();
  }
});
