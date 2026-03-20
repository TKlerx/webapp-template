# Tasks: Azure DB Export for Power BI

**Input**: Design documents from `/specs/004-azure-db-export/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md
**Dependency**: Features 1 (budget/receipts/donors) and 2 (review statuses/audit trail) must be implemented first.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install dependencies, extend schema, create shared export infrastructure

- [ ] T001 Install `mssql` and `node-cron` npm packages and add type definitions
- [ ] T002 Extend Prisma schema: add `ExportConfig` model (id, key, value, updatedAt), `ExportRun` model (id, triggeredById, triggerType, status, categoriesExported, filters, recordCounts, errorMessage, startedAt, completedAt), and extend `AuditAction` enum with EXPORT_TRIGGERED, EXPORT_COMPLETED, EXPORT_FAILED, EXPORT_CONFIG_CHANGED in `prisma/schema.prisma`
- [ ] T003 Create and run Prisma migration for ExportConfig and ExportRun models in `prisma/migrations/`
- [ ] T004 [P] Create Azure SQL connection service with `getConnection(config)`, `testConnection(config)`, and `closePool()` using mssql package in `src/lib/export-connection.ts`
- [ ] T005 [P] Create export configuration service with `getConfig()`, `updateConfig(updates)`, and `getConfigValue(key)` using ExportConfig key-value store with encryption for credentials (using BETTER_AUTH_SECRET) in `src/lib/export-config.ts`
- [ ] T006 [P] Create Azure DB schema manager with DDL statements for creating/updating target tables (dim_country, dim_budget_year, dim_budget_item, fact_receipt, fact_audit, dim_donor, dim_donor_project, bridge_donor_tag, meta_export) per research.md R3 in `src/lib/export-schema.ts`
- [ ] T007 [P] Create export data service with `exportCategory(connection, category, filters)` for each category (budgets, receipts, donors, audit) using transactional full-replace per category (BEGIN TRAN → TRUNCATE → batched INSERT in chunks of 1000 rows → COMMIT) per research.md R2 in `src/lib/export-data.ts`
- [ ] T008 [P] Create export orchestrator that coordinates the full export flow: validate config → connect → ensure schema → export selected categories → update meta_export → record ExportRun → log audit entry. Must wrap each category export in try/catch with ROLLBACK on failure to ensure atomicity (FR-005). Check for already-running exports before starting. In `src/lib/export-service.ts`
- [ ] T009 [P] Add i18n translation keys for export configuration UI, schedule settings, history page, status messages, and error messages across all 5 locales in `src/i18n/messages/{locale}.json`

**Checkpoint**: Dependencies installed, schema extended, export infrastructure ready

---

## Phase 2: User Story 1 — Manual Export to Azure DB (Priority: P1) 🎯 MVP

**Goal**: GVI Finance admin can trigger a data export to Azure DB and see success/failure with record counts

**Independent Test**: Configure Azure DB credentials, click "Export Now", verify Azure DB contains expected tables with correct data. Trigger export with unreachable DB, verify error message and no partial data.

### API Routes for User Story 1

- [ ] T010 [P] [US1] Implement `PUT /api/export/config` (GVI_FINANCE_ADMIN only, saves credentials + categories + filters, encrypts password, logs audit entry) and `GET /api/export/config` (returns config with password masked) in `src/app/api/export/config/route.ts`
- [ ] T011 [P] [US1] Implement `POST /api/export/test-connection` (validates credentials by attempting connection + simple query) in `src/app/api/export/test-connection/route.ts`
- [ ] T012 [P] [US1] Implement `POST /api/export` (GVI_FINANCE_ADMIN only, checks no concurrent export running, calls export orchestrator, returns ExportRun with status "running") in `src/app/api/export/route.ts`
- [ ] T013 [P] [US1] Implement `GET /api/export/history` (paginated list with status filter) and `GET /api/export/history/[id]` (full details including recordCounts and errorMessage) in `src/app/api/export/history/route.ts` and `src/app/api/export/history/[id]/route.ts`

### UI Pages for User Story 1

- [ ] T014 [US1] Create export configuration page with credential inputs (host, database, user, password, port), test connection button, data category toggles (budgets, receipts, donors, audit trail), filter settings (countries, budget years, date-since), and "Export Now" button with progress/status indicator in `src/app/(dashboard)/export/page.tsx`
- [ ] T015 [US1] Create export configuration form component with credential fields, test connection feedback, category checkboxes, and filter selectors in `src/components/export/ExportConfigForm.tsx`

**Checkpoint**: User Story 1 complete — manual export works end-to-end

---

## Phase 3: User Story 2 — Automated Scheduled Export (Priority: P1)

**Goal**: Admin configures a cron schedule for automatic exports. Scheduled exports run unattended and log results.

**Independent Test**: Configure daily export at 02:00, verify schedule is saved. Simulate scheduled trigger, verify export runs and result is logged in history.

### API Routes for User Story 2

- [ ] T016 [P] [US2] Implement `GET /api/export/schedule` and `PUT /api/export/schedule` (enable/disable, cron expression, validates cron syntax, logs audit entry) in `src/app/api/export/schedule/route.ts`

### Services for User Story 2

- [ ] T017 [US2] Create schedule manager using node-cron: load schedule from DB on app startup, register/update cron job on schedule change, cron callback checks for already-running exports before starting and calls the same export orchestrator as manual trigger in `src/lib/export-scheduler.ts`
- [ ] T018 [US2] Initialize export scheduler on app startup by loading schedule config and registering cron job if enabled in `src/app/layout.tsx` or a server-side initialization module

### UI for User Story 2

- [ ] T019 [US2] Add schedule configuration section to the export page: enable/disable toggle, cron expression input (or friendly presets like "Daily at 02:00"), last run timestamp, next run indicator in `src/app/(dashboard)/export/page.tsx` (extend T014)

**Checkpoint**: User Story 2 complete — scheduled exports run automatically

---

## Phase 4: User Story 3 — Export History and Monitoring (Priority: P2)

**Goal**: Admin views chronological export history with status, record counts, and error details

**Independent Test**: Run several exports including a simulated failure, verify history shows all runs with correct details. Filter by status "Failed".

### UI Components for User Story 3

- [ ] T020 [P] [US3] Create export history component with chronological table (timestamp, trigger type, status badge, record counts, duration) and status filter in `src/components/export/ExportHistory.tsx`
- [ ] T021 [US3] Create export run detail view showing full record counts per category, filters applied, error message (if failed), and duration in `src/components/export/ExportRunDetail.tsx`
- [ ] T022 [US3] Add export history section to the export page with link to detail view in `src/app/(dashboard)/export/page.tsx` (extend T014/T019)

**Note**: API routes for history already created in T013 (US1). This phase focuses on the UI presentation.

**Checkpoint**: User Story 3 complete — full export monitoring

---

## Phase 5: User Story 4 — Selective Export Configuration (Priority: P3)

**Goal**: Admin filters exports by country, budget year, and date range

**Independent Test**: Configure filters to export only Kenya 2026 data, run export, verify Azure DB contains only Kenya 2026 records

- [ ] T023 [US4] Ensure export data service (T007) respects country, budget year, and date-since filters when querying source data — add filter parameters to each category export function in `src/lib/export-data.ts` (extend T007)
- [ ] T024 [US4] Ensure export history records which filters were applied and displays them in the history detail view in `src/components/export/ExportRunDetail.tsx` (extend T021)

**Note**: Filter UI already created in T015 (config form). This phase ensures the backend respects filters and history records them.

**Checkpoint**: User Story 4 complete — selective exports work

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T025 [P] Add sidebar navigation entry for Export page with GVI_FINANCE_ADMIN role visibility
- [ ] T026 [P] Ensure all export actions (trigger, config save, schedule change, test connection) show toast notifications on success/error per constitution principle VI
- [ ] T027 [P] Verify responsive design on mobile viewport for export configuration, history, and schedule UI per constitution principle VIII
- [ ] T028 Run quickstart.md validation: walk through credential config → test connection → category selection → manual export → schedule setup → history review

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately (assumes Features 1 + 2 complete)
- **US1 (Phase 2)**: Depends on Phase 1 — manual export
- **US2 (Phase 3)**: Depends on Phase 2 — adds scheduling to existing export
- **US3 (Phase 4)**: Depends on Phase 2 — UI for history (API already in US1)
- **US4 (Phase 5)**: Depends on Phase 2 — adds filter enforcement
- **Polish (Phase 6)**: Depends on all prior phases

### User Story Dependencies

- **US1 (Manual Export)** — P1: Can start after Phase 1. Core value.
- **US2 (Scheduled Export)** — P1: Depends on US1 (reuses export orchestrator). Sequential.
- **US3 (History/Monitoring)** — P2: Depends on US1 (API in T013). Can parallel with US2.
- **US4 (Selective Filters)** — P3: Depends on US1. Can parallel with US2/US3.

### Parallel Opportunities

Within Phase 1: T004-T009 all in parallel (after T001-T003).
Within Phase 2: T010-T013 in parallel.
US3 and US4 can run in parallel after US1.

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: US1 — Manual export
3. Complete Phase 3: US2 — Scheduled export
4. **STOP and VALIDATE**: Export works manually and on schedule

### Full Delivery

5. Complete Phase 4: US3 — History UI
6. Complete Phase 5: US4 — Filter enforcement
7. Complete Phase 6: Polish
