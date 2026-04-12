# Continue

<!-- continuity:fingerprint=68e9fcb749e9b4befab84cf941c3501cd231b8353daf842d859ecf3519f981e6 -->

## Current Snapshot

- Updated: 2026-04-13 00:22:00
- Branch: `013-cli-client`

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

1. On 2026-04-17, upgrade `next` to `16.2.3` or newer and `next-intl` to `4.9.1` or newer, then run `.\validate.ps1 all` and re-run `npm audit --omit=dev --omit=optional`.
2. No unchecked tasks remain in the active specs.

## Manual Notes

- Added shadcn configuration in [components.json](/c:/dev/webapp-template/components.json) with the `ui` alias pointed at `@/components/shadcn` to avoid collisions with the existing custom `src/components/ui` components on Windows.
- Added the shared `cn()` utility in [src/lib/utils.ts](/c:/dev/webapp-template/src/lib/utils.ts) and extended [src/app/globals.css](/c:/dev/webapp-template/src/app/globals.css) with shadcn-compatible design tokens while preserving the current theme variables.
- Installed a starter shadcn component set in `src/components/shadcn`: `button`, `input`, `label`, `textarea`, `card`, `table`, `dialog`, `dropdown-menu`, `sheet`, and `select`.
- Added runtime dependencies for the shadcn layer: `class-variance-authority`, `lucide-react`, `radix-ui`, and `tailwind-merge`.
- Replaced the implementations behind [src/components/ui/Button.tsx](/c:/dev/webapp-template/src/components/ui/Button.tsx) and [src/components/ui/Input.tsx](/c:/dev/webapp-template/src/components/ui/Input.tsx) so existing imports now use shadcn primitives through compatibility wrappers.
- Reworked [src/components/auth/CreateUserDialog.tsx](/c:/dev/webapp-template/src/components/auth/CreateUserDialog.tsx) into a real shadcn dialog with a trigger card, and replaced the remaining native dropdowns in user management and locale switching with shadcn `Select`.
- Updated [tests/e2e/users/user-management.spec.ts](/c:/dev/webapp-template/tests/e2e/users/user-management.spec.ts) to target the new dialog-based create-user flow.
- Hardened the existing database-backed worker in [worker/src/starter_worker/db.py](/c:/dev/webapp-template/worker/src/starter_worker/db.py) and [worker/src/starter_worker/main.py](/c:/dev/webapp-template/worker/src/starter_worker/main.py) with config-driven retries, backoff, and stale-lock requeue while preserving monitoring visibility through `status`, `attemptCount`, `availableAt`, `workerId`, and `error`.
- Added worker reliability config to [.env.example](/c:/dev/webapp-template/.env.example), documented it in [worker/README.md](/c:/dev/webapp-template/worker/README.md), and expanded [worker/tests/test_main.py](/c:/dev/webapp-template/worker/tests/test_main.py) to cover retry and stale-lock behavior.
- Added a retry hint to [src/app/(dashboard)/background-jobs/page.tsx](/c:/dev/webapp-template/src/app/(dashboard)/background-jobs/page.tsx) so requeued `PENDING` jobs visibly show the next retry attempt/time, with matching translation keys in `src/i18n/messages/*.json`.
- Split the Docker app image flow in [Dockerfile.app](/c:/dev/webapp-template/Dockerfile.app) and [docker-compose.yml](/c:/dev/webapp-template/docker-compose.yml) so the `app` service uses the lean `runner` stage while the `migrate` service uses a dedicated `migrate-runner` stage that still contains Prisma CLI tooling.
- Added [followups.md](/c:/dev/webapp-template/docs/security/followups.md) with a ranked handoff list of the remaining realistic security concerns and suggested next order of work.
- Added [actions.md](/c:/dev/webapp-template/docs/security/actions.md) as the concrete security action tracker, with completed and remaining items separated explicitly.
- Hardened [src/app/api/background-jobs/route.ts](/c:/dev/webapp-template/src/app/api/background-jobs/route.ts) and [src/services/api/background-jobs.ts](/c:/dev/webapp-template/src/services/api/background-jobs.ts) so only `PLATFORM_ADMIN` users can create jobs, job types are allowlisted, and payloads are capped at 10KB.
- Added production placeholder guards for the initial admin password in [prisma/seed.ts](/c:/dev/webapp-template/prisma/seed.ts) and for Docker Compose Postgres secrets in [docker-compose.yml](/c:/dev/webapp-template/docker-compose.yml).
- Hardened the runtime container in [Dockerfile.app](/c:/dev/webapp-template/Dockerfile.app) to run the app as a non-root user and attached the Compose services to an explicit internal network.
- Verification completed successfully with `npm run typecheck`, `npm run lint`, and `./validate.ps1 full`.
- Rebased [012-openapi-and-pat](/c:/dev/webapp-template/specs/012-openapi-and-pat/tasks.md) onto the current `template-main` baseline and marked the implemented 012 tasks in [tasks.md](/c:/dev/webapp-template/specs/012-openapi-and-pat/tasks.md).
- Added PAT and CLI auth schema support to [prisma/schema.prisma](/c:/dev/webapp-template/prisma/schema.prisma) and [prisma/schema.postgres.prisma](/c:/dev/webapp-template/prisma/schema.postgres.prisma), plus checked-in migration SQL under [prisma/migrations/20260410123650_add_openapi_and_pat_support/migration.sql](/c:/dev/webapp-template/prisma/migrations/20260410123650_add_openapi_and_pat_support/migration.sql) and [prisma/migrations-postgres/20260410123650_add_openapi_and_pat_support/migration.sql](/c:/dev/webapp-template/prisma/migrations-postgres/20260410123650_add_openapi_and_pat_support/migration.sql).
- Added PAT token services in [src/services/api/tokens.ts](/c:/dev/webapp-template/src/services/api/tokens.ts), CLI auth services in [src/services/api/cli-auth.ts](/c:/dev/webapp-template/src/services/api/cli-auth.ts), and token fallback auth in [src/lib/token-auth.ts](/c:/dev/webapp-template/src/lib/token-auth.ts) wired through [src/services/api/route-context.ts](/c:/dev/webapp-template/src/services/api/route-context.ts) and [src/lib/route-auth.ts](/c:/dev/webapp-template/src/lib/route-auth.ts).
- Added PAT, admin token, CLI auth, and OpenAPI routes under [src/app/api/tokens](/c:/dev/webapp-template/src/app/api/tokens/route.ts), [src/app/api/admin/tokens](/c:/dev/webapp-template/src/app/api/admin/tokens/route.ts), [src/app/api/cli-auth](/c:/dev/webapp-template/src/app/api/cli-auth/authorize/route.ts), and [src/app/api/openapi/route.ts](/c:/dev/webapp-template/src/app/api/openapi/route.ts).
- Added token management, admin token management, API docs, and CLI redirect UI in [src/app/(dashboard)/settings/tokens/page.tsx](/c:/dev/webapp-template/src/app/(dashboard)/settings/tokens/page.tsx), [src/app/(dashboard)/admin/tokens/page.tsx](/c:/dev/webapp-template/src/app/(dashboard)/admin/tokens/page.tsx), [src/app/(dashboard)/docs/api/page.tsx](/c:/dev/webapp-template/src/app/(dashboard)/docs/api/page.tsx), [src/app/cli-login/page.tsx](/c:/dev/webapp-template/src/app/cli-login/page.tsx), and new client components under [src/components/tokens](/c:/dev/webapp-template/src/components/tokens/token-list.tsx) plus [src/components/docs/swagger-ui.tsx](/c:/dev/webapp-template/src/components/docs/swagger-ui.tsx).
- Updated [src/components/auth/LoginForm.tsx](/c:/dev/webapp-template/src/components/auth/LoginForm.tsx) and the auth routes to preserve safe `redirectTo` targets so the CLI browser login flow works for both local sign-in and Azure SSO.
- Added locale and navigation support for tokens, admin tokens, API docs, and CLI login across [src/i18n/messages/en.json](/c:/dev/webapp-template/src/i18n/messages/en.json), [src/i18n/messages/de.json](/c:/dev/webapp-template/src/i18n/messages/de.json), [src/i18n/messages/es.json](/c:/dev/webapp-template/src/i18n/messages/es.json), [src/i18n/messages/fr.json](/c:/dev/webapp-template/src/i18n/messages/fr.json), [src/i18n/messages/pt.json](/c:/dev/webapp-template/src/i18n/messages/pt.json), and [src/components/ui/Navigation.tsx](/c:/dev/webapp-template/src/components/ui/Navigation.tsx).
- Added PAT-focused unit coverage in [tests/unit/token-service.test.ts](/c:/dev/webapp-template/tests/unit/token-service.test.ts) and extended [tests/unit/services/api/route-context.test.ts](/c:/dev/webapp-template/tests/unit/services/api/route-context.test.ts) for token fallback; `npm run validate` now passes.
- Added route-level integration coverage in [tests/integration/token-api.test.ts](/c:/dev/webapp-template/tests/integration/token-api.test.ts), [tests/integration/openapi.test.ts](/c:/dev/webapp-template/tests/integration/openapi.test.ts), and [tests/integration/cli-auth.test.ts](/c:/dev/webapp-template/tests/integration/cli-auth.test.ts), and updated [vitest.config.ts](/c:/dev/webapp-template/vitest.config.ts) so the integration suite runs as part of `npm test`.
- Added Playwright coverage for the docs page, token lifecycle, mobile/dark-mode token UI, and mock Azure SSO CLI flow in [tests/e2e/api-docs.spec.ts](/c:/dev/webapp-template/tests/e2e/api-docs.spec.ts), [tests/e2e/token-management.spec.ts](/c:/dev/webapp-template/tests/e2e/token-management.spec.ts), and [tests/e2e/auth/cli-sso-flow.spec.ts](/c:/dev/webapp-template/tests/e2e/auth/cli-sso-flow.spec.ts).
- Closed T011 by updating [src/services/api/types.ts](/c:/dev/webapp-template/src/services/api/types.ts) and [src/services/api/route-context.ts](/c:/dev/webapp-template/src/services/api/route-context.ts) so authenticated route results can carry the originating `Request` when present.
- Resolved the SQLite migrate bootstrap issue by initializing [dev.db](/c:/dev/webapp-template/dev.db) before running Prisma, then verified [package.json](/c:/dev/webapp-template/package.json) `prisma:migrate` succeeds and Prisma client generation still works.
- Switched [package.json](/c:/dev/webapp-template/package.json) `prisma:migrate:postgres` to `prisma migrate deploy --config prisma.config.postgres.ts`, and verified it successfully applies the checked-in PostgreSQL migrations against a live Postgres 18 test container.
- Started spec 013 by adding a new standalone Go module under [cli/go.mod](/c:/dev/webapp-template/cli/go.mod) with the requested Cobra, go-pretty, browser, term, and testify dependencies plus the `cli/cmd`, `cli/internal/*`, and `cli/tests` structure.
- Implemented the first CLI delivery slice across [cli/main.go](/c:/dev/webapp-template/cli/main.go), [cli/cmd](/c:/dev/webapp-template/cli/cmd/root.go), and [cli/internal](/c:/dev/webapp-template/cli/internal/client/client.go): root command wiring, local JSON config storage, authenticated HTTP client with base-path handling, browser login flow, output formatters, user/audit/jobs/completion/health/version commands, and non-blocking release checks.
- Added initial Go-side test coverage in [cli/tests](/c:/dev/webapp-template/cli/tests/config_test.go) for config, client, output, login, users, audit, and jobs behavior, plus release scaffolding in [cli/.goreleaser.yaml](/c:/dev/webapp-template/cli/.goreleaser.yaml) and [cli-release.yml](/c:/dev/webapp-template/.github/workflows/cli-release.yml).
- Verified the CLI module successfully with `go test ./...`, `go vet ./...`, and `go build ./...` from `cli/` after adding `go.sum`, fixing Windows-aware test expectations, and correcting query-string handling in the shared HTTP client URL join logic.
- Switched the worktree onto the dedicated `013-cli-client` branch so the feature now matches the requested branch isolation.
- Added [src/app/api/auth/me/route.ts](/c:/dev/webapp-template/src/app/api/auth/me/route.ts) so PAT and CLI-token flows can retrieve the authenticated identity through the existing shared token/session auth path.
- Updated [cli/cmd/configure.go](/c:/dev/webapp-template/cli/cmd/configure.go) to validate both `/api/health` and `/api/auth/me`, then print the authenticated user name and role on success.
- Verified the new server-side identity route with `npm exec -- tsc --noEmit` plus `npm exec -- vitest run tests/integration/token-api.test.ts`, and confirmed the CLI still passes `go test ./...` and `go vet ./...`.
- Added a local [.env](/c:/dev/webapp-template/.env) for SQLite-backed dev smoke testing on `http://localhost:3270` with the seeded `admin@example.com` account.
- Completed a live CLI smoke test against the running Next app: `/api/health` returned `ok`, browserless login via `/api/auth/login` plus PAT creation via `/api/tokens` worked, and `starterctl configure`, `starterctl health`, `starterctl version`, and `starterctl users list --format json` all succeeded against the real server.
- Verified that `STARTERCTL_CONFIG_DIR` works correctly for isolated CLI config directories; the earlier failure was caused by running `configure` and the follow-up smoke command in parallel before the config file had been written.
- Added a dedicated CLI guide at [cli/README.md](/c:/dev/webapp-template/cli/README.md) and linked it from the top-level [README.md](/c:/dev/webapp-template/README.md), covering build, configure, smoke-test, cross-platform build, GoReleaser, and troubleshooting flows.
- Added a separate end-user CLI guide at [docs/cli-user-guide.md](/c:/dev/webapp-template/docs/cli-user-guide.md) for login, configuration, common commands, audit usage, background jobs, output formats, shell completion, logout, and troubleshooting.
- Added a short copy/paste CLI cheat sheet at the top of [docs/cli-user-guide.md](/c:/dev/webapp-template/docs/cli-user-guide.md) and pointed to it from [README.md](/c:/dev/webapp-template/README.md) for faster onboarding.
- Added a documented “bootstrap your first PAT” PowerShell flow to [docs/cli-user-guide.md](/c:/dev/webapp-template/docs/cli-user-guide.md), showing how to log into the app API and create a PAT before the CLI itself is configured.
- Documented a prominent security follow-up to upgrade `next` and `next-intl` on 2026-04-17, which is the first date both patched versions clear the repo's 7-day dependency cooldown window.

