# Runtime And Ops

## Environment Model

### Local Development

- `DATABASE_URL="file:./dev.db"`
- app runs with SQLite
- `npm run dev` prepares the local database before startup
- Prisma uses the SQLite schema by default

### Docker / Production-Style Deployment

- Docker Compose runs PostgreSQL, migrations, app, and worker
- app and worker use an explicit Postgres `DATABASE_URL`
- Prisma migrations run through `prisma.config.postgres.ts`

## Database Behavior

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant App as Next.js
    participant DB as SQLite dev.db

    Dev->>App: npm run dev
    App->>DB: ensure local DB exists
    App->>DB: db push if empty
    App->>DB: migrate dev if non-empty
    App->>DB: seed initial admin if needed
```

```mermaid
sequenceDiagram
    participant Deploy as Deploy Script / Compose
    participant Migrate as Migrate Service
    participant Pg as PostgreSQL
    participant App as App Service
    participant Worker as Worker Service

    Deploy->>Migrate: start migration step
    Migrate->>Pg: prisma migrate deploy
    Deploy->>App: start app after success
    Deploy->>Worker: start worker after success
```

## Validation Model

- `.\validate.ps1 all`
  - typecheck
  - lint
  - duplication
  - semgrep
  - UTF-8 validation
  - dependency cooldown support validation
  - unit tests
- `.\validate.ps1 full`
  - heavier validation, including Playwright
- `.\validate.ps1 continuity`
  - checks whether `CONTINUE.md` / `CONTINUE_LOG.md` need refresh
- `.\validate.ps1 commit`
  - validates
  - refreshes continuity
  - stages continuity files
  - then commits

## Dependency Safety Policy

### npm

- repo-local policy file: `.npmrc`
- required setting:
  - `min-release-age=7`
- validation fails if the local npm binary does not support `--min-release-age`

### uv

- repo-local worker policy in `worker/pyproject.toml`
- required setting:
  - `[tool.uv]`
  - `exclude-newer = "1 week"`
- validation fails if the local `uv` binary does not support `--exclude-newer`

## Background Jobs Runtime

- jobs are created via the Next.js API
- jobs are stored in the shared database
- the worker claims pending jobs from the same database
- the admin dashboard displays recent jobs and status

## Baseline Operational Rules

- keep local dev simple
- keep Docker/prod behavior explicit
- prefer one shared source of truth in the database
- keep validation deterministic
- fail clearly when required tooling or policy support is missing
