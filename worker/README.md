# Webapp Template Worker

Teams outbound jobs submit their claimed job ID to the app's `/api/internal/teams/deliver` endpoint. Set `APP_INTERNAL_URL` including `BASE_PATH`, and the same random `TEAMS_DELIVERY_SHARED_SECRET` (at least 32 characters) in app and worker. Only the app refreshes/decrypts the target creator's delegated grant. Intake continues using application credentials. Teams sends retry at a fixed `WORKER_RETRY_BACKOFF_SECONDS`, up to three total attempts (or a lower `WORKER_MAX_ATTEMPTS`).

Minimal `uv`-managed Python worker that polls the shared
`BackgroundJob` table and processes jobs outside the Next.js request
lifecycle.

The worker keeps queue state visible in the database so the app can
monitor retries and failures without a separate queue backend.

## Local Setup

```powershell
cd worker
uv sync
uv run starter-worker
```

The worker automatically loads the shared repo-root `.env` file when started
from the `worker/` subdirectory. Production-style runs should set
`WORKER_DATABASE_URL`; local development can use the PostgreSQL `DATABASE_URL`.
PostgreSQL is the only supported database. Start it with `pnpm run db:up` from the repository root before starting the worker.

Tests use isolated schemas in a dedicated PostgreSQL database. Provision it from the repository root with `node scripts/ensure-e2e-db.mjs`, then run `uv run pytest` from `worker/`. `TEST_DATABASE_URL` can override the test connection; its database name must end in `_test`. Tests never reset the ordinary development database.

## Reliability Settings

- `WORKER_DATABASE_URL` preferred worker database URL
- `WORKER_POLL_INTERVAL_SECONDS` default: `3`
- `WORKER_MAX_ATTEMPTS` default: `3`
- `WORKER_RETRY_BACKOFF_SECONDS` default: `15`
- `WORKER_STALE_LOCK_SECONDS` default: `300`

Retries remain visible through the existing `BackgroundJob` fields:
`status`, `attemptCount`, `availableAt`, `workerId`, and `error`.

## Supported Job Types

- `noop`
- `echo`
- `notification_delivery`

`notification_delivery` sends queued notification emails through Microsoft Graph
using `MAIL_DEFAULT_MAILBOX`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, and
`GRAPH_TENANT_ID`. Notification delivery status is mirrored in the `Notification`
table so retries and terminal failures stay visible to the application.

## Supply-Chain Audit

The worker Dockerfile exposes a disposable `dependency-audit` target that runs:

```powershell
uv audit --frozen --no-dev
```

The target is used by the repo-level supply-chain gate and is not part of normal
worker startup:

```powershell
cd C:\dev\webapp-template
pwsh -NoProfile -File scripts\supply-chain-audit.ps1 -Artifact worker
```

The gate also scans the final worker runtime image with Trivy. High and Critical
findings block unless a narrow active exception exists in
`supply-chain-audit-exceptions.json`. If uv reports a vulnerability without
structured severity details, the wrapper fails closed so the finding is visible
for remediation or explicit review.
