# Business App Starter

A reusable internal web-app starter built from the extracted platform core of the original product.

Standalone template repo:

- `https://github.com/TKlerx/webapp-template`

Template provenance files:

- `TEMPLATE_VERSION.md`
- `.template-origin.json`
- refresh helper: `npm run template:stamp`

These files are intentionally committed into the template so copied repos still retain a visible upstream baseline even if Git history is removed.

## Includes

- Next.js 16 app router
- Prisma starter data model with SQLite for local development
- PostgreSQL-backed Docker deployment
- Go-based `starterctl` CLI with PAT-backed API access and GoReleaser packaging
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

## Template Maintenance

Treat this repo as the upstream template for downstream apps created from it.

Recommended workflow:

1. Fix shared bugs in the downstream app where you discovered them.
2. Port the generic part of that fix back into this template repo as a small, focused commit.
3. Add or update tests in this template for that shared behavior.
4. Re-apply the same fix to other downstream apps by cherry-picking the focused commit or porting the same small diff.

Guidelines:

- Keep shared subsystems in similar paths across apps when possible.
- Separate template-worthy fixes from app-specific feature work.
- Prefer small commits such as `fix(auth): ...` over large mixed changes.
- If a subsystem like auth needs repeated cross-app fixes, consider extracting it into a shared package later.
- Downstream apps should keep `TEMPLATE_VERSION.md` and `.template-origin.json` so they know which upstream template commit they are based on.
- After creating a downstream app or after pulling upstream template fixes, run `npm run template:stamp` and commit the updated provenance files.

## Validation

```powershell
.\validate.ps1 all
.\validate.ps1 e2e
.\validate.ps1 full
```

`all` includes dependency cooldown validation for npm and uv support.

## CLI

The Go CLI lives in [`cli/`](./cli/) and has its own guide at [`cli/README.md`](./cli/README.md).

For day-to-day CLI usage, see the user guide at [`docs/cli-user-guide.md`](./docs/cli-user-guide.md).
It now starts with a short copy/paste CLI cheat sheet for the most common workflows.

That guide covers:

- building `starterctl`
- local PAT-based configuration
- smoke testing against `http://localhost:3270`
- manual cross-platform builds
- GoReleaser snapshot packaging

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

Clone the standalone template repo and continue product-specific work from there instead of from the original worktree.
