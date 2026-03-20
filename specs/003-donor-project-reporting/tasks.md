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

### API Routes for User Story 1

- [ ] T009 [P] [US1] Implement `POST /api/donor-projects/[id]/report` (GVI_FINANCE_ADMIN only, validates params, calls report-generator + report-pdf/excel, stores file in `uploads/reports/`, creates DonorReport + AuditEntry) in `src/app/api/donor-projects/[id]/report/route.ts`
- [ ] T010 [P] [US1] Implement `GET /api/donor-projects/[id]/report/export/[reportId]` serving the stored report file with correct Content-Type and Content-Disposition headers in `src/app/api/donor-projects/[id]/report/export/route.ts`

### UI Components for User Story 1

- [ ] T011 [P] [US1] Create report configuration form component with date range picker, status filter (approved only / all), language selector, format selector (PDF/Excel), and include-images toggle. Disable generation button with "No data available" message when donor project has no tagged budget items or receipts in `src/components/reports/ReportConfigForm.tsx`
- [ ] T012 [P] [US1] Create report summary component showing financial totals with per-currency subtotals in `src/components/reports/ReportSummary.tsx`
- [ ] T013 [P] [US1] Create budget breakdown table component showing tagged items with planned, actual, variance per item in `src/components/reports/BudgetBreakdownTable.tsx`
- [ ] T014 [P] [US1] Create receipt list table component showing individual receipts with date, amount, description, budget item, status in `src/components/reports/ReceiptListTable.tsx`

### Pages for User Story 1

- [ ] T015 [US1] Create report generation page combining config form and export trigger for a donor project in `src/app/(dashboard)/donors/[id]/report/page.tsx`

**Checkpoint**: User Story 1 complete — reports can be generated and exported

---

## Phase 3: User Story 2 — Configure Report Parameters (Priority: P1)

**Goal**: Admin configures reporting period and status filter before generation. Report header reflects parameters.

**Independent Test**: Generate reports with different date ranges and status filters, verify only matching receipts appear. Verify report header shows period and filter used.

- [ ] T016 [US2] Add parameter validation in report generation API (dateFrom < dateTo, valid language/format/statusFilter) and include parameters in report header content in `src/app/api/donor-projects/[id]/report/route.ts` (extend T009) and `src/lib/report-pdf.ts` / `src/lib/report-excel.ts`

**Note**: Most of US2 is covered by T009 (API validates and passes params) and T011 (config form). T016 ensures validation edge cases and header display are complete.

**Checkpoint**: User Story 2 complete — parameters fully validated and reflected in exports

---

## Phase 4: User Story 3 — Report Preview (Priority: P2)

**Goal**: Admin sees an on-screen preview of the report before exporting. Preview matches export content and updates when parameters change.

**Independent Test**: Configure parameters, click Preview, verify data matches. Change date range, verify preview updates. Export from preview screen, verify file matches preview.

### API Routes for User Story 3

- [ ] T017 [US3] Implement `GET /api/donor-projects/[id]/report/preview?dateFrom=X&dateTo=Y&statusFilter=Z` returning structured JSON (same data as export, without generating a file) in `src/app/api/donor-projects/[id]/report/preview/route.ts`

### UI Components for User Story 3

- [ ] T018 [US3] Create report preview component combining ReportSummary, BudgetBreakdownTable, and ReceiptListTable in a scrollable on-screen layout with export button in `src/components/reports/ReportPreview.tsx`
- [ ] T019 [US3] Integrate preview into report generation page: config form → preview → export flow, with preview auto-updating on parameter change in `src/app/(dashboard)/donors/[id]/report/page.tsx` (extend T015)

**Checkpoint**: User Story 3 complete — preview before export works

---

## Phase 5: User Story 4 — Report History and Re-generation (Priority: P3)

**Goal**: Admin can view history of generated reports per donor project, download previous reports, or re-generate with current data

**Independent Test**: Generate multiple reports, verify history lists them chronologically. Download a previous report, verify it's the original file. Re-generate, verify new report uses current data.

### API Routes for User Story 4

- [ ] T020 [P] [US4] Implement `GET /api/donor-projects/[id]/report/history` returning list of DonorReport entries (most recent first) in `src/app/api/donor-projects/[id]/report/history/route.ts`
- [ ] T021 [P] [US4] Implement `GET /api/donor-projects/[id]/report/history/[reportId]/download` serving stored file in `src/app/api/donor-projects/[id]/report/history/[reportId]/download/route.ts`
- [ ] T022 [P] [US4] Implement `POST /api/donor-projects/[id]/report/history/[reportId]/regenerate` (copies params from original, generates new report with current data) in `src/app/api/donor-projects/[id]/report/history/[reportId]/regenerate/route.ts`

### UI Components for User Story 4

- [ ] T023 [US4] Create report history component showing list of generated reports with date, period, params, and download/re-generate buttons in `src/components/reports/ReportHistory.tsx`
- [ ] T024 [US4] Add report history section to the report page in `src/app/(dashboard)/donors/[id]/report/page.tsx` (extend T015/T019)

**Checkpoint**: User Story 4 complete — full report lifecycle supported

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Navigation, notifications, responsive design

- [ ] T025 [P] Add "Generate Report" button/link to donor project detail page (from Feature 1) navigating to the report generation page
- [ ] T026 [P] Ensure report generation and export trigger toast notifications on success/error per constitution principle VI
- [ ] T027 [P] Verify responsive design on mobile viewport for report config form, preview, and history per constitution principle VIII
- [ ] T028 Run quickstart.md validation: walk through report generation (config → preview → export as PDF and Excel), history, and re-generation workflows

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
Within Phase 2: T009, T010, T011-T014 in parallel (API routes + components).
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
