# Data Model: Dashboard & Home Screen

**Date**: 2026-03-20
**Feature**: [spec.md](spec.md) | [plan.md](plan.md)

## Schema Changes

**None.** This feature does not introduce any new database models, enums, or schema changes. The dashboard is a purely presentational feature that reads from existing models:

- `Receipt` (Feature 1) — for pending review counts, recent uploads, flagged receipts
- `BudgetItem` (Feature 1) — for budget summary and over-budget alerts
- `BudgetProposal` (Feature 1) — for pending proposals and proposal status
- `AuditEntry` (Feature 1) — for recent activity feed
- `Notification` (Feature 7) — for notification bell unread count and dropdown
- `User`, `UserCountryAssignment` (Feature 1) — for role and country scoping

## API Response Types (Not Persisted)

The following TypeScript types define the shape of the dashboard API responses. These are transport types only — they are not stored in the database.

### AdminDashboardData

Returned by `GET /api/dashboard` when the authenticated user has role `GVI_FINANCE_ADMIN`.

```typescript
interface AdminDashboardData {
  role: 'GVI_FINANCE_ADMIN';
  actionRequired: {
    pendingReviews: number;       // Receipts with status PENDING_REVIEW
    pendingProposals: number;     // BudgetProposals with status PENDING
    flaggedAwaitingResponse: number; // Receipts flagged, awaiting country user correction
  };
  budgetAlerts: OverBudgetItem[];  // Budget items where actual > planned (all countries)
  recentActivity: ActivityEntry[]; // Last 10 audit entries (all countries)
}
```

### CountryFinanceDashboardData

Returned by `GET /api/dashboard` when the authenticated user has role `COUNTRY_FINANCE`.

```typescript
interface CountryFinanceDashboardData {
  role: 'COUNTRY_FINANCE';
  myTasks: {
    flaggedReceipts: number;          // Receipts flagged for correction (user's countries)
    incompleteEmailReceipts: number;  // Email-submitted receipts needing completion
  };
  recentUploads: RecentUpload[];      // User's last 10 receipt uploads
  budgetSummary: BudgetSummaryItem[]; // Top-level budget items for user's countries
}
```

### CountryAdminDashboardData

Returned by `GET /api/dashboard` when the authenticated user has role `COUNTRY_ADMIN`.

```typescript
interface CountryAdminDashboardData {
  role: 'COUNTRY_ADMIN';
  proposals: ProposalSummary[];       // User's budget proposals with status
  budgetAlerts: OverBudgetItem[];     // Over-budget items for user's countries only
  countryActivity: ActivityEntry[];   // Last 10 audit entries for user's countries
}
```

### Shared Sub-Types

```typescript
interface OverBudgetItem {
  budgetItemId: string;
  budgetItemName: string;
  countryName: string;
  countryCode: string;
  plannedAmount: number;
  actualAmount: number;
  percentOver: number;           // e.g., 15.5 means 15.5% over budget
  currency: string;
}

interface ActivityEntry {
  id: string;
  action: string;                // AuditAction enum value
  description: string;           // Human-readable description
  actorName: string;             // User display name
  entityType: string;            // e.g., "receipt", "proposal", "budgetItem"
  entityId: string;
  countryName: string | null;
  createdAt: string;             // ISO 8601 timestamp
  linkUrl: string;               // Relative URL to the entity page
}

interface RecentUpload {
  id: string;
  date: string;                  // Receipt date (ISO 8601)
  amount: number;
  currency: string;
  budgetItemName: string;
  countryName: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'FLAGGED' | 'REJECTED';
  uploadedAt: string;            // ISO 8601 timestamp
}

interface BudgetSummaryItem {
  budgetItemId: string;
  budgetItemName: string;
  countryName: string;
  plannedAmount: number;
  actualAmount: number;
  currency: string;
  percentUsed: number;           // e.g., 75.0 means 75% of planned spent
}

interface ProposalSummary {
  id: string;
  type: 'ADD' | 'EDIT' | 'REMOVE';
  targetItemName: string | null; // Name of the budget item (null for ADD)
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;           // ISO 8601 timestamp
  reviewComment: string | null;  // Reviewer's comment (if reviewed)
}
```

## Existing Models Referenced

For reference, the dashboard queries the following existing models (defined in Feature 1 and Feature 7):

| Model | Feature | Dashboard Usage |
|-------|---------|-----------------|
| Receipt | 001 | Pending review counts, flagged receipts, recent uploads |
| BudgetItem | 001 | Budget summary, over-budget detection (planned vs actual) |
| CountryBudget | 001 | Country budget context for summary widget |
| BudgetProposal | 001 | Pending proposal counts, proposal status list |
| AuditEntry | 001 | Recent activity feed |
| Notification | 007 | Unread count for bell badge, recent notifications for dropdown |
| User | 001 | Actor names in activity feed, role determination |
| UserCountryAssignment | 001 | Country scoping for non-admin roles |
