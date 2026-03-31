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

The worker supports both:

- `file:` SQLite URLs for local development
- PostgreSQL URLs for Docker/shared deployments

## Supported Demo Job Types

- `noop`
- `echo`
