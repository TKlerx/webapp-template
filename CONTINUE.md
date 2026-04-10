# Continue

<!-- continuity:fingerprint=68e9fcb749e9b4befab84cf941c3501cd231b8353daf842d859ecf3519f981e6 -->

## Current Snapshot

- Updated: 2026-04-10 17:20:00
- Branch: `012-openapi-and-pat`

## Recent Non-Continuity Commits

- 5e558fe Merge branch '013-cli-client' into template-main
- 517c394 feat(specs): add specs 012 (OpenAPI & PAT) and 013 (CLI client)
- a17ce02 chore(validate): show duplication threshold
- 6e196a6 chore(template): refresh provenance stamp
- 91c20e9 refactor(api): extract shared route services

## Git Status

- M .env.example
-  M Dockerfile.app
-  M docker-compose.yml
-  M package-lock.json
-  M package.json
-  M prisma/seed.ts
-  M src/app/globals.css
-  M src/lib/db.ts
-  M validate.ps1
- ?? components.json
- ?? src/components/shadcn/
- ?? src/lib/utils.ts

## Active Specs

- No active spec folders detected.

## Next Recommended Actions

1. No unchecked tasks remain in the active specs.

## Manual Notes

- Added shadcn configuration in [components.json](/c:/dev/gvi-finance-starter/components.json) with the `ui` alias pointed at `@/components/shadcn` to avoid collisions with the existing custom `src/components/ui` components on Windows.
- Added the shared `cn()` utility in [src/lib/utils.ts](/c:/dev/gvi-finance-starter/src/lib/utils.ts) and extended [src/app/globals.css](/c:/dev/gvi-finance-starter/src/app/globals.css) with shadcn-compatible design tokens while preserving the current theme variables.
- Installed a starter shadcn component set in `src/components/shadcn`: `button`, `input`, `label`, `textarea`, `card`, `table`, `dialog`, `dropdown-menu`, `sheet`, and `select`.
- Added runtime dependencies for the shadcn layer: `class-variance-authority`, `lucide-react`, `radix-ui`, and `tailwind-merge`.
- Replaced the implementations behind [src/components/ui/Button.tsx](/c:/dev/gvi-finance-starter/src/components/ui/Button.tsx) and [src/components/ui/Input.tsx](/c:/dev/gvi-finance-starter/src/components/ui/Input.tsx) so existing imports now use shadcn primitives through compatibility wrappers.
- Reworked [src/components/auth/CreateUserDialog.tsx](/c:/dev/gvi-finance-starter/src/components/auth/CreateUserDialog.tsx) into a real shadcn dialog with a trigger card, and replaced the remaining native dropdowns in user management and locale switching with shadcn `Select`.
- Updated [tests/e2e/users/user-management.spec.ts](/c:/dev/gvi-finance-starter/tests/e2e/users/user-management.spec.ts) to target the new dialog-based create-user flow.
- Hardened the existing database-backed worker in [worker/src/starter_worker/db.py](/c:/dev/gvi-finance-starter/worker/src/starter_worker/db.py) and [worker/src/starter_worker/main.py](/c:/dev/gvi-finance-starter/worker/src/starter_worker/main.py) with config-driven retries, backoff, and stale-lock requeue while preserving monitoring visibility through `status`, `attemptCount`, `availableAt`, `workerId`, and `error`.
- Added worker reliability config to [.env.example](/c:/dev/gvi-finance-starter/.env.example), documented it in [worker/README.md](/c:/dev/gvi-finance-starter/worker/README.md), and expanded [worker/tests/test_main.py](/c:/dev/gvi-finance-starter/worker/tests/test_main.py) to cover retry and stale-lock behavior.
- Added a retry hint to [src/app/(dashboard)/background-jobs/page.tsx](/c:/dev/gvi-finance-starter/src/app/(dashboard)/background-jobs/page.tsx) so requeued `PENDING` jobs visibly show the next retry attempt/time, with matching translation keys in `src/i18n/messages/*.json`.
- Split the Docker app image flow in [Dockerfile.app](/c:/dev/gvi-finance-starter/Dockerfile.app) and [docker-compose.yml](/c:/dev/gvi-finance-starter/docker-compose.yml) so the `app` service uses the lean `runner` stage while the `migrate` service uses a dedicated `migrate-runner` stage that still contains Prisma CLI tooling.
- Added [followups.md](/c:/dev/gvi-finance-starter/docs/security/followups.md) with a ranked handoff list of the remaining realistic security concerns and suggested next order of work.
- Added [actions.md](/c:/dev/gvi-finance-starter/docs/security/actions.md) as the concrete security action tracker, with completed and remaining items separated explicitly.
- Hardened [src/app/api/background-jobs/route.ts](/c:/dev/gvi-finance-starter/src/app/api/background-jobs/route.ts) and [src/services/api/background-jobs.ts](/c:/dev/gvi-finance-starter/src/services/api/background-jobs.ts) so only `PLATFORM_ADMIN` users can create jobs, job types are allowlisted, and payloads are capped at 10KB.
- Added production placeholder guards for the initial admin password in [prisma/seed.ts](/c:/dev/gvi-finance-starter/prisma/seed.ts) and for Docker Compose Postgres secrets in [docker-compose.yml](/c:/dev/gvi-finance-starter/docker-compose.yml).
- Hardened the runtime container in [Dockerfile.app](/c:/dev/gvi-finance-starter/Dockerfile.app) to run the app as a non-root user and attached the Compose services to an explicit internal network.
- Verification completed successfully with `npm run typecheck`, `npm run lint`, and `./validate.ps1 full`.
- Rebased [012-openapi-and-pat](/c:/dev/gvi-finance-starter/specs/012-openapi-and-pat/tasks.md) onto the current `template-main` baseline and marked the implemented 012 tasks in [tasks.md](/c:/dev/gvi-finance-starter/specs/012-openapi-and-pat/tasks.md).
- Added PAT and CLI auth schema support to [prisma/schema.prisma](/c:/dev/gvi-finance-starter/prisma/schema.prisma) and [prisma/schema.postgres.prisma](/c:/dev/gvi-finance-starter/prisma/schema.postgres.prisma), plus checked-in migration SQL under [prisma/migrations/20260410123650_add_openapi_and_pat_support/migration.sql](/c:/dev/gvi-finance-starter/prisma/migrations/20260410123650_add_openapi_and_pat_support/migration.sql) and [prisma/migrations-postgres/20260410123650_add_openapi_and_pat_support/migration.sql](/c:/dev/gvi-finance-starter/prisma/migrations-postgres/20260410123650_add_openapi_and_pat_support/migration.sql).
- Added PAT token services in [src/services/api/tokens.ts](/c:/dev/gvi-finance-starter/src/services/api/tokens.ts), CLI auth services in [src/services/api/cli-auth.ts](/c:/dev/gvi-finance-starter/src/services/api/cli-auth.ts), and token fallback auth in [src/lib/token-auth.ts](/c:/dev/gvi-finance-starter/src/lib/token-auth.ts) wired through [src/services/api/route-context.ts](/c:/dev/gvi-finance-starter/src/services/api/route-context.ts) and [src/lib/route-auth.ts](/c:/dev/gvi-finance-starter/src/lib/route-auth.ts).
- Added PAT, admin token, CLI auth, and OpenAPI routes under [src/app/api/tokens](/c:/dev/gvi-finance-starter/src/app/api/tokens/route.ts), [src/app/api/admin/tokens](/c:/dev/gvi-finance-starter/src/app/api/admin/tokens/route.ts), [src/app/api/cli-auth](/c:/dev/gvi-finance-starter/src/app/api/cli-auth/authorize/route.ts), and [src/app/api/openapi/route.ts](/c:/dev/gvi-finance-starter/src/app/api/openapi/route.ts).
- Added token management, admin token management, API docs, and CLI redirect UI in [src/app/(dashboard)/settings/tokens/page.tsx](/c:/dev/gvi-finance-starter/src/app/(dashboard)/settings/tokens/page.tsx), [src/app/(dashboard)/admin/tokens/page.tsx](/c:/dev/gvi-finance-starter/src/app/(dashboard)/admin/tokens/page.tsx), [src/app/(dashboard)/docs/api/page.tsx](/c:/dev/gvi-finance-starter/src/app/(dashboard)/docs/api/page.tsx), [src/app/cli-login/page.tsx](/c:/dev/gvi-finance-starter/src/app/cli-login/page.tsx), and new client components under [src/components/tokens](/c:/dev/gvi-finance-starter/src/components/tokens/token-list.tsx) plus [src/components/docs/swagger-ui.tsx](/c:/dev/gvi-finance-starter/src/components/docs/swagger-ui.tsx).
- Updated [src/components/auth/LoginForm.tsx](/c:/dev/gvi-finance-starter/src/components/auth/LoginForm.tsx) and the auth routes to preserve safe `redirectTo` targets so the CLI browser login flow works for both local sign-in and Azure SSO.
- Added locale and navigation support for tokens, admin tokens, API docs, and CLI login across [src/i18n/messages/en.json](/c:/dev/gvi-finance-starter/src/i18n/messages/en.json), [src/i18n/messages/de.json](/c:/dev/gvi-finance-starter/src/i18n/messages/de.json), [src/i18n/messages/es.json](/c:/dev/gvi-finance-starter/src/i18n/messages/es.json), [src/i18n/messages/fr.json](/c:/dev/gvi-finance-starter/src/i18n/messages/fr.json), [src/i18n/messages/pt.json](/c:/dev/gvi-finance-starter/src/i18n/messages/pt.json), and [src/components/ui/Navigation.tsx](/c:/dev/gvi-finance-starter/src/components/ui/Navigation.tsx).
- Added PAT-focused unit coverage in [tests/unit/token-service.test.ts](/c:/dev/gvi-finance-starter/tests/unit/token-service.test.ts) and extended [tests/unit/services/api/route-context.test.ts](/c:/dev/gvi-finance-starter/tests/unit/services/api/route-context.test.ts) for token fallback; `npm run validate` now passes.
- Added route-level integration coverage in [tests/integration/token-api.test.ts](/c:/dev/gvi-finance-starter/tests/integration/token-api.test.ts), [tests/integration/openapi.test.ts](/c:/dev/gvi-finance-starter/tests/integration/openapi.test.ts), and [tests/integration/cli-auth.test.ts](/c:/dev/gvi-finance-starter/tests/integration/cli-auth.test.ts), and updated [vitest.config.ts](/c:/dev/gvi-finance-starter/vitest.config.ts) so the integration suite runs as part of `npm test`.
- Added Playwright coverage for the docs page, token lifecycle, mobile/dark-mode token UI, and mock Azure SSO CLI flow in [tests/e2e/api-docs.spec.ts](/c:/dev/gvi-finance-starter/tests/e2e/api-docs.spec.ts), [tests/e2e/token-management.spec.ts](/c:/dev/gvi-finance-starter/tests/e2e/token-management.spec.ts), and [tests/e2e/auth/cli-sso-flow.spec.ts](/c:/dev/gvi-finance-starter/tests/e2e/auth/cli-sso-flow.spec.ts).
- Closed T011 by updating [src/services/api/types.ts](/c:/dev/gvi-finance-starter/src/services/api/types.ts) and [src/services/api/route-context.ts](/c:/dev/gvi-finance-starter/src/services/api/route-context.ts) so authenticated route results can carry the originating `Request` when present.
- Resolved the SQLite migrate bootstrap issue by initializing [dev.db](/c:/dev/gvi-finance-starter/dev.db) before running Prisma, then verified [package.json](/c:/dev/gvi-finance-starter/package.json) `prisma:migrate` succeeds and Prisma client generation still works.
- Switched [package.json](/c:/dev/gvi-finance-starter/package.json) `prisma:migrate:postgres` to `prisma migrate deploy --config prisma.config.postgres.ts`, and verified it successfully applies the checked-in PostgreSQL migrations against a live Postgres 18 test container.
