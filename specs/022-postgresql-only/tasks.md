# Tasks: PostgreSQL-only database support

- [x] T001 [US1] Consolidate Prisma schema/migrations and remove the app/seed SQLite adapter while validating runtime URLs.
- [x] T002 [US1] Remove the worker's duplicate SQLite storage implementation and validate PostgreSQL configuration.
- [x] T003 [US2] Provide local PostgreSQL startup and isolate destructive test provisioning from runtime connections.
- [x] T004 [US2] Run migration and worker regressions on real PostgreSQL, including preservation of existing audit data and known-user foreign keys.
- [x] T005 Update setup docs, CI, baseline specs and the constitution; preserve source feature folders and local data files.
- [x] T006 Run project validation and development startup, record evidence, then resume sequential archival.
