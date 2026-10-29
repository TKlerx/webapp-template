import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { Client } from "pg";
import { expect, it } from "vitest";

it("seeds a usable credential identity after migrations and preserves it on repeat runs", async () => {
  const connectionString =
    process.env.TEST_DATABASE_URL ??
    "postgresql://starter:starter_e2e_password@127.0.0.1:55432/business_app_starter_e2e_test";
  const url = new URL(connectionString);
  if (!url.pathname.endsWith("_test"))
    throw new Error("Seed tests require a dedicated _test database");
  const schema = "seed_test_" + randomUUID().replaceAll("-", "");
  const db = new Client({ connectionString });
  await db.connect();
  try {
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.query(`SET search_path TO "${schema}"`);
    const migrations = path.join(process.cwd(), "prisma/migrations");
    for (const name of readdirSync(migrations)
      .filter((name) => !name.endsWith(".toml"))
      .sort()) {
      await db.query(
        readFileSync(path.join(migrations, name, "migration.sql"), "utf8"),
      );
    }
    url.searchParams.set("options", `-csearch_path=${schema}`);
    const password = "SeedRegression123!";
    const seed = () => {
      const result = spawnSync(
        process.execPath,
        ["scripts/seed-initial-admin.mjs"],
        {
          encoding: "utf8",
          timeout: 15_000,
          env: {
            ...process.env,
            NODE_ENV: "production",
            MIGRATION_DATABASE_URL: url.toString(),
            INITIAL_ADMIN_EMAIL: "docker-seed@example.invalid",
            INITIAL_ADMIN_PASSWORD: password,
          },
        },
      );
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
    };
    seed();
    const first = await db.query(
      'SELECT a.*, u."mustChangePassword" FROM "Account" a JOIN "User" u ON u.id=a."userId"',
    );
    expect(first.rowCount).toBe(1);
    const account = first.rows[0] as {
      accountId: string;
      userId: string;
      password: string;
      mustChangePassword: boolean;
    };
    expect(account.accountId).toBe(account.userId);
    const { mustChangePassword, ...storedAccount } = account;
    expect(mustChangePassword).toBe(true);
    expect(await bcrypt.compare(password, account.password)).toBe(true);
    seed();
    const repeated = await db.query('SELECT * FROM "Account"');
    expect(repeated.rows).toEqual([storedAccount]);
  } finally {
    await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.end();
  }
}, 30_000);
