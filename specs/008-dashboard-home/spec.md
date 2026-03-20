# Feature Specification: Dashboard & Home Screen

**Feature Branch**: `008-dashboard-home`
**Created**: 2026-03-20
**Status**: Draft
**Input**: User description: "A personalized home screen showing open tasks, recent activity, budget status at a glance, and quick actions for each user role"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - GVI Finance Admin Dashboard (Priority: P1)

A GVI Finance admin logs in and lands on their personalized dashboard. They immediately see what needs their attention: receipts awaiting review, pending budget proposals, flagged items awaiting response, and any over-budget alerts. They also see recent activity across all countries — latest receipts uploaded, recent review decisions, and proposal updates. Quick action buttons let them jump directly to "Review Receipts", "Budget Overview", or "Manage Users". The dashboard gives them a complete picture of the system's status without navigating to individual pages.

**Why this priority**: GVI Finance admins are the primary power users who need a comprehensive overview. Their dashboard is the most complex and highest-value, as it drives the spot-checking workflow (project goal #2).

**Independent Test**: Can be tested by logging in as a GVI Finance admin and verifying that all sections display correct counts and link to the right pages.

**Acceptance Scenarios**:

1. **Given** a GVI Finance admin logs in, **When** the dashboard loads, **Then** they see an "Action Required" section listing counts of: receipts pending review, pending budget proposals, and receipts flagged and awaiting country response.
2. **Given** there are over-budget items across countries, **When** the dashboard loads, **Then** a "Budget Alerts" section shows the affected budget items with country, item name, planned vs. actual amounts, and percentage over budget.
3. **Given** recent activity exists, **When** the dashboard loads, **Then** a "Recent Activity" feed shows the latest 10 events across all countries (receipt uploads, review decisions, proposal updates) with timestamps and links.
4. **Given** the admin wants to take action, **When** they view the dashboard, **Then** quick action buttons are visible: "Review Receipts", "Budget Overview", "Manage Users", "Audit Trail".
5. **Given** the admin clicks an item count (e.g., "5 receipts pending review"), **When** they click it, **Then** they navigate to the relevant filtered list.

---

### User Story 2 - Country Finance User Dashboard (Priority: P1)

A Country Finance user in Kenya logs in and sees their dashboard focused on their own submissions. They see their recent receipt uploads with processing/review status, any receipts that have been flagged for correction (requiring their attention), and incomplete email-submitted receipts that need to be completed. A prominent "Upload Receipt" or "Capture Receipt" button is always visible. They see a summary of their country's budget usage to understand the context of their submissions.

**Why this priority**: Country Finance users are the most frequent users — they upload receipts daily. A clear dashboard showing their pending tasks and submission status directly supports goal #3 (automating expense submission).

**Independent Test**: Can be tested by logging in as a Country Finance user and verifying they see only their own country's data, their recent uploads, and any flagged receipts.

**Acceptance Scenarios**:

1. **Given** a Country Finance user logs in, **When** the dashboard loads, **Then** they see a "My Tasks" section listing: receipts flagged for correction (count + links), incomplete email-submitted receipts to complete (count + links).
2. **Given** the user has recent uploads, **When** the dashboard loads, **Then** a "My Recent Receipts" section shows their last 10 uploads with date, amount, budget item, and current status (pending review, approved, flagged, rejected).
3. **Given** the user is assigned to Kenya, **When** the dashboard loads, **Then** they see a "Budget Summary" widget showing Kenya's top-level budget items with planned vs. actual spend (simple bar or progress indicators).
4. **Given** the user wants to submit a receipt, **When** they view the dashboard, **Then** prominent quick action buttons are visible: "Upload Receipt" and "Capture Receipt" (mobile).
5. **Given** the user has no pending tasks, **When** the dashboard loads, **Then** the "My Tasks" section shows a positive message (e.g., "All caught up!") instead of being empty.

---

### User Story 3 - Country Admin Dashboard (Priority: P2)

A Country Admin for Kenya logs in and sees a dashboard focused on their country's budget health and workflow status. They see pending budget proposals they've submitted (with approval status), their country's budget overview (planned vs. actual per top-level item), and recent receipt activity for Kenya. They can quickly submit a new budget proposal or review their country's receipts.

**Why this priority**: Country Admins need oversight of their country without the global view. Lower priority than P1 because fewer users hold this role, and they can use the existing budget overview page as a fallback.

**Independent Test**: Can be tested by logging in as a Country Admin and verifying country-scoped data and proposal status is displayed.

**Acceptance Scenarios**:

1. **Given** a Country Admin for Kenya logs in, **When** the dashboard loads, **Then** they see a "My Proposals" section showing their pending, approved, and recently rejected budget proposals.
2. **Given** Kenya has over-budget items, **When** the dashboard loads, **Then** a "Budget Alerts" section shows affected items for Kenya only.
3. **Given** recent receipt activity exists for Kenya, **When** the dashboard loads, **Then** a "Country Activity" feed shows the latest receipt uploads and review decisions for Kenya.
4. **Given** the Country Admin wants to take action, **When** they view the dashboard, **Then** quick action buttons include "New Budget Proposal" and "View Country Budget".

---

### User Story 4 - Notification Bell in Navigation (Priority: P1)

On every page of the application, the top navigation bar includes a bell icon with an unread notification count badge. Clicking the bell opens a dropdown panel showing the most recent notifications. Users can click a notification to navigate to the relevant item, or click "View All" to see the full notification history. The bell is the persistent entry point for notifications across the entire application.

**Why this priority**: The notification bell is the universal notification access point referenced by Feature 007. It must be available on every page, not just the dashboard, making it a P1 cross-cutting concern.

**Independent Test**: Can be tested by navigating to any page and verifying the bell icon shows correct unread count and notifications are accessible.

**Acceptance Scenarios**:

1. **Given** a user is on any page, **When** they look at the top navigation, **Then** they see a bell icon with an unread notification count badge (hidden when count is zero).
2. **Given** the user has unread notifications, **When** they click the bell, **Then** a dropdown panel shows the 5 most recent notifications with type icon, short description, timestamp, and read/unread indicator.
3. **Given** the user clicks a notification in the dropdown, **When** they click it, **Then** they navigate to the linked entity (receipt, proposal, etc.) and the notification is marked as read.
4. **Given** the user wants to see all notifications, **When** they click "View All" in the dropdown, **Then** they navigate to the full notification history page.
5. **Given** a new notification arrives while the user is on a page, **When** the notification is created, **Then** the badge count updates without requiring a full page reload (polling at a reasonable interval).

---

### Edge Cases

- What happens when a user has no data yet (first login, no receipts, no activity)? The dashboard shows a welcoming empty state with guidance: "Get started by uploading your first receipt" with a link to the upload page.
- What happens when a user is assigned to multiple countries? Country Finance and Country Admin users see data aggregated across their assigned countries, with country labels on each item.
- What happens when the dashboard data takes too long to load? Each dashboard section loads independently with its own loading skeleton. Sections that fail to load show a retry option rather than breaking the entire dashboard.
- What happens on mobile viewports? Dashboard sections stack vertically in a single column. Quick action buttons remain prominent at the top. Budget charts simplify to compact indicators.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST display a personalized dashboard as the home screen after login, tailored to the user's role (GVI Finance Admin, Country Admin, Country Finance).
- **FR-002**: The GVI Finance Admin dashboard MUST show: action-required counts (receipts pending review, pending proposals, flagged receipts awaiting response), budget alerts (over-budget items across countries), recent activity feed (last 10 events), and quick action buttons.
- **FR-003**: The Country Finance dashboard MUST show: personal tasks (flagged receipts to correct, incomplete email receipts to complete), recent uploads with status, country budget summary, and quick action buttons (Upload Receipt, Capture Receipt).
- **FR-004**: The Country Admin dashboard MUST show: submitted proposals with status, country budget alerts, country activity feed, and quick action buttons (New Proposal, View Country Budget).
- **FR-005**: All dashboard data MUST be scoped to the user's assigned countries (except GVI Finance Admin who sees all countries).
- **FR-006**: Counts and lists on the dashboard MUST link to the relevant filtered pages (e.g., clicking "5 pending reviews" navigates to receipts filtered by pending review status).
- **FR-007**: The top navigation bar MUST include a bell icon with unread notification count badge, visible on all pages.
- **FR-008**: Clicking the bell MUST open a dropdown showing the 5 most recent notifications with links to the relevant entities.
- **FR-009**: The notification dropdown MUST include a "View All" link to the full notification history page.
- **FR-010**: The notification badge count MUST update periodically without requiring a full page reload.
- **FR-011**: Dashboard sections MUST load independently — a slow or failed section MUST NOT block other sections from displaying.
- **FR-012**: The dashboard MUST show an appropriate empty state with onboarding guidance when a user has no data.
- **FR-013**: All dashboard text MUST be available in all supported languages (en, de, es, fr, pt).
- **FR-014**: The dashboard MUST be fully usable on mobile viewports with sections stacking vertically and touch-appropriate targets.

### Key Entities

- **Dashboard Widget**: A discrete section of the dashboard (e.g., "Action Required", "Recent Activity", "Budget Summary"). Each widget loads independently and is role-specific.
- **Activity Feed Entry**: A record of a recent event (receipt uploaded, receipt reviewed, proposal submitted) with timestamp, actor, description, and link to the entity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dashboard loads and displays all sections within 3 seconds on a standard connection.
- **SC-002**: Users can navigate from a dashboard item to the relevant detail page in one click.
- **SC-003**: 100% of action-required items (flagged receipts, pending proposals, incomplete email receipts) appear on the correct user's dashboard.
- **SC-004**: The notification bell badge reflects the correct unread count within 30 seconds of a new notification being created.
- **SC-005**: Users on mobile devices can access all dashboard sections and quick actions without horizontal scrolling.
- **SC-006**: First-time users see a meaningful onboarding empty state (not a blank page).

## Assumptions

- The dashboard replaces the existing empty placeholder dashboard from the application skeleton.
- Dashboard data is fetched from existing API endpoints (receipts, budget items, proposals, notifications) — no new data sources are needed, only aggregation.
- The notification bell and dropdown are part of the shared navigation layout, not specific to the dashboard page.
- Polling interval for notification badge updates is configurable, defaulting to 30 seconds.
- "Recent Activity" feed entries are derived from the existing audit trail (Feature 1 FR-017), not a separate event system.

## Scope Boundaries

**In scope**:
- Role-based personalized dashboard (3 role variants)
- Action-required counts with links
- Budget summary/alerts widgets
- Recent activity feed
- Quick action buttons
- Notification bell icon with unread badge in top navigation
- Notification dropdown (recent 5)
- Empty state / onboarding guidance
- Mobile-responsive dashboard layout

**Out of scope (later features)**:
- Customizable widget layout (drag-and-drop dashboard)
- Dashboard data export
- Real-time live-updating dashboard (WebSocket)
- Charts or advanced data visualizations (simple counts and progress bars only)
- Dashboard for unauthenticated users (login page remains separate)

## Dependencies

- **Feature 1 (Budget Planning & Core Data Model)**: Budget items, receipts, proposals, audit trail, user roles, country assignments.
- **Feature 2 (Receipt Review & Audit Dashboard)**: Receipt review status (pending, approved, flagged, rejected).
- **Feature 7 (Email & Notifications)**: Notification model, unread counts, notification preferences. The bell icon and dropdown defined here implement the UI referenced in 007 FR-003.
