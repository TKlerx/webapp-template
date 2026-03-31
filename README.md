# Business App Starter

A reusable internal web-app starter built from the extracted platform core of the original product.

## Includes

- Next.js 16 app router
- Prisma starter data model with SQLite for local development
- PostgreSQL-backed Docker deployment
- uv-managed Python worker skeleton for background jobs
- Azure SSO and local login
- role-based access control
- user administration
- dashboard home screen
- audit trail and export
- i18n, theme toggle, responsive UI
- Vitest, Playwright, Semgrep, duplication checks
- repo-local npm and uv dependency cooldown policy
- continuity workflow with `CONTINUE.md` and `CONTINUE_LOG.md`

## Base Spec

The repo baseline is documented in `specs/base/`:

- `specs/base/architecture.md`
- `specs/base/runtime-and-ops.md`

Read those files before creating new product-specific specs.

## Validation

```powershell
.\validate.ps1 all
.\validate.ps1 e2e
.\validate.ps1 full
```

`all` includes dependency cooldown validation for npm and uv support.

## Docker Deployment

- Local `npm run dev` uses SQLite via `DATABASE_URL=file:./dev.db`.
- Docker Compose overrides `DATABASE_URL` so `app` and `migrate` use PostgreSQL.
- `docker compose build app` builds one shared image reused by both `migrate` and `app`.
- `docker compose up -d worker` starts the Python background worker against the same Postgres database.

## Monitoring And Logging

- Request IDs are assigned in middleware and returned as the `x-request-id` response header.
- Structured JSON logs are emitted through `src/lib/logger.ts` and redact common secrets automatically.
- Runtime process failures are captured in `src/instrumentation.ts`.
- Health checks are exposed at `/api/health` with process and database status.
- `LOG_LEVEL` and `ENABLE_REQUEST_LOGGING` control verbosity and request logging behavior.

## Dependency Safety

- npm is configured with a 7-day package release delay through `.npmrc`
- uv worker resolution is configured with `exclude-newer = "1 week"`
- `validate.ps1` fails if the installed npm or uv version does not support those controls

## Suggested Next Step

Create a new repository from the `starter-template-extraction` branch and continue product-specific work there.
