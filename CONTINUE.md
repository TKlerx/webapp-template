# Continue

<!-- continuity:fingerprint=68e9fcb749e9b4befab84cf941c3501cd231b8353daf842d859ecf3519f981e6 -->

## Current Snapshot

- Updated: 2026-04-09 20:14:38
- Branch: `template-main`

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

1. No unchecked tasks detected in the active specs.

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
- Added [docs/security-followups.md](/c:/dev/gvi-finance-starter/docs/security-followups.md) with a ranked handoff list of the remaining realistic security concerns and suggested next order of work.
- Hardened [src/app/api/background-jobs/route.ts](/c:/dev/gvi-finance-starter/src/app/api/background-jobs/route.ts) and [src/services/api/background-jobs.ts](/c:/dev/gvi-finance-starter/src/services/api/background-jobs.ts) so only `PLATFORM_ADMIN` users can create jobs, job types are allowlisted, and payloads are capped at 10KB.
- Added production placeholder guards for the initial admin password in [prisma/seed.ts](/c:/dev/gvi-finance-starter/prisma/seed.ts) and for Docker Compose Postgres secrets in [docker-compose.yml](/c:/dev/gvi-finance-starter/docker-compose.yml).
- Hardened the runtime container in [Dockerfile.app](/c:/dev/gvi-finance-starter/Dockerfile.app) to run the app as a non-root user and attached the Compose services to an explicit internal network.
- Verification completed successfully with `npm run typecheck`, `npm run lint`, and `./validate.ps1 full`.
