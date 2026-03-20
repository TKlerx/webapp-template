# Implementation Plan: Dashboard & Home Screen

**Branch**: `008-dashboard-home` | **Date**: 2026-03-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/008-dashboard-home/spec.md`

## Summary

Replace the placeholder dashboard with a role-based personalized home screen. GVI Finance Admins see system-wide action-required counts, budget alerts, and recent activity. Country Finance users see their pending tasks, recent uploads, and country budget summary. Country Admins see proposals, country budget alerts, and country activity. A notification bell with unread count badge is added to the shared navigation bar on all pages. All dashboard data is aggregated from existing API endpoints and services — no new persistent models are needed.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16 (App Router)
**Primary Dependencies**: Prisma 7, BetterAuth 1.5.4, next-intl 4.8, Tailwind CSS 4
**Storage**: SQLite via Prisma. Dashboard reads existing data; no new tables.
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Web application (browser), served under configurable base path `/gvi-finance`
**Project Type**: Full-stack web application (Next.js App Router — unified frontend + API)
**Performance Goals**: Dashboard loads all sections within 3 seconds (SC-001). Notification badge updates within 30 seconds of new notification (SC-004).
**Constraints**: ~10 users, single instance. Dashboard is purely an aggregation/presentation layer over existing data.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | Pass | No new data models. Dashboard aggregates existing data via server components with parallel fetching. |
| II. Test Coverage | Pass | Unit tests for aggregation logic, E2E tests for each role's dashboard and notification bell. |
| III. Duplication Control | Pass | Shared dashboard section components (EmptyState, QuickActions) reused across role variants. |
| IV. Incremental Delivery | Pass | P1 dashboards (Admin + Country Finance) and notification bell first, then P2 (Country Admin). Each independently testable. |
| V. Azure OpenAI Integration | N/A | No AI features in this feature. |
| VI. Web Application Standards | Pass | Base path respected in all links. Toast notifications for errors. |
| VII. Internationalization | Pass | All dashboard text uses next-intl translation keys across 5 locales (en, de, es, fr, pt). |
| VIII. Responsive Design | Pass | Mobile-first Tailwind layout. Sections stack vertically on small screens. Touch-appropriate action buttons. |

## Project Structure

### Documentation (this feature)

```text
specs/008-dashboard-home/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
│   └── api.md
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   └── dashboard/
│   │       └── route.ts             # GET — aggregation endpoint, returns role-appropriate data
│   ├── (dashboard)/
│   │   └── page.tsx                 # Home/dashboard page — reads role, renders correct variant
│   └── ...existing pages
├── components/
│   ├── dashboard/
│   │   ├── AdminDashboard.tsx           # GVI Finance Admin dashboard layout
│   │   ├── CountryFinanceDashboard.tsx  # Country Finance user dashboard layout
│   │   ├── CountryAdminDashboard.tsx    # Country Admin dashboard layout
│   │   ├── ActionRequired.tsx           # Action-required counts with links (Admin)
│   │   ├── BudgetAlerts.tsx             # Over-budget items display (Admin, Country Admin)
│   │   ├── RecentActivity.tsx           # Activity feed (Admin, Country Admin)
│   │   ├── BudgetSummary.tsx            # Budget planned vs actual bars (Country Finance)
│   │   ├── MyTasks.tsx                  # Flagged/incomplete receipts (Country Finance)
│   │   ├── MyRecentReceipts.tsx         # Recent uploads with status (Country Finance)
│   │   ├── MyProposals.tsx              # Proposal list with status (Country Admin)
│   │   ├── QuickActions.tsx             # Role-specific quick action buttons
│   │   ├── EmptyState.tsx               # Onboarding/empty state with guidance
│   │   └── DashboardSection.tsx         # Wrapper with independent loading + error boundary
│   ├── notifications/
│   │   ├── NotificationBell.tsx         # Bell icon + badge count (client component, polls)
│   │   └── NotificationDropdown.tsx     # Dropdown panel with recent 5 notifications
│   └── ...existing components
├── i18n/
│   └── messages/
│       ├── en.json    # Extended with dashboard.* and notifications.* keys
│       ├── de.json
│       ├── es.json
│       ├── fr.json
│       └── pt.json
tests/
├── unit/
│   └── dashboard-aggregation.test.ts    # Tests for aggregation logic
├── e2e/
│   ├── dashboard-admin.spec.ts          # Admin dashboard E2E
│   ├── dashboard-country-finance.spec.ts # Country Finance dashboard E2E
│   ├── dashboard-country-admin.spec.ts  # Country Admin dashboard E2E
│   └── notification-bell.spec.ts        # Notification bell E2E
```

**Structure Decision**: No new lib files. The dashboard API route aggregates data by calling Prisma queries directly (using existing models: Receipt, BudgetItem, BudgetProposal, AuditEntry, Notification). Notification bell is placed in the shared Navigation component. Dashboard section components are co-located under `src/components/dashboard/`.

## New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/dashboard` | GET | Returns role-appropriate aggregated dashboard data. Server inspects session to determine role, then queries relevant models in parallel. |

**Referenced from Feature 007** (not defined here):
- `GET /api/notifications/unread-count` — returns `{ data: { count: number } }`, polled by NotificationBell
- `GET /api/notifications` — returns recent notifications for dropdown
- `PATCH /api/notifications/[id]/read` — marks notification as read on click

## New Components

### Dashboard Components (`src/components/dashboard/`)

| Component | Type | Used By | Description |
|-----------|------|---------|-------------|
| AdminDashboard | Server | Dashboard page | Orchestrates Admin sections with parallel data fetching |
| CountryFinanceDashboard | Server | Dashboard page | Orchestrates Country Finance sections |
| CountryAdminDashboard | Server | Dashboard page | Orchestrates Country Admin sections |
| DashboardSection | Client | All dashboards | Wrapper providing Suspense boundary, loading skeleton, and error retry per section |
| ActionRequired | Server | AdminDashboard | Counts of pending reviews, proposals, flagged items with links |
| BudgetAlerts | Server | AdminDashboard, CountryAdminDashboard | Over-budget items table (all countries or single country) |
| RecentActivity | Server | AdminDashboard, CountryAdminDashboard | Activity feed from AuditEntry model |
| BudgetSummary | Server | CountryFinanceDashboard | Planned vs actual progress bars per top-level budget item |
| MyTasks | Server | CountryFinanceDashboard | Flagged + incomplete receipt counts with links |
| MyRecentReceipts | Server | CountryFinanceDashboard | Last 10 uploads with status badges |
| MyProposals | Server | CountryAdminDashboard | Proposal list with status (pending/approved/rejected) |
| QuickActions | Server | All dashboards | Role-specific action buttons (Upload Receipt, Review, etc.) |
| EmptyState | Server | All dashboards | Welcoming message + guidance when no data exists |

### Notification Components (`src/components/notifications/`)

| Component | Type | Used By | Description |
|-----------|------|---------|-------------|
| NotificationBell | Client | Navigation (layout) | Bell icon with badge count; polls `/api/notifications/unread-count` every 30s |
| NotificationDropdown | Client | NotificationBell | Dropdown panel showing 5 most recent notifications with links |

**Note**: The notification bell is a shared cross-cutting component embedded in the top navigation bar (`src/components/ui/Navigation.tsx`). It is the UI owner of the notification bell referenced in Feature 007.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Role-based dashboard branching | Three distinct dashboard variants for three roles | A single generic dashboard would either show too much or too little for each role |
| Client-side notification polling | Badge must update without full page reload (FR-010) | Server-only rendering would require manual refresh; WebSocket is over-engineering for 10 users |
