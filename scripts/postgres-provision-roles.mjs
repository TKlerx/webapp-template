import { Client } from "pg";

const requiredEnv = [
  "POSTGRES_ADMIN_DATABASE_URL",
  "APP_DATABASE_URL",
  "WORKER_DATABASE_URL",
  "MIGRATION_DATABASE_URL",
];

function readRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
}

function parseRoleUrl(name) {
  const databaseUrl = new URL(readRequiredEnv(name));
  if (!databaseUrl.username || !databaseUrl.password) {
    throw new Error(`${name} must include username and password`);
  }

  return {
    username: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
  };
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function ensureLoginRole(client, role) {
  const existing = await client.query(
    "select 1 from pg_roles where rolname = $1",
    [role.username],
  );

  const roleName = quoteIdentifier(role.username);
  const password = quoteLiteral(role.password);

  if (existing.rowCount === 0) {
    await client.query(
      `create role ${roleName} with login password ${password}`,
    );
    return;
  }

  await client.query(`alter role ${roleName} with login password ${password}`);
}

async function grantRuntimeAccess(client, role, migrationRole) {
  const roleName = quoteIdentifier(role.username);
  const migrationRoleName = quoteIdentifier(migrationRole.username);

  await client.query(`grant usage on schema public to ${roleName}`);
  await client.query(
    `grant select, insert, update, delete on all tables in schema public to ${roleName}`,
  );
  await client.query(
    `grant usage, select, update on all sequences in schema public to ${roleName}`,
  );
  await client.query(
    `alter default privileges for role ${migrationRoleName} in schema public grant select, insert, update, delete on tables to ${roleName}`,
  );
  await client.query(
    `alter default privileges for role ${migrationRoleName} in schema public grant usage, select, update on sequences to ${roleName}`,
  );
}

const workerTableGrants = {
  BackgroundJob: "select, insert, update",
  InboundEmail: "select, insert, update",
  Notification: "select, update",
  TeamsInboundMessage: "select, insert",
  TeamsIntakeSubscription: "select, update",
  TeamsIntegrationConfig: "select",
  TeamsOutboundMessage: "select, update",
};

async function grantWorkerAccess(client, worker, migration) {
  const workerRole = quoteIdentifier(worker.username);
  const migrationRole = quoteIdentifier(migration.username);
  await client.query(`grant usage on schema public to ${workerRole}`);
  await client.query(
    `revoke all on all tables in schema public from ${workerRole}`,
  );
  await client.query(
    `revoke all on all sequences in schema public from ${workerRole}`,
  );
  await client.query(
    `alter default privileges for role ${migrationRole} in schema public revoke all on tables from ${workerRole}`,
  );
  await client.query(
    `alter default privileges for role ${migrationRole} in schema public revoke all on sequences from ${workerRole}`,
  );
  const { rows } = await client.query(
    "select tablename from pg_tables where schemaname = 'public' and tablename = any($1)",
    [Object.keys(workerTableGrants)],
  );
  for (const { tablename } of rows) {
    await client.query(
      `grant ${workerTableGrants[tablename]} on table public.${quoteIdentifier(tablename)} to ${workerRole}`,
    );
  }
}

async function main() {
  const roles = {
    app: parseRoleUrl("APP_DATABASE_URL"),
    worker: parseRoleUrl("WORKER_DATABASE_URL"),
    migration: parseRoleUrl("MIGRATION_DATABASE_URL"),
  };
  if (new Set(Object.values(roles).map((role) => role.username)).size !== 3) {
    throw new Error(
      "Cloud runtime provisioning requires distinct app, worker and migration roles.",
    );
  }

  const client = new Client({
    connectionString: readRequiredEnv("POSTGRES_ADMIN_DATABASE_URL"),
  });

  await client.connect();

  try {
    await client.query("begin");

    if (!process.argv.includes("--worker-grants-only")) {
      for (const role of Object.values(roles)) {
        await ensureLoginRole(client, role);
      }
      const migrationRoleName = quoteIdentifier(roles.migration.username);
      await client.query(
        `grant create, usage on schema public to ${migrationRoleName}`,
      );
      await grantRuntimeAccess(client, roles.app, roles.migration);
    }
    await grantWorkerAccess(client, roles.worker, roles.migration);

    await client.query("commit");
    console.log("PostgreSQL runtime roles provisioned.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
