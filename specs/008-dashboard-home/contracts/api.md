# API Contracts: Dashboard & Home Screen

**Date**: 2026-03-20

All endpoints require authentication. Role restrictions noted per endpoint.
Base path: `/gvi-finance` (configurable).
All responses follow `{ data: T }` or `{ error: string }` pattern.

---

## Dashboard

### `GET /api/dashboard`
**Roles**: All authenticated users
**Description**: Returns aggregated dashboard data tailored to the authenticated user's role. The server inspects the session to determine the user's role and returns the corresponding data shape.

**Query Parameters**: None. Role and country scoping are derived from the session.

**Response** (200): One of the following, distinguished by the `role` field:

**When role is `GVI_FINANCE_ADMIN`**:
```json
{
  "data": {
    "role": "GVI_FINANCE_ADMIN",
    "actionRequired": {
      "pendingReviews": 5,
      "pendingProposals": 2,
      "flaggedAwaitingResponse": 3
    },
    "budgetAlerts": [
      {
        "budgetItemId": "clx...",
        "budgetItemName": "Fuel",
        "countryName": "Kenya",
        "countryCode": "KE",
        "plannedAmount": 8000,
        "actualAmount": 9200,
        "percentOver": 15.0,
        "currency": "EUR"
      }
    ],
    "recentActivity": [
      {
        "id": "clx...",
        "action": "RECEIPT_UPLOADED",
        "description": "Receipt uploaded for Fuel (Kenya)",
        "actorName": "Jane Doe",
        "entityType": "receipt",
        "entityId": "clx...",
        "countryName": "Kenya",
        "createdAt": "2026-03-20T10:30:00Z",
        "linkUrl": "/gvi-finance/receipts/clx..."
      }
    ]
  }
}
```

**When role is `COUNTRY_FINANCE`**:
```json
{
  "data": {
    "role": "COUNTRY_FINANCE",
    "myTasks": {
      "flaggedReceipts": 2,
      "incompleteEmailReceipts": 1
    },
    "recentUploads": [
      {
        "id": "clx...",
        "date": "2026-03-18",
        "amount": 150.00,
        "currency": "EUR",
        "budgetItemName": "Fuel",
        "countryName": "Kenya",
        "status": "PENDING_REVIEW",
        "uploadedAt": "2026-03-18T14:00:00Z"
      }
    ],
    "budgetSummary": [
      {
        "budgetItemId": "clx...",
        "budgetItemName": "Personnel",
        "countryName": "Kenya",
        "plannedAmount": 30000,
        "actualAmount": 22500,
        "currency": "EUR",
        "percentUsed": 75.0
      }
    ]
  }
}
```

**When role is `COUNTRY_ADMIN`**:
```json
{
  "data": {
    "role": "COUNTRY_ADMIN",
    "proposals": [
      {
        "id": "clx...",
        "type": "EDIT",
        "targetItemName": "Fuel",
        "status": "PENDING",
        "submittedAt": "2026-03-15T09:00:00Z",
        "reviewComment": null
      }
    ],
    "budgetAlerts": [
      {
        "budgetItemId": "clx...",
        "budgetItemName": "Fuel",
        "countryName": "Kenya",
        "countryCode": "KE",
        "plannedAmount": 8000,
        "actualAmount": 9200,
        "percentOver": 15.0,
        "currency": "EUR"
      }
    ],
    "countryActivity": [
      {
        "id": "clx...",
        "action": "RECEIPT_UPLOADED",
        "description": "Receipt uploaded for Fuel (Kenya)",
        "actorName": "Jane Doe",
        "entityType": "receipt",
        "entityId": "clx...",
        "countryName": "Kenya",
        "createdAt": "2026-03-20T10:30:00Z",
        "linkUrl": "/gvi-finance/receipts/clx..."
      }
    ]
  }
}
```

**Error Responses**:
- `401`: `{ "error": "Unauthorized" }` — not authenticated
- `500`: `{ "error": "Internal server error" }` — aggregation failure

---

## Notifications (Defined in Feature 007, Referenced Here)

The notification bell component uses the following endpoints defined in Feature 007. They are documented here for completeness as the bell UI is owned by this feature.

### `GET /api/notifications/unread-count`
**Roles**: All authenticated users
**Description**: Returns the count of unread notifications for the authenticated user. Polled by the NotificationBell component every 30 seconds.

**Response** (200):
```json
{
  "data": {
    "count": 3
  }
}
```

### `GET /api/notifications?limit=5`
**Roles**: All authenticated users
**Description**: Returns the most recent notifications for the authenticated user. Used by the NotificationDropdown component.

**Query Parameters**:
- `limit` (optional, default 20): Maximum number of notifications to return.

**Response** (200):
```json
{
  "data": [
    {
      "id": "clx...",
      "type": "RECEIPT_FLAGGED",
      "entityType": "receipt",
      "entityId": "clx...",
      "title": "Receipt flagged",
      "message": "Your receipt for Fuel has been flagged for correction.",
      "isRead": false,
      "createdAt": "2026-03-20T10:30:00Z",
      "linkUrl": "/gvi-finance/receipts/clx..."
    }
  ]
}
```

**Note**: `linkUrl` is a computed field derived from `entityType` + `entityId` at query time (not stored in the Notification model). Field names (`isRead`, `message`) match Feature 007's canonical Notification model.

### `PATCH /api/notifications/[id]`
**Roles**: All authenticated users (own notifications only)
**Description**: Marks a notification as read. Called when a user clicks a notification in the dropdown. Uses `{ isRead: true }` request body per Feature 007's contract.

**Response** (200):
```json
{
  "data": {
    "id": "clx...",
    "isRead": true
  }
}
```

---

## Data Source Mapping

The dashboard endpoint aggregates data from the following existing models. No new database queries are introduced beyond standard Prisma `findMany`/`count` calls on existing tables.

| Dashboard Section | Source Model | Query Pattern |
|-------------------|-------------|---------------|
| Action Required: pendingReviews | Receipt | `count` where status = PENDING_REVIEW |
| Action Required: pendingProposals | BudgetProposal | `count` where status = PENDING |
| Action Required: flaggedAwaitingResponse | Receipt | `count` where status = FLAGGED |
| Budget Alerts | BudgetItem + Receipt | Compare sum of receipt amounts vs planned amount per item |
| Recent Activity | AuditEntry | `findMany` ordered by createdAt desc, take 10, filtered by relevant action types |
| My Tasks | Receipt | `count` where status = FLAGGED and country in user's countries |
| Recent Uploads | Receipt | `findMany` where uploadedBy = userId, ordered by createdAt desc, take 10 |
| Budget Summary | BudgetItem + Receipt | Top-level items with aggregated receipt totals |
| Proposals | BudgetProposal | `findMany` where proposedBy = userId |
