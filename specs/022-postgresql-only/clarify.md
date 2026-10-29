# Clarification Record: PostgreSQL-only Database Support

**Date**: 2026-10-15

This record captures decisions already stated in the feature specification and plan; it does not claim a new clarification interview.

- The user selected PostgreSQL-only support after the auth fixes and before further archival.
- App, worker, seed, local development, CI, and deployment use PostgreSQL.
- Existing deployed migration identifiers and local database files are preserved. Automatic data transfer is outside scope.
- Tests use an explicit test connection or a dedicated default ending in `_test`, with generated isolated schemas. Runtime connection variables are never an implicit destructive test target.
- App, worker, and migration credential separation remains required.

No unresolved clarification is needed to validate this implementation. Historical SQLite requirements are superseded by this feature's explicit PostgreSQL-only direction.
