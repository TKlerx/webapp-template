# Business App Starter Worker

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

The worker automatically loads the shared repo-root `.env` file, so the
same `DATABASE_URL` and related settings used by the Node app also apply
when the worker is started from the `worker/` subdirectory.

The worker supports both:

- `file:` SQLite URLs for local development
- PostgreSQL URLs for Docker/shared deployments

## Reliability Settings

- `WORKER_POLL_INTERVAL_SECONDS` default: `3`
- `WORKER_MAX_ATTEMPTS` default: `3`
- `WORKER_RETRY_BACKOFF_SECONDS` default: `15`
- `WORKER_STALE_LOCK_SECONDS` default: `300`

Retries remain visible through the existing `BackgroundJob` fields:
`status`, `attemptCount`, `availableAt`, `workerId`, and `error`.

## Supported Demo Job Types

- `noop`
- `echo`
