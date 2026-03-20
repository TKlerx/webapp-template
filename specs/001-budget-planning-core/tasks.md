# Tasks: Budget Planning & Core Data Model

**Input**: Design documents from `/specs/001-budget-planning-core/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization — extend Prisma schema, add new roles, create shared infrastructure

- [X] T001 Update Prisma schema with new enums (Role: GVI_FINANCE_ADMIN, COUNTRY_ADMIN, COUNTRY_FINANCE; ProposalType; ProposalStatus; AuditAction) and all new models (ProgramCountry, UserCountryAssignment, BudgetYear, CountryBudget, BudgetItem, Receipt, InstitutionalDonor, DonorProject, DonorProjectTag, BudgetProposal, AuditEntry, BudgetTemplate, BudgetTemplateItem) per data-model.md in `prisma/schema.prisma`
- [X] T002 Create and run Prisma migration for the new schema, then update seed script to map existing ADMIN user to GVI_FINANCE_ADMIN in `prisma/seed.ts`
- [X] T002a Add role migration logic to seed script: migrate existing users from old roles (ADMIN → GVI_FINANCE_ADMIN, MARKETER_LEAD → COUNTRY_ADMIN, MARKETER → COUNTRY_FINANCE, REVIEWER → COUNTRY_FINANCE) and handle any users with the deprecated REVIEWER role in `prisma/seed.ts`
- [X] T003 [P] Create file storage service with `saveFile(buffer, originalName)` and `getFilePath(storedPath)` in `src/lib/file-storage.ts`. Files saved as `uploads/{year}/{month}/{uuid}.{ext}`. Add `uploads/` to `.gitignore`
- [X] T004 [P] Create audit trail logging service with `logAudit({ action, entityType, entityId, actorId, details, countryId })` in `src/lib/audit.ts`
- [X] T005 [P] Create budget validation utility with `validateChildSum(parentId)` that checks child planned amounts ≤ parent amount, and `hasReceipts(budgetItemId)` that recursively checks for assigned receipts in `src/lib/budget-validation.ts`
- [X] T006 [P] Add i18n translation keys for budget, receipt, donor, audit, role, and proposal UI text across all 5 locales (en, de, es, fr, pt) in `src/i18n/messages/{locale}.json`

**Checkpoint**: Schema migrated, shared services ready. User story implementation can begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend RBAC with country-scoped access — MUST be complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Extend RBAC module with new roles (GVI_FINANCE_ADMIN, COUNTRY_ADMIN, COUNTRY_FINANCE), country-scoped access check `requireCountryAccess(user, countryId)`, and helper `getUserCountryIds(userId)` in `src/lib/rbac.ts`
- [X] T008 Create route-level auth middleware helper that combines role check + country scope check for API routes, usable as `await authorizeRoute(request, { roles, countryScoped })` in `src/lib/route-auth.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — GVI Finance Admin Creates Budget Year and Country Budgets (Priority: P1) 🎯 MVP

**Goal**: Admin can create budget years, add countries with budgets, and build hierarchical budget items with unlimited nesting depth

**Independent Test**: Create a budget year, add countries with total budgets, build a multi-level budget item hierarchy, verify tree view displays correctly with amounts

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T009a [P] [US1] Unit test for budget year and country budget CRUD APIs in `tests/unit/budget-years-api.test.ts` — test create budget year, add country with total budget and currency, validate response shapes match api.md contracts
- [ ] T009b [P] [US1] Unit test for budget item hierarchy APIs in `tests/unit/budget-items-api.test.ts` — test create root item, create nested child items (3+ levels), verify child sum ≤ parent validation blocks over-budget, verify deletion blocked when receipts exist
- [ ] T009c [P] [US1] E2E test for budget hierarchy creation workflow in `tests/e2e/budget-hierarchy.spec.ts` — as GVI_FINANCE_ADMIN: create budget year, add country "Kenya" with €50,000, create "Personnel" (€30,000) with child "Salaries" (€20,000), verify tree view displays all levels with correct amounts

### API Routes for User Story 1

- [ ] T009 [P] [US1] Implement `GET /api/budget-years` and `POST /api/budget-years` API routes in `src/app/api/budget-years/route.ts`
- [ ] T010 [P] [US1] Implement `GET /api/budget-years/[id]`, `PATCH /api/budget-years/[id]`, `DELETE /api/budget-years/[id]` API routes in `src/app/api/budget-years/[id]/route.ts`
- [ ] T011 [P] [US1] Implement `GET /api/countries` and `POST /api/countries` API routes in `src/app/api/countries/route.ts`
- [ ] T012 [P] [US1] Implement `GET /api/country-budgets`, `POST /api/country-budgets` API routes (with country-scope check) in `src/app/api/country-budgets/route.ts`
- [ ] T013 [P] [US1] Implement `GET /api/country-budgets/[id]`, `PATCH /api/country-budgets/[id]` API routes in `src/app/api/country-budgets/[id]/route.ts`
- [ ] T014 [P] [US1] Implement `GET /api/budget-items?countryBudgetId=X` and `POST /api/budget-items` API routes with child sum ≤ parent validation in `src/app/api/budget-items/route.ts`
- [ ] T015 [P] [US1] Implement `PATCH /api/budget-items/[id]`, `DELETE /api/budget-items/[id]` (with receipt check), and `GET /api/budget-items/[id]/overview` API routes in `src/app/api/budget-items/[id]/route.ts`

### UI Pages for User Story 1

- [ ] T016 [US1] Create budget year list page with create form in `src/app/(dashboard)/budget-years/page.tsx`
- [ ] T017 [US1] Create budget year detail page showing country budgets with add country budget form in `src/app/(dashboard)/budget-years/[id]/page.tsx`
- [ ] T018 [US1] Create collapsible budget item tree component (`BudgetItemTree.tsx`) and add/edit item form component (`BudgetItemForm.tsx`) in `src/components/budget/`
- [ ] T019 [US1] Create country budget detail page with budget item tree view and add item UI in `src/app/(dashboard)/budgets/[countryBudgetId]/page.tsx`

**Checkpoint**: User Story 1 complete — admin can create full budget hierarchies

---

## Phase 4: User Story 2 — Roles and Country Assignment (Priority: P1)

**Goal**: GVI Finance Admin manages users with domain-specific roles and country assignments. Country-scoped users only see their assigned countries' data.

**Independent Test**: Create users with different roles, assign to countries, verify country-scoped access isolation

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T020a [P] [US2] Unit test for country assignment and role-scoped access in `tests/unit/country-assignment-api.test.ts` — test assigning Country Finance role with country, verify user can only access assigned country's data, verify GVI_FINANCE_ADMIN sees all countries
- [ ] T020b [P] [US2] E2E test for role-based country access isolation in `tests/e2e/country-access.spec.ts` — create two users (Country Finance for Kenya, Country Admin for Ghana), verify each can only see their country's budget data, verify denied access to other country's data

### API Routes for User Story 2

- [ ] T020 [P] [US2] Implement `GET /api/users/[id]/countries` and `PUT /api/users/[id]/countries` API routes for country assignment in `src/app/api/users/[id]/countries/route.ts`
- [ ] T021 [US2] Update existing user management UI to use new roles (GVI_FINANCE_ADMIN, COUNTRY_ADMIN, COUNTRY_FINANCE) and add country assignment interface in `src/app/(dashboard)/users/` (extend existing pages)

### UI Updates for User Story 2

- [ ] T022 [US2] Update dashboard navigation and page access to filter by user's assigned countries — country-scoped users see only their countries in budget year views, country budget lists, etc. in `src/app/(dashboard)/layout.tsx` and relevant pages

**Checkpoint**: User Story 2 complete — role-based country access enforced

---

## Phase 5: User Story 3 — Receipt Upload and Budget Item Assignment (Priority: P1)

**Goal**: Country Finance users can upload receipt files (PDF/JPEG/PNG) with metadata and assign them to budget items. Files are stored immutably.

**Independent Test**: Upload a receipt, assign to a budget item, verify file is stored, metadata is correct, receipt appears under the budget item, and rolled-up totals are correct

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T023a [P] [US3] Unit test for receipt upload and metadata APIs in `tests/unit/receipts-api.test.ts` — test upload with PDF/JPEG/PNG, verify file size ≤ 20MB validation, verify metadata (amount, date, description, budgetItemId) saved correctly, verify receipt appears under assigned budget item
- [ ] T023b [P] [US3] Unit test for receipt immutability enforcement in `tests/unit/receipt-immutability.test.ts` — verify DELETE /api/receipts/[id]/file returns 403/405, verify PATCH /api/receipts/[id] cannot change file reference, verify file-storage service rejects overwrite of existing stored file
- [ ] T023c [P] [US3] E2E test for receipt upload and assignment workflow in `tests/e2e/receipt-upload.spec.ts` — as Country Finance user for Kenya: upload a receipt PDF, assign to budget item "Fuel", fill amount/date/description, verify receipt appears in budget item view with correct metadata and rolled-up totals

### API Routes for User Story 3

- [ ] T023 [P] [US3] Implement `GET /api/receipts` (with filters: budgetItemId, countryId, dateFrom, dateTo) and `POST /api/receipts` (multipart upload with file validation: type, size ≤ 20MB) in `src/app/api/receipts/route.ts`
- [ ] T024 [P] [US3] Implement `GET /api/receipts/[id]`, `PATCH /api/receipts/[id]` (metadata only, with audit trail for each change) in `src/app/api/receipts/[id]/route.ts`
- [ ] T025 [P] [US3] Implement `GET /api/receipts/[id]/file` to serve stored files with correct Content-Type and Content-Disposition headers in `src/app/api/receipts/[id]/file/route.ts`

### Receipt Immutability Enforcement

- [ ] T025a [US3] Enforce receipt file immutability at the API level in `src/app/api/receipts/[id]/file/route.ts` and `src/lib/file-storage.ts` — reject DELETE and PUT/PATCH requests to file endpoint with 405, ensure file-storage service prevents overwriting or deleting existing files, verify PATCH /api/receipts/[id] cannot modify the filePath field (FR-009)

### UI Pages for User Story 3

- [ ] T026 [US3] Create receipt upload form component with file picker (accept PDF/JPEG/PNG), amount, currency, date, description fields, and budget item selector (tree-based) in `src/components/receipts/ReceiptUploadForm.tsx`
- [ ] T027 [US3] Create receipt list component with filters (country, budget item, date range) and receipt table in `src/components/receipts/ReceiptList.tsx`
- [ ] T028 [US3] Create receipt list page and receipt upload page in `src/app/(dashboard)/receipts/page.tsx` and `src/app/(dashboard)/receipts/upload/page.tsx`
- [ ] T029 [US3] Create receipt detail page showing file viewer (inline PDF/image), metadata, and edit form for metadata in `src/app/(dashboard)/receipts/[id]/page.tsx`

**Checkpoint**: User Story 3 complete — receipts can be uploaded and assigned to budget items

---

## Phase 6: User Story 4 — Donor Project Tagging (Priority: P2)

**Goal**: GVI Finance Admin creates institutional donors and donor projects, then tags budget items or individual receipts to donor projects. Tagged budget items implicitly include all descendant receipts.

**Independent Test**: Create donor + project, tag a budget item, upload receipt under that item, verify it appears in the donor project scope. Tag an individual receipt directly, verify it also appears.

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T030a [P] [US4] Unit test for donor project CRUD and tagging APIs in `tests/unit/donor-projects-api.test.ts` — test create donor and project, tag a budget item to project, tag individual receipt to project, verify tagged items retrievable by project, verify implicit inclusion of descendant receipts when budget item is tagged
- [ ] T030b [P] [US4] E2E test for donor project tagging workflow in `tests/e2e/donor-tagging.spec.ts` — as GVI_FINANCE_ADMIN: create donor "EU", create project "EU Grant 2026", tag budget item "Personnel", upload receipt under "Personnel > Salaries", verify receipt appears in donor project scope automatically

### API Routes for User Story 4

- [ ] T030 [P] [US4] Implement `GET /api/donors` and `POST /api/donors` API routes in `src/app/api/donors/route.ts`
- [ ] T031 [P] [US4] Implement `GET /api/donor-projects`, `POST /api/donor-projects` API routes in `src/app/api/donor-projects/route.ts`
- [ ] T032 [P] [US4] Implement `GET /api/donor-projects/[id]` (with tags summary, total planned/actual/receipt count via recursive query), `POST /api/donor-projects/[id]/tags`, and `DELETE /api/donor-projects/[id]/tags/[tagId]` in `src/app/api/donor-projects/[id]/route.ts` and `src/app/api/donor-projects/[id]/tags/route.ts`

### UI Pages for User Story 4

- [ ] T033 [US4] Create donor list page with create form, and donor detail page showing donor projects in `src/app/(dashboard)/donors/page.tsx` and `src/app/(dashboard)/donors/[id]/page.tsx`
- [ ] T034 [US4] Create donor project detail page showing tagged budget items and receipts with add tag UI (budget item selector + receipt selector) in `src/app/(dashboard)/donors/[id]/projects/[projectId]/page.tsx`

**Checkpoint**: User Story 4 complete — donor projects can be created and items tagged

---

## Phase 7: User Story 5 — Budget Overview and Compliance View (Priority: P2)

**Goal**: GVI Finance Admin sees planned vs. actual spend per budget item with visual over-budget indicators and drill-down capability

**Independent Test**: Create budget with items, upload receipts, verify overview shows correct planned vs. actual amounts, over-budget items are highlighted, drill-down shows receipts

### Tests for User Story 5

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T035a [P] [US5] Unit test for budget overview rolled-up calculations in `tests/unit/budget-overview-api.test.ts` — test GET /api/budget-items/[id]/overview returns correct actualSpend as recursive sum of receipts, verify parent item aggregates children's receipts, verify over-budget detection when actual > planned
- [ ] T035b [P] [US5] E2E test for budget overview and drill-down in `tests/e2e/budget-overview.spec.ts` — create budget with items and receipts, open overview page, verify planned vs actual displayed correctly, verify over-budget item is visually highlighted, click item to drill down and verify child items and receipts are shown

### Implementation for User Story 5

- [ ] T035 [US5] Create budget overview component showing hierarchy with planned amount, actual spend (rolled-up via recursive sum), and over-budget highlighting in `src/components/budget/BudgetOverview.tsx`
- [ ] T036 [US5] Create budget overview page with country/year selector and drill-down navigation (click item → see children + receipts) in `src/app/(dashboard)/budget-overview/page.tsx`

- [ ] T037 [P] [US5] Add i18n translation keys for budget overview labels (planned, actual, over-budget, under-budget, variance) across all 5 locales in `src/i18n/messages/{locale}.json`
- [ ] T038 [US5] Integrate budget overview link into sidebar navigation and dashboard summary cards in `src/components/ui/Sidebar.tsx` and `src/app/(dashboard)/page.tsx`
- [ ] T039 [US5] Add country/year selector component for filtering budget overview in `src/components/budget/BudgetOverviewFilters.tsx`

**Checkpoint**: User Story 5 complete — budget compliance view functional

---

## Phase 8: User Story 6 — Budget Templates (Priority: P2)

**Goal**: GVI Finance Admin can create, manage, and apply reusable budget templates with default hierarchies and amounts. Can also save an existing country budget as a template.

**Independent Test**: Create a template with a multi-level hierarchy and amounts. Create a new country budget, apply the template, verify items are pre-populated. Save an existing country budget as a template, verify it captures the hierarchy.

### Tests for User Story 6

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T040a [P] [US6] Unit test for budget template CRUD and apply-template APIs in `tests/unit/budget-templates-api.test.ts` — test create template with nested hierarchy, verify items stored with parentId references, test apply-template copies items to country budget with correct amounts, test from-budget creates template from existing country budget
- [ ] T040b [P] [US6] E2E test for template creation and application workflow in `tests/e2e/budget-templates.spec.ts` — as GVI_FINANCE_ADMIN: create template "Standard Country Budget" with multi-level hierarchy, create new country budget for Kenya 2027, apply template, verify all items pre-populated with correct hierarchy and amounts, verify modifying Kenya's items does not affect template

### API Routes for User Story 6

- [ ] T040 [P] [US6] Implement `GET /api/budget-templates` and `POST /api/budget-templates` (GVI_FINANCE_ADMIN only, accepts nested item tree, stores flattened with parentId) in `src/app/api/budget-templates/route.ts`
- [ ] T041 [P] [US6] Implement `GET /api/budget-templates/[id]`, `PATCH /api/budget-templates/[id]` (replaces entire hierarchy), and `DELETE /api/budget-templates/[id]` in `src/app/api/budget-templates/[id]/route.ts`
- [ ] T042 [P] [US6] Implement `POST /api/budget-templates/from-budget` (creates template from existing country budget by copying hierarchy + amounts) in `src/app/api/budget-templates/from-budget/route.ts`
- [ ] T043 [US6] Implement `POST /api/country-budgets/[id]/apply-template` (copies template items to country budget as new BudgetItem records with defaultAmount as plannedAmount, validates budget has no existing items or confirms overwrite) in `src/app/api/country-budgets/[id]/apply-template/route.ts`

### UI Components for User Story 6

- [ ] T044 [P] [US6] Create template list page with create/edit/delete actions in `src/app/(dashboard)/budget-templates/page.tsx`
- [ ] T045 [P] [US6] Create template editor component for building/editing a template hierarchy with item names, default amounts, and drag/reorder in `src/components/budget/TemplateEditor.tsx`
- [ ] T046 [US6] Create template selector component shown when creating a new country budget — allows choosing a template or starting empty in `src/components/budget/TemplateSelector.tsx`
- [ ] T047 [US6] Add "Save as Template" button to country budget detail page that triggers template creation from current budget in `src/app/(dashboard)/budgets/[countryBudgetId]/page.tsx` (extend T019)

**Checkpoint**: User Story 6 complete — budget templates fully functional

---

## Phase 9: User Story Supplement — Budget Proposals (from FR-005a, part of US2)

**Goal**: Country Admins can propose budget item changes (add/edit/remove); GVI Finance Admins approve or reject proposals

**Independent Test**: As Country Admin, create a proposal to add a budget item. As GVI Finance Admin, approve it and verify the budget item is created.

### Tests for Budget Proposals

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T048a [P] [US2] Unit test for budget proposal APIs in `tests/unit/budget-proposals-api.test.ts` — test COUNTRY_ADMIN can create ADD/EDIT/REMOVE proposals, test GVI_FINANCE_ADMIN can approve/reject, verify approved ADD proposal creates budget item, verify approved EDIT proposal updates budget item, verify approved REMOVE proposal deletes budget item, verify audit trail entries recorded
- [ ] T048b [P] [US2] E2E test for proposal workflow in `tests/e2e/budget-proposals.spec.ts` — as Country Admin: create proposal to add budget item "Office Supplies" under "Operations", as GVI_FINANCE_ADMIN: view pending proposals, approve it, verify budget item is created in country budget

### API Routes

- [ ] T048 [P] [US2] Implement `GET /api/budget-proposals?countryBudgetId=X&status=Y` and `POST /api/budget-proposals` (COUNTRY_ADMIN only) in `src/app/api/budget-proposals/route.ts`
- [ ] T049 [P] [US2] Implement `PATCH /api/budget-proposals/[id]` (GVI_FINANCE_ADMIN: approve/reject, apply changes on approval) in `src/app/api/budget-proposals/[id]/route.ts`

### UI Pages

- [ ] T050 [US2] Create proposals list page (Country Admin sees own country's proposals, GVI Finance Admin sees all pending) and proposal review UI in `src/app/(dashboard)/proposals/page.tsx`

**Checkpoint**: Budget proposal workflow complete

---

## Phase 10: Audit Trail (cross-cutting, FR-017)

**Goal**: All mutations are logged. GVI Finance Admin can query the audit trail with filters.

- [ ] T051 Implement `GET /api/audit?action=X&entityType=Y&countryId=Z&dateFrom=A&dateTo=B&actorId=C` API route with pagination in `src/app/api/audit/route.ts`
- [ ] T052 Ensure all API route handlers call `logAudit()` after successful mutations — specifically verify and add missing calls in: `src/app/api/budget-years/route.ts` (POST), `src/app/api/budget-years/[id]/route.ts` (PATCH, DELETE), `src/app/api/countries/route.ts` (POST), `src/app/api/country-budgets/route.ts` (POST), `src/app/api/country-budgets/[id]/route.ts` (PATCH), `src/app/api/budget-items/route.ts` (POST), `src/app/api/budget-items/[id]/route.ts` (PATCH, DELETE), `src/app/api/receipts/route.ts` (POST), `src/app/api/receipts/[id]/route.ts` (PATCH), `src/app/api/donors/route.ts` (POST), `src/app/api/donor-projects/route.ts` (POST), `src/app/api/donor-projects/[id]/tags/route.ts` (POST, DELETE), `src/app/api/budget-templates/route.ts` (POST), `src/app/api/budget-templates/[id]/route.ts` (PATCH, DELETE), `src/app/api/budget-templates/from-budget/route.ts` (POST), `src/app/api/country-budgets/[id]/apply-template/route.ts` (POST), `src/app/api/budget-proposals/route.ts` (POST), `src/app/api/budget-proposals/[id]/route.ts` (PATCH), `src/app/api/users/[id]/countries/route.ts` (PUT)
- [ ] T053 Create audit trail viewer page with filters (action type, entity, country, date range, actor) in `src/app/(dashboard)/audit/page.tsx`

**Checkpoint**: Audit trail complete — all actions logged and queryable

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T054 [P] Add dashboard home page with summary cards (countries, budget years, recent receipts, pending proposals) in `src/app/(dashboard)/page.tsx`
- [ ] T055 [P] Update sidebar navigation to include all new sections (Budget Years, Budgets, Receipts, Donors, Templates, Proposals, Audit, Budget Overview) with role-based visibility in `src/components/ui/Sidebar.tsx` or equivalent nav component
- [ ] T056 [P] Ensure all forms show toast notifications on success/error per constitution principle VI in all new pages
- [ ] T057 [P] Verify responsive design on mobile viewport for all new pages — collapsible tree, receipt upload form, template editor, tables — per constitution principle VIII
- [ ] T058 Run quickstart.md validation: manually walk through all 6 workflows (budget setup with template, roles, receipt upload, donor tagging, budget overview, proposals) to confirm end-to-end functionality

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (schema + services must exist)
- **US1 (Phase 3)**: Depends on Phase 2 — budget hierarchy CRUD
- **US2 (Phase 4)**: Depends on Phase 2 — role + country assignment
- **US3 (Phase 5)**: Depends on Phase 2 + Phase 3 (needs budget items to assign receipts to)
- **US4 (Phase 6)**: Depends on Phase 2 + Phase 3 (needs budget items to tag) + Phase 5 (needs receipts to tag)
- **US5 (Phase 7)**: Depends on Phase 3 + Phase 5 (needs budget items + receipts for overview)
- **US6 Templates (Phase 8)**: Depends on Phase 3 (needs budget item CRUD to copy into)
- **Proposals (Phase 9)**: Depends on Phase 3 + Phase 4 (needs budget items + role system)
- **Audit (Phase 10)**: Depends on all prior phases (reviews all handlers)
- **Polish (Phase 11)**: Depends on all prior phases

### User Story Dependencies

- **US1 (Budget Hierarchy)** — P1: Can start after Phase 2. No dependencies on other stories.
- **US6 (Budget Templates)** — P2: Depends on US1 (needs budget item CRUD). Can parallel with US4/US5.
- **US2 (Roles & Country Assignment)** — P1: Can start after Phase 2. Independent of US1.
- **US3 (Receipt Upload)** — P1: Depends on US1 (needs budget items for assignment).
- **US4 (Donor Tagging)** — P2: Depends on US1 + US3 (needs budget items and receipts).
- **US5 (Budget Overview)** — P2: Depends on US1 + US3 (needs items and receipts for aggregation).

### Parallel Opportunities

Within Phase 1: T003, T004, T005, T006 can all run in parallel (after T001+T002).
Within Phase 3: T009–T015 (API routes) can all run in parallel.
US1 and US2 can run in parallel after Phase 2.

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 + 3)

1. Complete Phase 1: Setup (schema, services)
2. Complete Phase 2: Foundational (RBAC with country scope)
3. Complete Phase 3: US1 — Budget hierarchy
4. Complete Phase 4: US2 — Roles and country assignment
5. Complete Phase 5: US3 — Receipt upload
6. **STOP and VALIDATE**: The three P1 stories deliver the core value — budget planning, roles, and receipt submission

### Full Delivery

7. Complete Phase 6: US4 — Donor project tagging
8. Complete Phase 7: US5 — Budget overview
9. Complete Phase 8: US6 — Budget templates
10. Complete Phase 9: Budget proposals
11. Complete Phase 10: Audit trail viewer
12. Complete Phase 11: Polish

---

## Summary

| Category | Count |
|---|---|
| Setup tasks (Phase 1) | 7 (T001–T006, T002a) |
| Foundational tasks (Phase 2) | 2 (T007–T008) |
| Test tasks | 16 (T009a–T009c, T020a–T020b, T023a–T023c, T030a–T030b, T035a–T035b, T040a–T040b, T048a–T048b) |
| Implementation tasks (Phases 3–9) | 43 (T009–T050, T025a, T037–T039) |
| Audit tasks (Phase 10) | 3 (T051–T053) |
| Polish tasks (Phase 11) | 5 (T054–T058) |
| **Total tasks** | **76** |
