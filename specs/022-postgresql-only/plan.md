# Implementation Plan: PostgreSQL-only database support

**Date**: 2026-10-15
**Status**: Completed

## Summary

Retain the deployed PostgreSQL schema and migration identifiers under the standard Prisma paths. Remove SQLite adapters, bootstrap helpers and worker SQL branches. Reuse the installed PostgreSQL driver, Docker/Rancher and existing test provisioning script; add a small development-only Compose service. Exercise real PostgreSQL using isolated test schemas and update the current baseline and constitution.

## Constraints

- Preserve original feature folders and local database files.
- Keep the existing app/worker/migration credential boundary.
- Never infer a destructive test connection from a runtime URL.
- Retain deployed migration names; do not replace them with a new baseline.
- No new storage abstraction or dependency is needed.

The existing PostgreSQL runtime driver is reused. Its already-transitive `@types/pg` declarations are now a direct development dependency because the real PostgreSQL migration regression imports `pg` directly.

## Constitution Check

The user explicitly chose this architecture update after the spec 010 corrections and before archival. Feature 014's completion remains ambiguous and is deferred for archival; this focused database update proceeds under that explicit sequencing instruction. The database policy amendment removes the earlier SQLite-local requirement and records its rationale and date.

## Validation

Run schema validation and generation, migration preservation checks, PostgreSQL worker regressions, app tests, type/lint/architecture/security checks, development startup and the repository validation gates. Test setup owns only its dedicated `_test` database and generated schemas. Shared deployment migrations require the normal deployment process; no production data conversion is included.

## Completion Evidence (2026-10-15)

- The single PostgreSQL schema validates. Eleven retained migration files match the former PostgreSQL paths; deployed migration identifiers are preserved. Fresh development and isolated test databases applied all eleven migrations including the anonymous-audit correction.
- Local PostgreSQL started healthy with persistent storage; development migrations/seed and app startup succeeded. The health endpoint reported the database healthy. Existing SQLite data files were preserved; no implicit data transfer occurred.
- All 273 TypeScript tests across 65 files and 22 Python tests passed, including real PostgreSQL migration/data-preservation and worker regressions. Type checks, input contracts, lint, formatting, architecture, duplication, Python/CLI quality, credentials, logging, encoding, dependency cooldown, provenance, workflow and OpenTofu checks passed.
- The full validation run initially reported two Semgrep findings in PostgreSQL test-fixture DDL. Review confirmed generated schema names use psycopg Identifier; the full Semgrep rerun passed with zero findings. No global security rule was disabled.
- Production build and all three focused browser checks passed: login/password change, notification creation and admin notification filtering. The separate 014 review exposed a notification-filter race; its correction passed a deterministic out-of-order-response regression. The broader feature remains incomplete for the requirements listed in its review.
