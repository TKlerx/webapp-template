# Business App Starter Worker

Minimal `uv`-managed Python worker that polls the shared
`BackgroundJob` table and processes jobs outside the Next.js request
lifecycle.

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

## Supported Demo Job Types

- `noop`
- `echo`
