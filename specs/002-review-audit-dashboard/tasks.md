# Tasks: Receipt Review & Audit Dashboard

**Input**: Design documents from `/specs/002-review-audit-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md
**Dependency**: Feature 1 (Budget Planning & Core Data Model) must be implemented first.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Extend Prisma schema with review models, add shared services

- [X] T001 Extend Prisma schema: add `ReviewStatus` enum (PENDING_REVIEW, APPROVED, FLAGGED, REJECTED), add `reviewStatus` field to Receipt model, create `ReviewComment` and `ReceiptRevision` models, extend `AuditAction` enum with RECEIPT_REVIEWED, RECEIPT_COMMENTED, RECEIPT_REVISED per data-model.md in `prisma/schema.prisma`
- [X] T002 Create and run Prisma migration for the new schema changes in `prisma/migrations/`
- [X] T003 [P] Create review state machine service with `validateTransition(currentStatus, newStatus, userRole)` and `applyReviewAction(receiptId, action, userId, comment?)` covering all 6 transitions (PENDING→APPROVED, PENDING→FLAGGED, PENDING→REJECTED, FLAGGED→PENDING, APPROVED→FLAGGED, REJECTED→FLAGGED) in `src/lib/review.ts`
- [X] T004 [P] Create audit export service with `exportToCSV(filters)` and `exportToPDF(filters)` returning binary buffers in `src/lib/audit-export.ts`
- [X] T005 [P] Create compliance aggregation service with `getCountrySummaries(budgetYearId, statusFilter)` and `getBudgetItemBreakdown(countryBudgetId, statusFilter)` using recursive queries in `src/lib/compliance.ts`
- [X] T006 [P] Add i18n translation keys for review statuses, review actions, audit trail labels, compliance dashboard text, and comment UI across all 5 locales in `src/i18n/messages/{locale}.json`

**Checkpoint**: Schema extended, shared services ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared UI components that multiple user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 [P] Create inline file viewer component (renders `<img>` for JPEG/PNG, `<iframe>`/`<embed>` for PDF, download link for others) in `src/components/ui/FileViewer.tsx`
- [X] T008 [P] Create review status badge component (color-coded: pending=yellow, approved=green, flagged=orange, rejected=red) in `src/components/ui/StatusBadge.tsx`

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 — GVI Finance Admin Reviews Receipts (Priority: P1) 🎯 MVP

**Goal**: GVI Finance admin can filter receipts, view them inline with metadata, and approve/flag/reject them with comments

**Independent Test**: Filter receipts by country and status, open a receipt, view the file inline, approve one, flag another with a comment — verify status changes and audit entries are created

> **NOTE on REJECTED→FLAGGED**: Per FR-018, GVI Finance admins can reverse any status including REJECTED→FLAGGED. This re-enables Country Finance response (the receipt re-enters the flag/respond cycle). The transition is covered by the state machine in T003.

### Tests for User Story 1
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**
- [X] T009 [P] [US1] Unit tests for review state machine transitions (all 6 valid transitions + invalid transitions denied), review API route authorization, and comment creation in `tests/unit/review.test.ts`
- [X] T010 [P] [US1] E2E test for full review workflow: admin opens review dashboard, filters by country/status, opens a receipt, approves it, opens another, flags it with a comment — verify status changes and audit trail entries in `tests/e2e/review-workflow.spec.ts`

### API Routes for User Story 1

- [X] T011 [P] [US1] Implement `POST /api/receipts/[id]/review` (GVI_FINANCE_ADMIN only, validates state transitions, requires comment for flag/reject, creates ReviewComment + AuditEntry) in `src/app/api/receipts/[id]/review/route.ts`
- [X] T012 [P] [US1] Implement `GET /api/receipts/[id]/comments` (all roles, country-scoped, chronological order) in `src/app/api/receipts/[id]/comments/route.ts`
- [X] T013 [P] [US1] Extend existing `GET /api/receipts` endpoint with review-specific query params (status, review=true for dashboard mode) and add page/limit query parameters for pagination (required for review dashboard performance) in `src/app/api/receipts/route.ts`

### UI Components for User Story 1

- [X] T014 [P] [US1] Create review actions component with Approve/Flag/Reject buttons and comment input (required for flag/reject) in `src/components/review/ReviewActions.tsx`
- [X] T015 [P] [US1] Create comment thread component showing all comments chronologically with author name, role badge, and timestamp in `src/components/review/CommentThread.tsx`
- [X] T016 [US1] Create review dashboard component with filterable receipt table (columns: country, budget item, amount, date, submitter, status) and filters (country, status, budget item, date range, submitter) in `src/components/review/ReviewDashboard.tsx`
- [X] T017 [US1] Create receipt review detail component combining FileViewer, metadata display, CommentThread, and ReviewActions in `src/components/review/ReceiptReviewDetail.tsx`

### Pages for User Story 1

- [X] T018 [US1] Create review dashboard page in `src/app/(dashboard)/review/page.tsx`
- [X] T019 [US1] Create receipt review detail page in `src/app/(dashboard)/review/[receiptId]/page.tsx`

**Checkpoint**: User Story 1 complete — GVI Finance admins can review receipts

---

## Phase 4: User Story 2 — Country Finance User Responds to Flagged Receipts (Priority: P1)

**Goal**: Country Finance users see flagged receipts, read reviewer comments, and respond with clarification comments or corrected file uploads. Response reverts status to Pending Review.

**Independent Test**: Flag a receipt as admin, log in as Country Finance, see the flag indicator, add a comment — verify status reverts to Pending Review. Upload a corrected file — verify original is retained and status reverts.

### Tests for User Story 2
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**
- [X] T020 [P] [US2] Unit tests for comment creation by Country Finance (only when FLAGGED, auto-revert to PENDING_REVIEW), revision upload validation (file type/size), and authorization (own receipts only) in `tests/unit/flag-response.test.ts`
- [X] T021 [P] [US2] E2E test for flag response workflow: admin flags a receipt with comment, Country Finance user logs in, sees flagged indicator, adds clarification comment (status reverts), uploads corrected file (original retained) — admin re-reviews with full history visible in `tests/e2e/flag-response.spec.ts`

### API Routes for User Story 2

- [X] T022 [P] [US2] Implement `POST /api/receipts/[id]/comments` (Country Finance: own receipts only when FLAGGED, auto-reverts status to PENDING_REVIEW, creates AuditEntry) in `src/app/api/receipts/[id]/comments/route.ts` (extend the GET-only route from T012)
- [X] T023 [P] [US2] Implement `GET /api/receipts/[id]/revisions` and `POST /api/receipts/[id]/revisions` (Country Finance: own receipts only when FLAGGED, multipart file upload, validates PDF/JPEG/PNG ≤20MB, stores via file-storage service, reverts status to PENDING_REVIEW) in `src/app/api/receipts/[id]/revisions/route.ts`

### UI Components for User Story 2

- [X] T024 [P] [US2] Create file revision viewer component showing original file + all revisions chronologically with upload dates in `src/components/review/FileRevisionViewer.tsx`
- [X] T025 [US2] Update Country Finance receipt list view to show flagged receipt indicators with reviewer comments and add response UI (comment input + file upload option) — extend existing receipt detail page or create `src/app/(dashboard)/receipts/[id]/respond/page.tsx`

**Checkpoint**: User Story 2 complete — two-way review communication works

---

## Phase 5: User Story 3 — Audit Trail Viewing (Priority: P2)

**Goal**: GVI Finance admin can view, filter, and export the audit trail as CSV or PDF for external auditors

**Independent Test**: Perform various actions (upload, review, budget edit), open audit trail, filter by date range and action type, verify entries appear correctly. Export as CSV and PDF.

### Tests for User Story 3
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**
- [X] T026 [P] [US3] Unit tests for audit export service (CSV format correctness, PDF generation, filter application) and audit API endpoint (pagination, filtering by date range/action/entity/country/actor) in `tests/unit/audit-trail.test.ts`
- [X] T027 [P] [US3] E2E test for audit trail workflow: perform several actions (upload receipt, review receipt, edit budget), open audit trail page, filter by date range and action type, verify entries appear correctly, export as CSV and verify file download in `tests/e2e/audit-trail.spec.ts`

### API Routes for User Story 3

- [X] T028 [P] [US3] Extend Feature 1's `GET /api/audit` endpoint with pagination (page, limit) and review-specific filters (action, entityType, countryId, dateFrom, dateTo, actorId) in `src/app/api/audit/route.ts`
- [X] T029 [P] [US3] Implement `GET /api/audit/export?format=csv|pdf` with same filters, returning binary file with Content-Disposition header in `src/app/api/audit/export/route.ts`

### UI Components for User Story 3

- [X] T030 [P] [US3] Create audit trail viewer component with filterable table (date, actor, action, entity, details) and pagination in `src/components/audit/AuditTrailViewer.tsx`
- [X] T031 [P] [US3] Create audit export button component triggering CSV/PDF download with current filters in `src/components/audit/AuditExportButton.tsx`

### Pages for User Story 3

- [X] T032 [US3] Create audit trail page combining viewer and export in `src/app/(dashboard)/audit-trail/page.tsx`

**Checkpoint**: User Story 3 complete — audit trail viewable and exportable

---

## Phase 6: User Story 4 — Budget Compliance Dashboard with Review Status (Priority: P2)

**Goal**: GVI Finance admin sees per-country compliance summary (budget, approved spend, total spend, status counts) with drill-down to budget hierarchy and individual receipts

**Independent Test**: With budgets and receipts in various review statuses, open compliance dashboard, verify correct aggregation per country. Drill down into a country, verify per-item breakdown. Check over-budget highlighting.

### Tests for User Story 4
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**
- [X] T033 [P] [US4] Unit tests for compliance aggregation service (correct summation of approved vs. total spend, status counts, per-item breakdown, over-budget detection, status filter application) in `tests/unit/compliance.test.ts`
- [X] T034 [P] [US4] E2E test for compliance dashboard workflow: open compliance dashboard, verify per-country summaries display correctly, drill down into a country, verify budget hierarchy with planned vs. actual, confirm over-budget items are highlighted, click through to individual receipts in `tests/e2e/compliance-dashboard.spec.ts`

### API Routes for User Story 4

- [X] T035 [P] [US4] Implement `GET /api/compliance?budgetYearId=X&statusFilter=approved|all` returning per-country summaries in `src/app/api/compliance/route.ts`
- [X] T036 [P] [US4] Implement `GET /api/compliance/[countryBudgetId]?statusFilter=approved|all` returning budget hierarchy with per-item aggregation in `src/app/api/compliance/[countryBudgetId]/route.ts`

### UI Components for User Story 4

- [X] T037 [P] [US4] Create compliance dashboard component with country summary cards (total budget, approved spend, total spend, %, status counts), budget year selector, and review status filter dropdown in `src/components/compliance/ComplianceDashboard.tsx`
- [X] T038 [P] [US4] Create budget drill-down component showing hierarchy with planned vs. actual, review status counts per item, over-budget highlighting, and click-to-receipts in `src/components/compliance/BudgetDrillDown.tsx`

### Pages for User Story 4

- [X] T039 [US4] Create compliance dashboard page with country-level view and drill-down navigation in `src/app/(dashboard)/compliance/page.tsx`
- [X] T040 [US4] Create compliance drill-down page for a specific country budget in `src/app/(dashboard)/compliance/[countryBudgetId]/page.tsx`

**Checkpoint**: User Story 4 complete — compliance dashboard with drill-down functional

---

## Phase 7: User Story 5 — Country Admin Views Review Status (Priority: P3)

**Goal**: Country Admin sees their country's receipt submission and review status summary. Can view flagged receipts but cannot perform review actions.

**Independent Test**: Log in as Country Admin, verify dashboard shows only their country's receipt status summary. View a flagged receipt, confirm review action buttons are hidden. Attempt review via API — verify denial.

### Tests for User Story 5
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**
- [X] T041 [P] [US5] Unit tests for Country Admin authorization (can view own country's review summary, cannot perform review actions, API denies review attempts) in `tests/unit/country-admin-view.test.ts`
- [X] T042 [P] [US5] E2E test for Country Admin view: log in as Country Admin, verify dashboard shows only their country's receipt status summary with correct counts, view a flagged receipt with reviewer comments (read-only), confirm review action buttons are not rendered in `tests/e2e/country-admin-view.spec.ts`

- [X] T043 [US5] Create country review status summary component showing receipt counts and amounts by status (pending, approved, flagged, rejected) in `src/components/review/CountryReviewSummary.tsx`
- [X] T044 [US5] Add country review summary to the Country Admin dashboard view, showing flagged receipts with reviewer comments (read-only, no review actions) in `src/app/(dashboard)/page.tsx` (extend existing dashboard with role-conditional content)

**Checkpoint**: User Story 5 complete — Country Admins have visibility into review status

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T045 [P] Update sidebar navigation to include Review Dashboard, Audit Trail, and Compliance Dashboard with role-based visibility (review: GVI_FINANCE_ADMIN; audit: GVI_FINANCE_ADMIN; compliance: GVI_FINANCE_ADMIN + COUNTRY_ADMIN) in sidebar/nav component
- [ ] T046 [P] Ensure all review actions, comments, and revision uploads trigger toast notifications on success/error per constitution principle VI
- [X] T047 [P] Verify responsive design on mobile viewport for review dashboard, receipt detail with file viewer, audit trail, and compliance dashboard per constitution principle VIII
- [X] T048 Run quickstart.md validation: walk through all 4 workflows (review receipt, respond to flag, audit trail + export, compliance dashboard) to confirm end-to-end functionality

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately (assumes Feature 1 complete)
- **Foundational (Phase 2)**: Depends on Phase 1 (schema + services)
- **US1 (Phase 3)**: Depends on Phase 2 — core review workflow
- **US2 (Phase 4)**: Depends on Phase 3 (needs review actions to exist for flagging)
- **US3 (Phase 5)**: Depends on Phase 1 (audit service) — can run parallel with US1/US2
- **US4 (Phase 6)**: Depends on Phase 1 (compliance service) — can run parallel with US1/US2
- **US5 (Phase 7)**: Depends on Phase 3 (needs review statuses on receipts)
- **Polish (Phase 8)**: Depends on all prior phases

### User Story Dependencies

- **US1 (Review Receipts)** — P1: Can start after Phase 2. No dependencies on other stories.
- **US2 (Respond to Flags)** — P1: Depends on US1 (needs flag capability to respond to).
- **US3 (Audit Trail)** — P2: Can start after Phase 1 (services only). Independent of Phase 2 and US1/US2.
- **US4 (Compliance Dashboard)** — P2: Can start after Phase 1 (services only). Independent of Phase 2 but richer with US1 review data.
- **US5 (Country Admin View)** — P3: Depends on US1 (needs review status data).

### Parallel Opportunities

Within Phase 1: T003, T004, T005, T006 can all run in parallel (after T001+T002).
Within Phase 2: T007, T008 in parallel.
Within Phase 3: T009, T010, T011, T012, T014, T015 in parallel (tests + API routes + components).
US3 and US4 can run in parallel after Phase 1 (independent of Phase 2 and US1/US2).

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: Setup (schema, services)
2. Complete Phase 2: Foundational (shared UI components)
3. Complete Phase 3: US1 — Receipt review workflow
4. **STOP and VALIDATE**: Core review capability works

### Full Delivery

5. Complete Phase 4: US2 — Flag response workflow
6. Complete Phase 5: US3 — Audit trail viewer + export (can parallel with Phase 4)
7. Complete Phase 6: US4 — Compliance dashboard (can parallel with Phase 4)
8. Complete Phase 7: US5 — Country Admin view
9. Complete Phase 8: Polish

---

## Summary

| Metric | Count |
|---|---|
| Total tasks | 48 |
| Test tasks | 10 |
| Implementation tasks | 38 |
| User stories covered | 5 |
| Phases | 8 |
