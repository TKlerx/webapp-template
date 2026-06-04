# Continue

<!-- continuity:fingerprint=10d0766a3a44dc9dd481405efdc757f795fd990a03b41d763a05952d03b115b9 -->

## Current Snapshot

- Updated: 2026-06-04 17:34:45 +02:00
- Branch: `main`
- Latest commit on branch: `38f08aa Merge pull request #1 from TKlerx/017-deepsec-remediation`

## Git Status

- Working tree contains an uncommitted Postgres-first E2E default change.
- Intentional changed files:
  - `playwright.config.ts`
  - `scripts/ensure-e2e-db.mjs`
  - `tests/e2e/global.setup.ts`
  - `tests/e2e/global.teardown.ts`
  - `tests/e2e/helpers/db.ts`
  - `README.md`
  - `specs/017-deepsec-remediation/tasks.md`
  - `specs/017-deepsec-remediation/remediation-evidence.md`

## Recent Work

- Merged PR #1 into `main` and deleted the remote feature branch.
- Validated production-style Docker stack with Postgres, migrations, app, worker, and browser smoke testing before teardown.
- Switched Playwright E2E defaults from SQLite to a local Postgres container:
  - container: `webapp-template-e2e-postgres`
  - image: `postgres:18-alpine`
  - host port: `55432`
  - default URL: `postgresql://starter:starter_e2e_password@localhost:55432/business_app_starter_e2e?schema=public`
- Added `scripts/ensure-e2e-db.mjs` to create/start the E2E Postgres container, wait for readiness, generate the Postgres Prisma client, reset migrations, and seed the initial admin.
- Preserved explicit SQLite fallback when `DATABASE_URL` starts with `file:`.
- Disabled implicit Playwright app-server reuse for default E2E runs; set `E2E_REUSE_SERVER=1` only for intentional reuse without schema resets.
- Added transient Postgres connection retry handling around the E2E DB worker helper.
- Updated README and `specs/017-deepsec-remediation` tasks/evidence with the Postgres E2E default.

## Validation

- `pnpm run test:e2e` -> pass (`17` passed, `1` skipped) against Postgres.
- `pnpm run typecheck` -> pass.
- `pnpm run lint` -> pass.
- `pnpm exec prettier --check playwright.config.ts tests/e2e/global.setup.ts tests/e2e/global.teardown.ts tests/e2e/helpers/db.ts scripts/ensure-e2e-db.mjs` -> pass.
- `pnpm exec prettier --check .` -> fails on broad pre-existing formatting debt outside this slice.

## Next Recommended Actions

1. Review the Postgres E2E diff and ensure `package.json` has no real content diff before staging.
2. Commit the Postgres-first E2E default change.
3. Push `main` after commit if the user wants the change published immediately.
