# Research: PostgreSQL-only Database Support

**Date**: 2026-10-15

## Existing Implementation Evidence

- `prisma/schema.prisma` and `prisma/migrations/` hold the retained PostgreSQL schema and deployed migration names. Replacing the migration history would break deployment continuity.
- The app already depends on `pg` and `@prisma/adapter-pg`; the worker already uses `psycopg`. No additional storage abstraction is needed.
- `compose.dev.yml` provides persistent local PostgreSQL on loopback. `scripts/ensure-e2e-db.mjs` provisions dedicated test databases; migration and worker regressions use disposable schemas.
- `specs/base/` describes the updated baseline. `.specify/memory/spec.md` is a partial archive of Azure infrastructure and deployment smoke checks, not the complete storage specification.

## Decisions And Validation

Retain PostgreSQL's existing migration identifiers, use the installed drivers, and reject unsupported URLs. Keep runtime credential boundaries and test-database safeguards. Do not migrate or delete existing SQLite data automatically.

Validate migrations on real PostgreSQL, worker queue transitions, application regressions, credential checks, static analysis, production dependency audits, and browser tests. Feature 014's archival status remains outside this change.
