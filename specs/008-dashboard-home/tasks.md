# Tasks: Dashboard & Home Screen

**Input**: Design documents from `specs/008-dashboard-home/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.md, research.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

---

## Phase 1: Setup

**Purpose**: i18n keys and project structure for dashboard and notification components

- [ ] T001 Add i18n translation keys for dashboard across all 5 locales (en, de, es, fr, pt) in `src/i18n/messages/` — keys under `dashboard.*` namespace for section titles (actionRequired, budgetAlerts, recentActivity, myTasks, myRecentReceipts, budgetSummary, myProposals, countryActivity), quick action labels, empty state messages, onboarding text, widget headings, status labels (pending, approved, flagged, rejected), percentages/currency formatting hints
- [ ] T002 [P] Add i18n translation keys for notifications across all 5 locales in `src/i18n/messages/` — keys under `notifications.*` namespace for bell tooltip, dropdown heading, "View All" link, "Mark as read", "No notifications", unread count badge aria-label, notification type labels, relative timestamps

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Dashboard API route, shared components, and DashboardSection wrapper — MUST complete before user stories

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Create `GET /api/dashboard` route at `src/app/api/dashboard/route.ts` — authenticate session, determine user role, branch to role-specific aggregation: for `GVI_FINANCE_ADMIN` query Receipt count (PENDING_REVIEW), BudgetProposal count (PENDING), Receipt count (FLAGGED), over-budget BudgetItems (actual > planned) across all countries, last 10 AuditEntry records; for `COUNTRY_FINANCE` query flagged receipts count and incomplete email receipts count scoped to user's countries, user's last 10 receipts, top-level BudgetItem summaries for user's countries; for `COUNTRY_ADMIN` query user's BudgetProposals with status, over-budget items for user's countries, last 10 AuditEntry records for user's countries; use `Promise.all` for parallel queries within each role branch; return `{ data: AdminDashboardData | CountryFinanceDashboardData | CountryAdminDashboardData }` per contracts/api.md
- [ ] T004 [P] Create `src/components/dashboard/EmptyState.tsx` — server component, accepts `messageKey` (i18n key) and optional `actionHref`/`actionLabel` props, renders welcoming illustration placeholder, translated guidance text, and optional CTA button linking to the relevant page (e.g., "Upload your first receipt"), used by all dashboard variants when sections have no data
- [ ] T005 [P] Create `src/components/dashboard/QuickActions.tsx` — server component, accepts `actions` array of `{ labelKey: string, href: string, icon: string }`, renders a responsive row of action buttons with icons, mobile-first layout (full-width stacked on small screens, inline on desktop), respects base path in all links
- [ ] T006 [P] Create `src/components/dashboard/DashboardSection.tsx` — client component wrapping each dashboard widget with `<Suspense fallback={<SectionSkeleton />}>` and an error boundary, on error renders retry button instead of crashing entire page, accepts `title` (i18n key) and children, renders section heading with translated title

**Checkpoint**: API aggregation route and shared UI primitives ready for role-specific dashboards

---

## Phase 3: User Story 1 — GVI Finance Admin Dashboard (Priority: P1)

**Goal**: Admin sees system-wide action-required counts, budget alerts, recent activity, and quick actions

**Independent Test**: Log in as GVI Finance admin, verify all sections display correct counts and link to correct pages

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T007 [P] [US1] Unit test for admin dashboard aggregation in `tests/unit/dashboard-aggregation.test.ts` — mock Prisma queries, verify pendingReviews counts receipts with status PENDING_REVIEW, verify pendingProposals counts proposals with status PENDING, verify flaggedAwaitingResponse counts receipts with status FLAGGED, verify budgetAlerts returns items where actual > planned with correct percentOver calculation, verify recentActivity returns last 10 AuditEntry records ordered by createdAt desc filtered to relevant action types, verify admin sees data across all countries (no country filter)
- [ ] T008 [P] [US1] E2E test for admin dashboard in `tests/e2e/dashboard-admin.spec.ts` — seed database with receipts (various statuses), budget items (some over-budget), proposals (pending), audit entries; log in as GVI Finance admin; verify Action Required section shows correct counts; verify clicking a count navigates to the filtered list page; verify Budget Alerts section lists over-budget items with country, item name, planned vs actual, percent over; verify Recent Activity shows 10 entries with timestamps and actor names; verify quick action buttons visible: "Review Receipts", "Budget Overview", "Manage Users", "Audit Trail"; verify clicking quick action navigates correctly

### Implementation

- [ ] T009 [US1] Create `src/components/dashboard/ActionRequired.tsx` — server component, displays three count cards: pending reviews, pending proposals, flagged awaiting response; each count is a clickable link navigating to the relevant filtered page (e.g., `/gvi-finance/receipts?status=PENDING_REVIEW`); show zero counts dimmed; all text via i18n keys
- [ ] T010 [US1] Create `src/components/dashboard/BudgetAlerts.tsx` — server component, accepts `alerts: OverBudgetItem[]` and optional `countryScoped: boolean` prop; renders a compact table/list with country name, budget item name, planned amount, actual amount, percent over budget with warning color coding; empty state if no alerts; links each item to budget detail page
- [ ] T011 [US1] Create `src/components/dashboard/RecentActivity.tsx` — server component, accepts `entries: ActivityEntry[]`; renders chronological feed with action icon, description, actor name, relative timestamp, and country label; each entry links to the relevant entity page via `linkUrl`; empty state if no entries
- [ ] T012 [US1] Create `src/components/dashboard/AdminDashboard.tsx` — server component, fetches admin dashboard data from Prisma using `Promise.all` for parallel queries, renders DashboardSection wrappers around ActionRequired, BudgetAlerts, RecentActivity, and QuickActions (with actions: "Review Receipts", "Budget Overview", "Manage Users", "Audit Trail"); handles empty state for first-time setup (no data at all)
- [ ] T013 [US1] Integrate AdminDashboard into dashboard page at `src/app/(dashboard)/page.tsx` — read session and user role, if role is `GVI_FINANCE_ADMIN` render AdminDashboard component; set up role-based branching structure that Phase 4 and Phase 5 will extend

**Checkpoint**: Admin dashboard fully functional with all four sections, links, and quick actions

---

## Phase 4: User Story 2 — Country Finance Dashboard (Priority: P1)

**Goal**: Country Finance user sees their tasks, recent uploads, country budget summary, and upload actions

**Independent Test**: Log in as Country Finance user, verify they see only their own country's data, recent uploads, flagged receipts

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T014 [P] [US2] Unit test for country finance aggregation in `tests/unit/dashboard-aggregation.test.ts` — add test cases: verify myTasks counts only flagged receipts in user's assigned countries, verify incompleteEmailReceipts counts email-submitted receipts needing completion, verify recentUploads returns only the authenticated user's receipts (last 10), verify budgetSummary returns top-level items for user's countries with correct percentUsed calculation, verify user assigned to multiple countries sees aggregated data with country labels
- [ ] T015 [P] [US2] E2E test for country finance dashboard in `tests/e2e/dashboard-country-finance.spec.ts` — seed database with receipts (flagged, pending, approved) for user's country and other countries; log in as Country Finance user for Kenya; verify My Tasks section shows correct flagged and incomplete counts; verify clicking counts navigates to filtered receipts; verify My Recent Receipts shows last 10 uploads with date, amount, budget item, status; verify Budget Summary shows Kenya's top-level budget items with planned vs actual; verify "Upload Receipt" and "Capture Receipt" buttons visible; verify user does NOT see other countries' data

### Implementation

- [ ] T016 [US2] Create `src/components/dashboard/MyTasks.tsx` — server component, displays count cards for flagged receipts requiring correction and incomplete email-submitted receipts; each count links to filtered receipt list; shows positive "All caught up!" message when both counts are zero; all text via i18n keys
- [ ] T017 [US2] Create `src/components/dashboard/MyRecentReceipts.tsx` — server component, accepts `uploads: RecentUpload[]`; renders a list/table of last 10 receipts with date, amount (formatted with currency), budget item name, country name, and status badge (color-coded: pending=yellow, approved=green, flagged=orange, rejected=red); each row links to receipt detail; empty state if no uploads
- [ ] T018 [US2] Create `src/components/dashboard/BudgetSummary.tsx` — server component, accepts `items: BudgetSummaryItem[]`; renders progress bars for each top-level budget item showing planned vs actual spend; color coding (green under 80%, yellow 80-100%, red over 100%); shows country name per item; compact layout suitable for mobile
- [ ] T019 [US2] Create `src/components/dashboard/CountryFinanceDashboard.tsx` — server component, fetches country finance dashboard data from Prisma scoped to user's countries using `Promise.all`, renders DashboardSection wrappers around MyTasks, MyRecentReceipts, BudgetSummary, and QuickActions (with actions: "Upload Receipt", "Capture Receipt"); handles empty state for new user
- [ ] T020 [US2] Extend dashboard page at `src/app/(dashboard)/page.tsx` — add branch for `COUNTRY_FINANCE` role rendering CountryFinanceDashboard component

**Checkpoint**: Country Finance dashboard complete with tasks, uploads, budget summary, and action buttons

---

## Phase 5: User Story 3 — Country Admin Dashboard (Priority: P2)

**Goal**: Country Admin sees their proposals, country budget alerts, country activity, and admin quick actions

**Independent Test**: Log in as Country Admin, verify country-scoped data and proposal status displayed

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T021 [P] [US3] Unit test for country admin aggregation in `tests/unit/dashboard-aggregation.test.ts` — add test cases: verify proposals returns only the authenticated user's budget proposals with correct status, verify budgetAlerts returns over-budget items for user's countries only (not all countries), verify countryActivity returns last 10 AuditEntry records filtered to user's countries, verify user with multiple country assignments sees combined data
- [ ] T022 [P] [US3] E2E test for country admin dashboard in `tests/e2e/dashboard-country-admin.spec.ts` — seed database with proposals (pending, approved, rejected) for user, budget items (some over-budget) for Kenya and other countries; log in as Country Admin for Kenya; verify My Proposals section shows proposals with type, target item, status, submitted date, review comment; verify Budget Alerts shows only Kenya's over-budget items; verify Country Activity shows recent events for Kenya only; verify quick action buttons: "New Budget Proposal", "View Country Budget"; verify user does NOT see other countries' alerts or activity

### Implementation

- [ ] T023 [US3] Create `src/components/dashboard/MyProposals.tsx` — server component, accepts `proposals: ProposalSummary[]`; renders list of proposals with type badge (ADD/EDIT/REMOVE), target item name, status badge (pending/approved/rejected), submitted date, and reviewer comment (if reviewed); each links to proposal detail; empty state if no proposals
- [ ] T024 [US3] Create `src/components/dashboard/CountryAdminDashboard.tsx` — server component, fetches country admin dashboard data from Prisma scoped to user's countries using `Promise.all`, renders DashboardSection wrappers around MyProposals, BudgetAlerts (with `countryScoped: true`), RecentActivity (country-filtered, rendered as "Country Activity"), and QuickActions (with actions: "New Budget Proposal", "View Country Budget"); handles empty state for new admin
- [ ] T025 [US3] Extend dashboard page at `src/app/(dashboard)/page.tsx` — add branch for `COUNTRY_ADMIN` role rendering CountryAdminDashboard component

**Checkpoint**: All three role-based dashboards complete and independently testable

---

## Phase 6: User Story 4 — Notification Bell (Priority: P1)

> **NOTE**: The notification bell UI (NotificationBell, NotificationDropdown, nav integration) is implemented by **Feature 007** (tasks T032-T034, E2E test T027). Feature 007 owns the bell component, notification API endpoints, and polling logic. This phase has no 008-specific tasks — the bell is a cross-cutting notification feature that belongs with the notification system.
>
> 008's FR-007 through FR-010 requirements are satisfied by 007's implementation.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Empty states, mobile responsiveness, independent loading, i18n verification, quickstart validation

- [ ] T026 [P] Verify empty state for first-time users on all three dashboard variants — ensure new user with no receipts, no proposals, no activity sees welcoming onboarding guidance with appropriate CTA ("Get started by uploading your first receipt" for Country Finance, "System ready — waiting for country submissions" for Admin), not a blank page (SC-006)
- [ ] T027 [P] Verify mobile responsive layout for all dashboard sections — test at 320px, 375px, and 768px viewport widths; sections stack vertically in single column on mobile; quick action buttons remain prominent at top; budget progress bars remain readable; no horizontal scrolling; touch targets meet 44x44px minimum (FR-014, SC-005)
- [ ] T028 [P] Verify independent section loading with Suspense/skeletons — simulate slow data fetch for one dashboard section, verify other sections render immediately with skeleton fallbacks; simulate section error, verify error boundary shows retry button without breaking other sections (FR-011)
- [ ] T029 [P] Verify i18n completeness for all dashboard and notification components — check all 5 locales have translations for every `dashboard.*` and `notifications.*` key; switch locale to each language and verify no missing keys or fallback text appears; verify date/currency formatting respects locale
- [ ] T030 Run quickstart.md validation — verify dashboard workflow end-to-end per quickstart scenarios for all three roles and notification bell interaction

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — i18n keys only
- **Phase 2 (Foundational)**: Depends on Phase 1 — API route uses i18n indirectly, shared components use i18n keys
- **Phase 3 (US1 - Admin Dashboard)**: Depends on Phase 2 — uses API route, shared components
- **Phase 4 (US2 - Country Finance Dashboard)**: Depends on Phase 2 — uses API route, shared components; can run in parallel with Phase 3
- **Phase 5 (US3 - Country Admin Dashboard)**: Depends on Phase 2 — uses API route, shared components; can run in parallel with Phase 3/4
- **Phase 6 (US4 - Notification Bell)**: Implemented by Feature 007 — no 008-specific tasks
- **Phase 7 (Polish)**: Depends on all user stories being complete and Feature 007 bell implementation

### User Story Dependencies

- **US1 (Admin Dashboard)**: Foundation only — independent
- **US2 (Country Finance Dashboard)**: Foundation only — independent, parallel with US1
- **US3 (Country Admin Dashboard)**: Foundation only — independent, parallel with US1/US2
- **US4 (Notification Bell)**: Implemented by Feature 007 (007 tasks T032-T034, E2E T027)

### Parallel Opportunities

```bash
# Phase 1 parallel tasks:
T001 (dashboard i18n) | T002 (notification i18n)

# Phase 2 parallel tasks:
T004 (EmptyState) | T005 (QuickActions) | T006 (DashboardSection)

# Phase 3-6 can overlap significantly:
# US1 tests: T007 | T008
# US2 tests: T014 | T015
# US3 tests: T021 | T022
# Phases 3, 4, 5 are all independent after Phase 2:
Phase 3 (US1) | Phase 4 (US2) | Phase 5 (US3)

# Phase 7 parallel polish:
T026 (empty states) | T027 (mobile responsive) | T028 (Suspense/skeletons) | T029 (i18n verify)
```

---

## Implementation Strategy

### MVP First (US1 + US2 — P1 Dashboard Stories)

1. Complete Phase 1: Setup (i18n keys)
2. Complete Phase 2: Foundational (API route, shared components)
3. Complete Phases 3 + 4 in parallel: Admin Dashboard + Country Finance Dashboard
4. **STOP and VALIDATE**: Two P1 dashboard stories deliver value to the most frequent users
5. This replaces the placeholder dashboard for admins and country finance users (notification bell is delivered by Feature 007)

### Incremental Delivery

1. Setup + Foundation -> i18n keys, API route, shared components ready
2. US1 (Admin Dashboard) -> Power users see system overview -> **P1**
3. US2 (Country Finance Dashboard) -> Most frequent users see their tasks -> **P1**
4. US3 (Country Admin Dashboard) -> Country oversight dashboard -> **P2**
5. US4 (Notification Bell) -> Implemented by Feature 007 -> **P1**
6. Polish -> Empty states, mobile, Suspense, i18n verification -> Production-ready

---

## Summary

- **Total tasks**: 30 (US4 notification bell implemented by Feature 007)
- **Phase 1 (Setup)**: 2 tasks
- **Phase 2 (Foundational)**: 4 tasks
- **Phase 3 (US1 - Admin Dashboard)**: 7 tasks (2 test + 5 implementation)
- **Phase 4 (US2 - Country Finance Dashboard)**: 7 tasks (2 test + 5 implementation)
- **Phase 5 (US3 - Country Admin Dashboard)**: 5 tasks (2 test + 3 implementation)
- **Phase 6 (US4 - Notification Bell)**: 0 tasks (implemented by Feature 007 — tasks T032-T034, E2E T027)
- **Phase 7 (Polish)**: 5 tasks
- **Parallel opportunities**: 4 groups identified (Phases 3/4/5 can run fully in parallel after Phase 2)
- **MVP scope**: Phases 1-4 (20 tasks — P1 dashboard stories; notification bell via Feature 007)
