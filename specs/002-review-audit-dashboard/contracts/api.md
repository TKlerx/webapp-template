# API Contracts: Receipt Review & Audit Dashboard

**Date**: 2026-03-20

## Receipt Review

### `POST /api/receipts/[id]/review`
**Roles**: GVI_FINANCE_ADMIN
**Body**: `{ status: "APPROVED" | "FLAGGED" | "REJECTED", comment?: string }`
**Validation**: Comment required for FLAGGED and REJECTED
**Response**: `{ data: Receipt }`
**Side effects**: Creates ReviewComment (if comment), creates AuditEntry

### `GET /api/receipts/[id]/comments`
**Roles**: All (country-scoped)
**Response**: `{ data: ReviewComment[] }` (chronological)

### `POST /api/receipts/[id]/comments`
**Roles**: GVI_FINANCE_ADMIN, COUNTRY_FINANCE (own receipts, only when FLAGGED)
**Body**: `{ text: string }`
**Side effects**: If author is Country Finance and receipt is FLAGGED, status reverts to PENDING_REVIEW
**Response**: `{ data: ReviewComment }` (201)

### `GET /api/receipts/[id]/revisions`
**Roles**: All (country-scoped)
**Response**: `{ data: ReceiptRevision[] }` (chronological)

### `POST /api/receipts/[id]/revisions`
**Roles**: COUNTRY_FINANCE (own receipts, only when FLAGGED)
**Content-Type**: `multipart/form-data`
**Fields**: `file` (binary)
**Validation**: PDF/JPEG/PNG, ≤20 MB
**Side effects**: Status reverts to PENDING_REVIEW, AuditEntry created
**Response**: `{ data: ReceiptRevision }` (201)

## Review Dashboard

### `GET /api/receipts?review=true&country=X&status=Y&budgetItemId=Z&dateFrom=A&dateTo=B&submitter=C`
**Roles**: GVI_FINANCE_ADMIN (all), COUNTRY_ADMIN (own country), COUNTRY_FINANCE (own receipts)
**Response**: `{ data: Receipt[], total: number }`
**Note**: Extends existing receipts endpoint with review-specific filters

## Audit Trail

### `GET /api/audit?action=X&entityType=Y&countryId=Z&dateFrom=A&dateTo=B&actorId=C&page=N&limit=M`
**Roles**: GVI_FINANCE_ADMIN
**Response**: `{ data: AuditEntry[], total: number, page: number, limit: number }`

### `GET /api/audit/export?format=csv|pdf&action=X&entityType=Y&countryId=Z&dateFrom=A&dateTo=B&actorId=C`
**Roles**: GVI_FINANCE_ADMIN
**Response**: Binary file (CSV or PDF) with Content-Disposition attachment header

## Compliance Dashboard

### `GET /api/compliance?budgetYearId=X&statusFilter=approved|all`
**Roles**: GVI_FINANCE_ADMIN, COUNTRY_ADMIN (own country)
**Response**:
```json
{
  "data": [{
    "countryId": "...",
    "countryName": "Kenya",
    "totalBudget": 50000,
    "currency": "EUR",
    "approvedSpend": 32000,
    "totalSpend": 38000,
    "percentUsed": 64,
    "statusCounts": { "pending": 5, "approved": 20, "flagged": 2, "rejected": 1 }
  }]
}
```

### `GET /api/compliance/[countryBudgetId]?statusFilter=approved|all`
**Roles**: GVI_FINANCE_ADMIN, COUNTRY_ADMIN (own country)
**Response**: Budget hierarchy with per-item aggregation (planned, actual by status, receipt counts)
