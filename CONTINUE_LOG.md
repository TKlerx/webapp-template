# Continue Log

## 2026-04-12 18:30:00

- Started spec `013-cli-client` on `main` and added it to `ACTIVE_SPECS.md` because the CLI work is not fully complete yet.
- Scaffolded a standalone Go CLI module under `cli/` with root command wiring, config storage, HTTP client/auth helpers, output renderers, command implementations, release config, and initial Go tests.
- Reconciled the CLI against the real server routes before implementing it, including the current `PATCH` user mutation endpoints and the split between `/api/audit` and `/api/audit/export`.
- Left the remaining spec tasks open where work is still partial or blocked by the missing Go toolchain, especially richer test coverage, final exit-code validation, and `go test` / `go vet`.

## 2026-04-12 19:05:00

- Installed Go support for the session and verified the CLI module with `go test ./...`, `go vet ./...`, and `go build ./...` from `cli/`.
- Fixed the issues that surfaced under real validation: added `go.sum`, corrected query-string preservation in the shared HTTP client, and updated the config permission test to respect Windows semantics.
- Expanded CLI test coverage for browser-login fallback and invalid-state handling, user mutation routes, forbidden/connection exit-code mapping, and audit export behavior.
- Switched the working branch from `main` to `013-cli-client` and reduced the remaining spec work to a single open item: the `gvi configure` success output still cannot print authenticated user identity cleanly without a suitable server endpoint.

## 2026-04-12 18:55:00

- Closed the final spec-013 gap by adding `/api/auth/me`, which reuses the existing shared session-or-token route auth and returns the authenticated user payload for PAT and CLI-token flows.
- Updated `gvi configure` to call both `/api/health` and `/api/auth/me`, then print the authenticated user name and role before finishing.
- Installed local Node dependencies, regenerated Prisma client artifacts, and verified the new web-side route with `npm exec -- tsc --noEmit` plus `npm exec -- vitest run tests/integration/token-api.test.ts`.
- Re-ran `go test ./...` and `go vet ./...` in `cli/`; spec `013-cli-client` is now fully complete and has been removed from `ACTIVE_SPECS.md`.

## 2026-04-10 10:45:00

- Implemented the concrete security actions for the background-jobs endpoint by requiring `PLATFORM_ADMIN` for job creation, allowlisting job types, and rejecting payloads larger than 10KB.
- Added a production seed guard for the default initial admin password and added Compose command guards that reject blank/default Postgres passwords in the production-style container flow.
- Updated the app runtime image to run as a non-root user and moved the Compose services onto an explicit internal network.
- Extended the background-jobs route unit tests and verified the full repo with `docker compose config`, the focused route test, and `./validate.ps1 full`.

## 2026-04-10 11:00:00

- Moved the security planning docs into `docs/security/` so they live in a clearer documentation subsection.
- Reworked the former `security-actions.md` note into a maintained action tracker with explicit completed and remaining sections.
- Updated continuity references to point at the new `docs/security/followups.md` and `docs/security/actions.md` locations.

## 2026-04-10 01:50:00

- Added `docs/security/followups.md` as a handoff note for the next security-focused session.
- Ranked the remaining realistic concerns by practical priority instead of mixing runtime, deploy-time, and operational issues together.
- Captured a suggested order for the next follow-up pass so work can resume quickly tomorrow.

## 2026-04-10 01:42:00

- Confirmed that Prisma CLI is not part of the shipped runtime image, but the Compose migration flow still needed it.
- Added a dedicated `migrate-runner` stage to `Dockerfile.app` and pointed the Compose `migrate` service at that stage, while keeping the `app` service on the lean `runner` stage.
- This keeps Prisma CLI available where deploy-time migrations need it without reintroducing dev tooling into the runtime app container.
- Verified with `docker compose config` plus `./validate.ps1 full`.

## 2026-04-10 01:24:00

- Added a retry badge to the background-jobs dashboard for `PENDING` jobs that are scheduled to retry after a previous failure.
- Kept the hint derived from the existing monitoring fields (`status`, `attemptCount`, `availableAt`, `updatedAt`, `error`) so no extra queue-specific metadata was needed.
- Added the new `backgroundJobs.retryScheduled` translation key across the locale files and updated the dashboard unit test to cover the retry hint.
- Verified with the focused background-jobs page unit test plus `npm run typecheck`, `npm run lint`, and `./validate.ps1 full`.

## 2026-04-10 01:35:00

- Kept the starter on the existing database-backed queue instead of introducing Redis, and hardened the Python worker with retry/backoff and stale-lock recovery.
- Added `WORKER_MAX_ATTEMPTS`, `WORKER_RETRY_BACKOFF_SECONDS`, and `WORKER_STALE_LOCK_SECONDS` configuration, with retries remaining observable through the existing `BackgroundJob` fields used by the dashboard.
- Extended the worker test suite to cover retry scheduling, terminal failure after max attempts, and requeueing stale `IN_PROGRESS` jobs.
- Verified the change with `uv run python -m unittest tests.test_main` from `worker/`, plus `npm run typecheck`, `npm run lint`, and `./validate.ps1 full`.

## 2026-04-10 01:05:00

- Converted `CreateUserDialog` from an inline card form into a real shadcn dialog while keeping the surrounding page layout lightweight.
- Replaced the remaining native `<select>` controls in user management and locale switching with shadcn `Select`.
- Updated the affected Playwright user-management flow to open the dialog and interact with the shadcn combobox/option controls.
- Verified the migration with `npm run typecheck`, `npm run lint`, `npm test`, the focused Playwright user-management spec, and `./validate.ps1 full`.

## 2026-04-10 00:00:00

- Switched the existing `src/components/ui/Button.tsx` and `src/components/ui/Input.tsx` implementations to shadcn-backed compatibility wrappers.
- Preserved the current import surface and the existing `primary | secondary` button API so auth and dashboard code did not need a large import rewrite.
- Verified the wrapper migration with `npm run typecheck`, `npm run lint`, and `./validate.ps1 full`.

## 2026-04-09 20:17:00

- Added shadcn support to the starter without replacing the existing custom `src/components/ui` layer.
- Created `components.json` so shadcn-generated components target `src/components/shadcn`, avoiding Windows case-insensitive filename conflicts with `Button.tsx` and `Input.tsx`.
- Added `src/lib/utils.ts`, extended the global theme tokens, and installed a starter shadcn component set for forms, dialogs, tables, and layout primitives.
- Declared the required shadcn runtime dependencies and verified the repo with `npm run typecheck`, `npm run lint`, and `./validate.ps1 full`.

## 2026-03-29 12:00:00

- Switched the starter template from SQLite to PostgreSQL across Prisma, Better Auth, seed logic, Docker Compose, and deployment scripts.
- Replaced the SQLite-specific E2E database helper with Prisma-backed seeding utilities.
- Updated starter documentation and constitution references to describe PostgreSQL as the default database.
- Manual continuity refresh used because sandbox git safety restrictions prevented automatic repository status collection.

## 2026-03-21

- Created `CONTINUE.md` and `CONTINUE_LOG.md` to track recent changes, current state, and next actions.
- Recorded the current `002-review-audit-dashboard` status, including the remaining `T046` task.
- Added constitution guidance requiring continuity files and auditability of their updates.
- Planned pre-commit enforcement so continuity files are updated alongside material code changes.
- Updated the continuity files after implementing the hook and constitution changes so the next commit has an accurate handoff snapshot.
## 2026-03-21 13:36:34

- Branch snapshot refreshed for `002-review-audit-dashboard`.
- Latest non-continuity commit: 1d16c57 Complete review dashboard validation and handoff workflow.
- Active specs: 002-review-audit-dashboard.
- Next focus: 002-review-audit-dashboard: T046.
## 2026-03-21 13:37:05

- Branch snapshot refreshed for `002-review-audit-dashboard`.
- Latest non-continuity commit: 1d16c57 Complete review dashboard validation and handoff workflow.
- Active specs: 002-review-audit-dashboard.
- Next focus: 002-review-audit-dashboard: T046.
## 2026-03-21 13:42:28

- Branch snapshot refreshed for `002-review-audit-dashboard`.
- Latest non-continuity commit: 1d16c57 Complete review dashboard validation and handoff workflow.
- Active specs: 002-review-audit-dashboard.
- Next focus: 002-review-audit-dashboard: T046.
## 2026-03-21 13:44:57

- Branch snapshot refreshed for `002-review-audit-dashboard`.
- Latest non-continuity commit: 1d16c57 Complete review dashboard validation and handoff workflow.
- Active specs: 002-review-audit-dashboard.
- Next focus: 002-review-audit-dashboard: T046.
## 2026-03-21 13:46:46

- Branch snapshot refreshed for `002-review-audit-dashboard`.
- Latest non-continuity commit: 1d16c57 Complete review dashboard validation and handoff workflow.
- Active specs: 002-review-audit-dashboard.
- Next focus: 002-review-audit-dashboard: T046.
## 2026-03-21 13:58:55

- Branch snapshot refreshed for `002-review-audit-dashboard`.
- Latest non-continuity commit: 3108cc0 Add automated continuity update workflow.
- Active specs: 002-review-audit-dashboard.
- Next focus: no next task.
## 2026-03-21 13:59:41

- Branch snapshot refreshed for `002-review-audit-dashboard`.
- Latest non-continuity commit: 3108cc0 Add automated continuity update workflow.
- Active specs: 002-review-audit-dashboard.
- Next focus: no next task.
## 2026-03-21 14:02:04

- Branch snapshot refreshed for `002-review-audit-dashboard`.
- Latest non-continuity commit: 3108cc0 Add automated continuity update workflow.
- Active specs: 002-review-audit-dashboard.
- Next focus: no next task.
## 2026-03-21 14:05:56

- Branch snapshot refreshed for `main`.
- Latest non-continuity commit: fc4299a Reduce auth and user route duplication.
- Active specs: 002-review-audit-dashboard.
- Next focus: no next task.
## 2026-03-21 14:46:32

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: 501f1b3 Generalize starter branding and dashboard home.
- Active specs: none.
- Next focus: no next task.
## 2026-03-21 15:51:17

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: 5f63e64 Make validation script more portable.
- Active specs: none.
- Next focus: no next task.
## 2026-03-21 17:41:50

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: 0146740 Remove finance-specific review and compliance modules.
- Active specs: 001-budget-planning-core, 002-review-audit-dashboard, 003-donor-project-reporting, 004-azure-db-export, 005-ai-receipt-processing, 006-mobile-receipt-capture, 007-email-notifications, 008-dashboard-home.
- Next focus: no next task.
## 2026-03-21 17:42:31

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: 0146740 Remove finance-specific review and compliance modules.
- Active specs: none.
- Next focus: no next task.
## 2026-03-21 17:51:33

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: 7897091 Extract neutral starter core from finance app.
- Active specs: none.
- Next focus: no next task.
## 2026-03-21 17:52:11

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: 7897091 Extract neutral starter core from finance app.
- Active specs: none.
- Next focus: no next task.
## 2026-03-21 17:54:37

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: 7897091 Extract neutral starter core from finance app.
- Active specs: none.
- Next focus: no next task.
## 2026-03-21 18:09:18

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: 7897091 Extract neutral starter core from finance app.
- Active specs: none.
- Next focus: no next task.
## 2026-03-21 18:11:35

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: 0dff4a7 Rename starter access scope model.
- Active specs: none.
- Next focus: no next task.
## 2026-03-21 18:13:20

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: 0dff4a7 Rename starter access scope model.
- Active specs: none.
- Next focus: no next task.
## 2026-03-30 23:54:52

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: 71e55e7 Add observability baseline.
- Active specs: none.
- Next focus: no next task.
## 2026-03-30 23:58:17

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: 71e55e7 Add observability baseline.
- Active specs: none.
- Next focus: no next task.
## 2026-03-31 00:01:33

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: a59f32f feat(devx): improve local startup and runtime visibility.
- Active specs: none.
- Next focus: no next task.
## 2026-03-31 14:23:03

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: d61c1b7 chore(validate): enforce utf-8 text file encoding.
- Active specs: none.
- Next focus: no next task.
## 2026-03-31 14:24:00

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: d61c1b7 chore(validate): enforce utf-8 text file encoding.
- Active specs: none.
- Next focus: no next task.
## 2026-03-31 14:25:41

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: d61c1b7 chore(validate): enforce utf-8 text file encoding.
- Active specs: none.
- Next focus: no next task.
## 2026-03-31 14:28:54

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: d61c1b7 chore(validate): enforce utf-8 text file encoding.
- Active specs: none.
- Next focus: no next task.
## 2026-03-31 16:56:00

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: dbe13bc docs(auth): add authentication flow review notes.
- Active specs: none.
- Next focus: no next task.
## 2026-03-31 17:19:21

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: 5094b17 feat(worker): add background jobs worker and admin dashboard.
- Active specs: none.
- Next focus: no next task.
## 2026-03-31 17:19:28

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: 5094b17 feat(worker): add background jobs worker and admin dashboard.
- Active specs: none.
- Next focus: no next task.
## 2026-03-31 17:20:16

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: 5094b17 feat(worker): add background jobs worker and admin dashboard.
- Active specs: none.
- Next focus: no next task.
## 2026-03-31 17:29:20

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: d379eb5 fix(auth): stabilize login form hydration and auth messages.
- Active specs: none.
- Next focus: no next task.
## 2026-03-31 17:29:58

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: d379eb5 fix(auth): stabilize login form hydration and auth messages.
- Active specs: none.
- Next focus: no next task.
## 2026-03-31 17:30:48

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: d379eb5 fix(auth): stabilize login form hydration and auth messages.
- Active specs: none.
- Next focus: no next task.
## 2026-03-31 17:32:24

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: d379eb5 fix(auth): stabilize login form hydration and auth messages.
- Active specs: none.
- Next focus: no next task.
## 2026-03-31 17:33:20

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: d379eb5 fix(auth): stabilize login form hydration and auth messages.
- Active specs: none.
- Next focus: no next task.
## 2026-03-31 17:34:17

- Branch snapshot refreshed for `starter-template-extraction`.
- Latest non-continuity commit: d379eb5 fix(auth): stabilize login form hydration and auth messages.
- Active specs: none.
- Next focus: no next task.
## 2026-04-01 12:28:27

- Branch snapshot refreshed for `010-auth-security-hardening`.
- Latest non-continuity commit: 4a99b42 chore(validate): verify template provenance files.
- Active specs: 010-auth-security-hardening, 011-route-refactor.
- Next focus: no next task.
## 2026-04-01 21:36:19

- Branch snapshot refreshed for `011-route-refactor`.
- Latest non-continuity commit: ec1ca03 fix(e2e): stabilize production-style auth tests.
- Active specs: 011-route-refactor.
- Next focus: no next task.
## 2026-04-01 22:44:23

- Branch snapshot refreshed for `template-main`.
- Latest non-continuity commit: ec1ca03 fix(e2e): stabilize production-style auth tests.
- Active specs: 011-route-refactor.
- Next focus: no next task.
## 2026-04-03 09:23:06

- Branch snapshot refreshed for `template-main`.
- Latest non-continuity commit: 6e196a6 chore(template): refresh provenance stamp.
- Active specs: none.
- Next focus: no next task.
## 2026-04-03 09:26:51

- Branch snapshot refreshed for `template-main`.
- Latest non-continuity commit: 6e196a6 chore(template): refresh provenance stamp.
- Active specs: none.
- Next focus: no next task.
## 2026-04-09 13:50:57

- Branch snapshot refreshed for `template-main`.
- Latest non-continuity commit: 5e558fe Merge branch '013-cli-client' into template-main.
- Active specs: none.
- Next focus: no next task.
## 2026-04-09 13:51:41

- Branch snapshot refreshed for `template-main`.
- Latest non-continuity commit: 5e558fe Merge branch '013-cli-client' into template-main.
- Active specs: none.
- Next focus: no next task.
## 2026-04-09 18:19:31

- Branch snapshot refreshed for `template-main`.
- Latest non-continuity commit: 5e558fe Merge branch '013-cli-client' into template-main.
- Active specs: none.
- Next focus: no next task.
## 2026-04-09 18:52:00

- Branch snapshot refreshed for `template-main`.
- Latest non-continuity commit: 5e558fe Merge branch '013-cli-client' into template-main.
- Active specs: none.
- Next focus: no next task.
## 2026-04-09 18:57:50

- Branch snapshot refreshed for `template-main`.
- Latest non-continuity commit: 5e558fe Merge branch '013-cli-client' into template-main.
- Active specs: none.
- Next focus: no next task.
## 2026-04-09 19:11:53

- Branch snapshot refreshed for `template-main`.
- Latest non-continuity commit: 5e558fe Merge branch '013-cli-client' into template-main.
- Active specs: none.
- Next focus: no next task.
## 2026-04-09 19:15:26

- Branch snapshot refreshed for `template-main`.
- Latest non-continuity commit: 5e558fe Merge branch '013-cli-client' into template-main.
- Active specs: none.
- Next focus: no next task.
## 2026-04-09 20:14:38

- Branch snapshot refreshed for `template-main`.
- Latest non-continuity commit: 5e558fe Merge branch '013-cli-client' into template-main.
- Active specs: none.
- Next focus: no next task.
## 2026-04-10 12:55:00

- Branch snapshot refreshed for  12-openapi-and-pat.
- Active spec 012 is in progress with PAT auth, admin token management, OpenAPI docs, and CLI browser login support implemented.
- Remaining 012 work is focused on migrations execution follow-through plus integration/E2E validation tasks (T005, T006, T011, T019b, T025a, T030a, T030b, T036a, T036b, T043a, T046, T047, T047a, T049).
- Validation passed with 
pm run validate, but Prisma migrate commands still fail in this environment with a generic schema engine error, so migration SQL was checked in manually for follow-up.

## 2026-04-10 17:05:00

- Added integration coverage for PAT CRUD/auth, OpenAPI serving, and CLI auth routes; 
pm test now includes 	ests/integration/** through itest.config.ts.
- Added Playwright coverage for /docs/api, full token lifecycle UI, mobile/dark-mode token views, and the mock Azure SSO CLI callback flow.
- Spec 012 is now down to T005, T006, and T011 only; all other implementation, integration, and E2E tasks are marked complete in specs/012-openapi-and-pat/tasks.md.

## 2026-04-10 17:06:00

- Closed T011 by threading optional Request through RouteUserResult in src/services/api/types.ts and returning it from equireRouteUser() when available.
- 
pm run validate is green again after the typing update; only T005 and T006 remain open for spec 012.

## 2026-04-10 17:20:00

- Completed T005 by bootstrapping dev.db, running 
pm run prisma:migrate, and confirming 
pm run prisma:generate still succeeds.
- Completed T006 by updating prisma:migrate:postgres to use prisma migrate deploy --config prisma.config.postgres.ts and verifying it against a live PostgreSQL 18 container on 127.0.0.1:54329.
- Spec 012 is fully complete; removed it from ACTIVE_SPECS.md and refreshed continuity state.

## 2026-04-13 00:22:00

- Added a local `.env` for smoke testing the SQLite dev setup on `http://localhost:3270`.
- Bootstrapped the local SQLite database through `node scripts/ensure-local-db.mjs`, which pushed the schema, marked existing migrations as applied, and seeded the initial admin user.
- Performed a live CLI smoke test against the running Next app: `/api/health` returned `ok`, local login through `/api/auth/login` succeeded for `admin@example.com`, PAT creation through `/api/tokens` returned a usable `starter_pat_*` token, and `starterctl health`, `starterctl version`, and `starterctl users list --format json` all succeeded against the live server.
- Rechecked the earlier `STARTERCTL_CONFIG_DIR` concern and confirmed there is no CLI persistence bug there; the failed smoke command was a race caused by running `starterctl configure` and the next command in parallel before `config.json` had been written.
- Added CLI documentation in `cli/README.md` and linked it from the root `README.md`, with concrete instructions for building, configuring, smoke testing, cross-platform builds, GoReleaser usage, and troubleshooting.
- Added a separate end-user guide in `docs/cli-user-guide.md` and linked it from both `README.md` and `cli/README.md` so people can find usage instructions without reading the build-oriented CLI README.
- Added a short CLI cheat sheet to the top of `docs/cli-user-guide.md` and highlighted it from `README.md` so common commands are available as quick copy/paste examples.
- Added a documented PowerShell bootstrap flow in `docs/cli-user-guide.md` for creating the first PAT through the app API before the CLI is configured.
- Added a prominent dated reminder in `docs/security/actions.md`, `docs/security/followups.md`, and `CONTINUE.md` to upgrade `next` and `next-intl` on 2026-04-17, when both security fixes clear the repo's 7-day cooldown window.

