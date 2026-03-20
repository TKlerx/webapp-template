# Quickstart: Dashboard & Home Screen

**Date**: 2026-03-20

## Prerequisites

- Node.js 20+
- npm
- Existing GVI Finance setup with Features 1, 2, and 7 applied (budget data, receipts, notifications)

## Setup

No new dependencies, environment variables, or migrations are required. This feature adds only UI components and an aggregation API route on top of existing data.

```bash
# Install (in case new devDependencies were added)
npm install

# Regenerate Prisma client (no schema changes, but good practice)
npm run prisma:generate

# Ensure seed data exists for testing
npm run prisma:seed

# Start dev server
npm run dev
```

## Key Workflows

### 1. GVI Finance Admin Dashboard

1. Log in as a GVI Finance Admin user
2. You land on the dashboard (home page)
3. Verify the **Action Required** section shows:
   - Count of receipts pending review (links to receipts page filtered by pending)
   - Count of pending budget proposals (links to proposals page filtered by pending)
   - Count of flagged receipts awaiting country response
4. Verify **Budget Alerts** shows any over-budget items across all countries with planned vs actual amounts
5. Verify **Recent Activity** shows the last 10 events (receipt uploads, reviews, proposal updates)
6. Verify **Quick Actions** buttons: "Review Receipts", "Budget Overview", "Manage Users", "Audit Trail"
7. Click an action-required count to confirm it navigates to the correct filtered list

### 2. Country Finance User Dashboard

1. Log in as a Country Finance user assigned to Kenya
2. Verify the **My Tasks** section shows:
   - Count of flagged receipts needing correction
   - Count of incomplete email-submitted receipts
3. Verify **My Recent Receipts** shows the user's last 10 uploads with date, amount, budget item, and status
4. Verify **Budget Summary** shows Kenya's top-level budget items with planned vs actual progress bars
5. Verify **Quick Actions** buttons: "Upload Receipt", "Capture Receipt"
6. With no tasks pending, verify the "All caught up!" empty state message appears

### 3. Country Admin Dashboard

1. Log in as a Country Admin for Kenya
2. Verify **My Proposals** shows submitted budget proposals with status (pending, approved, rejected)
3. Verify **Budget Alerts** shows over-budget items for Kenya only (not other countries)
4. Verify **Country Activity** shows recent events for Kenya only
5. Verify **Quick Actions** buttons: "New Budget Proposal", "View Country Budget"

### 4. Notification Bell (All Roles)

1. Log in as any user
2. Verify the bell icon appears in the top navigation bar on every page
3. If there are unread notifications, the badge shows the count
4. If there are zero unread notifications, the badge is hidden
5. Click the bell to open the dropdown with the 5 most recent notifications
6. Click a notification to navigate to the linked entity (receipt, proposal, etc.)
7. Verify the notification is marked as read after clicking
8. Click "View All" to navigate to the full notification history page
9. Wait 30+ seconds and verify the badge count updates if new notifications arrive (create a notification in another tab or via seed script)

### 5. Empty State (First-Time User)

1. Create a new Country Finance user with no receipts or activity
2. Log in as that user
3. Verify the dashboard shows a welcoming empty state: "Get started by uploading your first receipt" with a link to the upload page
4. Verify all sections show appropriate empty states rather than blank areas

### 6. Mobile Responsiveness

1. Open the dashboard in a mobile viewport (or use browser DevTools responsive mode, ~375px width)
2. Verify sections stack vertically in a single column
3. Verify quick action buttons remain prominent and touch-friendly
4. Verify no horizontal scrolling is required
5. Verify budget summary uses compact indicators (no wide charts)

## Running Tests

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# All validations (typecheck + lint + duplication + semgrep + tests)
npm run validate
```

## Troubleshooting

- **Dashboard shows no data**: Ensure seed data has been applied (`npm run prisma:seed`). The dashboard reads from existing Receipt, BudgetItem, BudgetProposal, AuditEntry, and Notification tables.
- **Notification bell not updating**: Check browser console for polling errors. The bell polls `GET /api/notifications/unread-count` every 30 seconds. Ensure the notifications API route from Feature 7 is implemented.
- **Wrong dashboard variant**: The dashboard determines the variant from the user's `role` field in the session. Verify the user's role is correctly set in the database.
