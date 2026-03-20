# Tasks: Donor Project Reporting

**Input**: Design documents from `/specs/003-donor-project-reporting/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md
**Dependency**: Features 1 (budget/receipts/donor tagging) and 2 (review statuses) must be implemented first.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install dependencies, extend schema, create shared services

> **NOTE**: pdfmake is the confirmed PDF library for this feature. The plan evaluated both pdfmake and @react-pdf/renderer; pdfmake was selected for its server-side rendering capability and simpler table layout support.

- [ ] T001 Install `pdfmake` and `exceljs` npm packages and add type definitions
- [ ] T002 Extend Prisma schema: add `DonorReport` model (donorProjectId, generatedById, dateFrom, dateTo, statusFilter, language, includeImages, format, filePath, fileName, fileSize, receiptCount, createdAt) and extend `AuditAction` enum with `DONOR_REPORT_GENERATED` in `prisma/schema.prisma`
- [ ] T003 Create and run Prisma migration for the DonorReport model in `prisma/migrations/`
- [ ] T004 [P] Create report data aggregation service with `aggregateReportData(donorProjectId, dateFrom, dateTo, statusFilter)` returning structured report data (summary with per-currency subtotals grouped by currency code, budget breakdown grouped by budget year when period spans multiple years, receipt list with approved vs. non-approved clearly separated when statusFilter is "all") in `src/lib/report-generator.ts`
- [ ] T005 [P] Create PDF rendering service using pdfmake with GVI branding (header, footer, page numbers), financial summary table, budget breakdown table, receipt list table, and optional receipt image appendix in `src/lib/report-pdf.ts`
- [ ] T006 [P] Create Excel rendering service using exceljs with worksheets for summary, budget breakdown, and receipt list with number formatting and styling in `src/lib/report-excel.ts`
- [ ] T007 [P] Create report i18n helper that loads translations server-side for a selected locale (independent of UI locale) for report headers, labels, and status names in `src/lib/report-i18n.ts`
- [ ] T008 [P] Add i18n translation keys for report configuration UI, report preview labels, history page, and report-specific content (headers, column names, status labels) across all 5 locales in `src/i18n/messages/{locale}.json`

**Checkpoint**: Dependencies installed, schema extended, rendering services ready

---

## Phase 2: User Story 1 — Generate Donor Project Report (Priority: P1) 🎯 MVP

**Goal**: GVI Finance admin can generate a financial report for a donor project and export it as PDF or Excel

**Independent Test**: Open a donor project with tagged budget items and receipts, click Generate Report, verify the exported PDF/Excel contains correct donor name, period, financial summary with per-currency subtotals, budget item breakdown, and receipt list

### Tests for User Story 1
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**
- [ ] T009 [P] [US1] Unit test for report data aggregation service (correct summary, per-currency subtotals, budget breakdown, receipt list, edge case: no data returns empty) in `tests/unit/report-generator.test.ts`
- [ ] T010 [P] [US1] Unit test for PDF rendering service (generates valid PDF buffer, includes branding, financial tables, optional image appendix) in `tests/unit/report-pdf.test.ts`
- [ ] T011 [P] [US1] Unit test for Excel rendering service (generates valid xlsx buffer, worksheets present, number formatting correct) in `tests/unit/report-excel.test.ts`
- [ ] T012 [P] [US1] Unit test for POST /api/donor-projects/[id]/report (role guard, param validation, creates DonorReport + AuditEntry, returns 201) in `tests/unit/report-api.test.ts`
- [ ] T013 [P] [US1] E2E test for report generation flow: open donor project, configure params, generate report, verify PDF/Excel download succeeds in `tests/e2e/donor-report-generate.spec.ts`

### API Routes for User Story 1

- [ ] T014 [P] [US1] Implement `POST /api/donor-projects/[id]/report` (GVI_FINANCE_ADMIN only, validates params, calls report-generator + report-pdf/excel, stores file in `uploads/reports/`, creates DonorReport + AuditEntry) in `src/app/api/donor-projects/[id]/report/route.ts`

### UI Components for User Story 1

- [ ] T015 [P] [US1] Create report configuration form component with date range picker, status filter (approved only / all), language selector, format selector (PDF/Excel), and include-images toggle. Disable generation button with "No data available" message when donor project has no tagged budget items or receipts in `src/components/reports/ReportConfigForm.tsx`
- [ ] T016 [P] [US1] Create report summary component showing financial totals with per-currency subtotals in `src/components/reports/ReportSummary.tsx`
- [ ] T017 [P] [US1] Create budget breakdown table component showing tagged items with planned, actual, variance per item in `src/components/reports/BudgetBreakdownTable.tsx`
- [ ] T018 [P] [US1] Create receipt list table component showing individual receipts with date, amount, description, budget item, status in `src/components/reports/ReceiptListTable.tsx`

### Pages for User Story 1

- [ ] T019 [US1] Create report generation page combining config form and export trigger for a donor project in `src/app/(dashboard)/donors/[id]/report/page.tsx`

**Checkpoint**: User Story 1 complete — reports can be generated and exported

---

## Phase 3: User Story 2 — Configure Report Parameters (Priority: P1)

**Goal**: Admin configures reporting period and status filter before generation. Report header reflects parameters.

**Independent Test**: Generate reports with different date ranges and status filters, verify only matching receipts appear. Verify report header shows period and filter used.

### Tests for User Story 2
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**
- [ ] T020 [P] [US2] Unit test for parameter validation (dateFrom < dateTo, invalid language/format/statusFilter rejected, valid params accepted) in `tests/unit/report-params-validation.test.ts`
- [ ] T021 [P] [US2] E2E test for parameter filtering: generate report with Q1 date range, verify only Q1 receipts included; generate with "approved only", verify non-approved excluded in `tests/e2e/donor-report-params.spec.ts`

- [ ] T022 [US2] Add parameter validation in report generation API (dateFrom < dateTo, valid language/format/statusFilter) and include parameters in report header content in `src/app/api/donor-projects/[id]/report/route.ts` (extend T014) and `src/lib/report-pdf.ts` / `src/lib/report-excel.ts`

**Note**: Most of US2 is covered by T014 (API validates and passes params) and T015 (config form). T022 ensures validation edge cases and header display are complete.

**Checkpoint**: User Story 2 complete — parameters fully validated and reflected in exports

---

## Phase 4: User Story 3 — Report Preview (Priority: P2)

**Goal**: Admin sees an on-screen preview of the report before exporting. Preview matches export content and updates when parameters change.

**Independent Test**: Configure parameters, click Preview, verify data matches. Change date range, verify preview updates. Export from preview screen, verify file matches preview.

### Tests for User Story 3
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**
- [ ] T023 [P] [US3] Unit test for preview API (returns structured JSON matching export data, respects date range and status filter params) in `tests/unit/report-preview-api.test.ts`
- [ ] T024 [P] [US3] E2E test for preview flow: configure params, click Preview, verify on-screen data matches; change params, verify preview updates; export from preview in `tests/e2e/donor-report-preview.spec.ts`

### API Routes for User Story 3

- [ ] T025 [US3] Implement `GET /api/donor-projects/[id]/report/preview?dateFrom=X&dateTo=Y&statusFilter=Z` returning structured JSON (same data as export, without generating a file) in `src/app/api/donor-projects/[id]/report/preview/route.ts`

### UI Components for User Story 3

- [ ] T026 [US3] Create report preview component combining ReportSummary, BudgetBreakdownTable, and ReceiptListTable in a scrollable on-screen layout with export button in `src/components/reports/ReportPreview.tsx`
- [ ] T027 [US3] Integrate preview into report generation page: config form → preview → export flow, with preview auto-updating on parameter change in `src/app/(dashboard)/donors/[id]/report/page.tsx` (extend T019)

**Checkpoint**: User Story 3 complete — preview before export works

---

## Phase 5: User Story 4 — Report History and Re-generation (Priority: P3)

**Goal**: Admin can view history of generated reports per donor project, download previous reports, or re-generate with current data

**Independent Test**: Generate multiple reports, verify history lists them chronologically. Download a previous report, verify it's the original file. Re-generate, verify new report uses current data.

### Tests for User Story 4
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**
- [ ] T028 [P] [US4] Unit test for history API (returns reports in reverse chronological order), download API (serves correct file with Content-Disposition), and regenerate API (creates new report with same params but current data) in `tests/unit/report-history-api.test.ts`
- [ ] T029 [P] [US4] E2E test for history flow: generate multiple reports, open history, verify list order; download previous report; re-generate and verify new entry appears in `tests/e2e/donor-report-history.spec.ts`

### API Routes for User Story 4

- [ ] T030 [P] [US4] Implement `GET /api/donor-projects/[id]/report/history` returning list of DonorReport entries (most recent first) in `src/app/api/donor-projects/[id]/report/history/route.ts`
- [ ] T031 [P] [US4] Implement `GET /api/donor-projects/[id]/report/history/[reportId]/download` serving stored file with correct Content-Type and Content-Disposition headers in `src/app/api/donor-projects/[id]/report/history/[reportId]/download/route.ts`
- [ ] T032 [P] [US4] Implement `POST /api/donor-projects/[id]/report/history/[reportId]/regenerate` (copies params from original, generates new report with current data) in `src/app/api/donor-projects/[id]/report/history/[reportId]/regenerate/route.ts`

### UI Components for User Story 4

- [ ] T033 [US4] Create report history component showing list of generated reports with date, period, params, and download/re-generate buttons in `src/components/reports/ReportHistory.tsx`
- [ ] T034 [US4] Add report history section to the report page in `src/app/(dashboard)/donors/[id]/report/page.tsx` (extend T019/T027)

**Checkpoint**: User Story 4 complete — full report lifecycle supported

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Navigation, notifications, responsive design, audit trail verification

- [ ] T035 [P] Add "Generate Report" button/link to donor project detail page (from Feature 1) navigating to the report generation page
- [ ] T036 [P] Ensure report generation and export trigger toast notifications on success/error per constitution principle VI
- [ ] T037 [P] Verify responsive design on mobile viewport for report config form, preview, and history per constitution principle VIII
- [ ] T038 [P] Verify audit trail entries are created for all report actions: generate (POST report), download (GET download), and re-generate (POST regenerate) — confirm each AuditEntry includes actor, timestamp, donor project, and parameters used per FR-015 / SC-006 in `tests/unit/report-audit-trail.test.ts`
- [ ] T039 Run quickstart.md validation: walk through report generation (config → preview → export as PDF and Excel), history, and re-generation workflows

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately (assumes Features 1 + 2 complete)
- **US1 (Phase 2)**: Depends on Phase 1 — core report generation
- **US2 (Phase 3)**: Depends on Phase 2 — extends report API with validation
- **US3 (Phase 4)**: Depends on Phase 2 — adds preview before export
- **US4 (Phase 5)**: Depends on Phase 2 — adds history and re-generation
- **Polish (Phase 6)**: Depends on all prior phases

### User Story Dependencies

- **US1 (Generate Report)** — P1: Can start after Phase 1. Core value.
- **US2 (Configure Parameters)** — P1: Extends US1. Sequential.
- **US3 (Preview)** — P2: Depends on US1 report data. Can parallel with US2.
- **US4 (History)** — P3: Depends on US1 (needs generated reports). Can parallel with US3.

### Parallel Opportunities

Within Phase 1: T004, T005, T006, T007, T008 all in parallel (after T001-T003).
Within Phase 2: T014, T015-T018 in parallel (API routes + components). Tests T009-T013 run first.
US3 and US4 can run in parallel after US1.

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: US1 — Report generation + export
3. Complete Phase 3: US2 — Parameter validation
4. **STOP and VALIDATE**: Reports generate correctly with configurable params

### Full Delivery

5. Complete Phase 4: US3 — Preview
6. Complete Phase 5: US4 — History + re-generation
7. Complete Phase 6: Polish

---

## Summary

| Category | Count |
|----------|-------|
| Total tasks | 39 |
| Setup tasks (Phase 1) | 8 |
| Test tasks | 11 |
| API route tasks | 6 |
| UI component tasks | 8 |
| Page tasks | 3 |
| Polish tasks | 5 |
