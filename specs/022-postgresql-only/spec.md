# Feature Specification: PostgreSQL-only database support

**Created**: 2026-10-15
**Status**: Completed
**Input**: User requested removing SQLite and explicitly selected: finish auth fixes, remove SQLite, then resume archival.

## User Scenarios & Testing

### User Story 1 - Use The Same Database Everywhere (Priority: P1)

As a developer, I want the app and worker to use PostgreSQL locally and in deployment so database behavior and migrations do not diverge between engines.

**Why this priority**: Maintaining two adapters, schemas and migration histories adds work without a current product requirement.

**Independent Test**: Apply the retained PostgreSQL migrations to an isolated database, start the app against it, and exercise worker queue transitions with PostgreSQL.

**Acceptance Scenarios**:

1. **Given** a PostgreSQL connection, **When** the app, seed flow or worker starts, **Then** it uses PostgreSQL and the single supported schema.
2. **Given** a missing or unsupported connection, **When** configuration is resolved, **Then** it fails clearly without silently selecting a local file database or exposing credentials.

### User Story 2 - Develop And Test With Isolated Data (Priority: P1)

As a developer, I want simple PostgreSQL startup and isolated database tests so test setup cannot reset my application data.

**Why this priority**: Removing embedded storage must preserve a usable local workflow and trustworthy regression coverage.

**Independent Test**: Start the development service and provision a separate `_test` database, then run migration and worker database checks in disposable schemas.

**Acceptance Scenarios**:

1. **Given** configured local credentials, **When** I run `pnpm run db:up`, **Then** PostgreSQL becomes available on loopback and retains data across stops.
2. **Given** a test database, **When** regressions run, **Then** they use isolated PostgreSQL schemas and retain the existing production migration names.
3. **Given** an ordinary runtime database URL, **When** destructive test setup is requested, **Then** it is not used as an implicit test target.

### Edge Cases

- PostgreSQL is unavailable or credentials are invalid.
- A previous local environment still contains a file-based URL or local database files.
- A test override names a database that does not end in `_test`.
- Existing deployed migration metadata references the retained PostgreSQL migration names.

## Requirements

### Functional Requirements

- **FR-001**: The app, worker and seed flow MUST support PostgreSQL exclusively and reject missing or unsupported database URLs.
- **FR-002**: The repository MUST maintain a single Prisma schema and PostgreSQL migration history while preserving existing deployed migration identifiers.
- **FR-003**: Local development MUST provide PostgreSQL startup with persistent storage and loopback-only exposure.
- **FR-004**: Database-backed regression checks MUST run against PostgreSQL rather than a substitute engine.
- **FR-005**: Destructive test provisioning MUST use an explicit test override or dedicated test default, require a database name ending in `_test`, and never implicitly use the ordinary runtime URL.
- **FR-006**: Runtime-specific app, worker and migration credential separation MUST be preserved.
- **FR-007**: Existing local database files and original feature directories MUST be retained; no automatic local-data deletion or implicit data transfer is included.
- **FR-008**: Current setup documentation, CI, baseline specs and constitution MUST describe the PostgreSQL-only policy. Historical dual-engine planning statements are superseded by this policy.

## Success Criteria

- **SC-001**: Runtime storage code has no SQLite adapter or worker storage branch.
- **SC-002**: PostgreSQL migrations and anonymous-audit data-preservation checks pass on a real isolated PostgreSQL database.
- **SC-003**: App, worker, configuration and credential regressions pass with the single schema.
- **SC-004**: A developer can start the local database and app using the documented commands.
