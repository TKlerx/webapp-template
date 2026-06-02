# webapp-template Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-06-01

## Workflow First Step

- Read `CONTINUE.md` before starting implementation work.
- Use `CONTINUE.md` for recent changes, current stopping point, open issues, and next actions.
- Update `CONTINUE.md` and append to `CONTINUE_LOG.md` when project state materially changes.

## Active Technologies
- TypeScript 5.9 on Next.js 16 App Router, React 19, Python 3.12 worker where affected, PowerShell validation scripts + Prisma 7, Better Auth, Zod, Vitest, Playwright, GitHub Actions, GoReleaser, DeepSec 2.0.12 (017-deepsec-remediation)
- SQLite for local development, PostgreSQL for Docker/shared deployments; background job and audit data persisted via Prisma models (017-deepsec-remediation)

- TypeScript 5.9 on Next.js 16 App Router (React 19) + Next.js 16, React 19, Prisma 7, Better Auth, Zod, Vitest, Playwright, jscpd (011-route-refactor)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

pnpm test; pnpm run lint

## Code Style

TypeScript 5.9 on Next.js 16 App Router (React 19): Follow standard conventions

- Repository text files use UTF-8 encoding (UTF-8 with or without BOM)

## Recent Changes
- 017-deepsec-remediation: Added TypeScript 5.9 on Next.js 16 App Router, React 19, Python 3.12 worker where affected, PowerShell validation scripts + Prisma 7, Better Auth, Zod, Vitest, Playwright, GitHub Actions, GoReleaser, DeepSec 2.0.12

- 011-route-refactor: Added TypeScript 5.9 on Next.js 16 App Router (React 19) + Next.js 16, React 19, Prisma 7, Better Auth, Zod, Vitest, Playwright, jscpd

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
