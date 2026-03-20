# API Contracts: Donor Project Reporting

**Date**: 2026-03-20

## Report Generation

### `POST /api/donor-projects/[id]/report`
**Roles**: GVI_FINANCE_ADMIN
**Body**: `{ dateFrom: string, dateTo: string, statusFilter: "approved"|"all", language: "en"|"de"|"es"|"fr"|"pt", format: "pdf"|"xlsx", includeImages?: boolean }`
**Response**: `{ data: DonorReport }` (201) — includes filePath for download
**Side effects**: Generates file, stores in uploads/reports/, creates AuditEntry

### `GET /api/donor-projects/[id]/report/preview?dateFrom=X&dateTo=Y&statusFilter=Z`
**Roles**: GVI_FINANCE_ADMIN
**Response**: `{ data: ReportPreviewData }` — structured JSON with same data as export:
```json
{
  "summary": { "donorName": "...", "projectName": "...", "period": "...", "currencies": [{ "code": "EUR", "allocated": 50000, "approvedSpend": 32000, "totalSpend": 38000 }] },
  "budgetBreakdown": [{ "itemName": "...", "planned": 30000, "actual": 25000, "variance": 5000, "currency": "EUR", "statusCounts": {...} }],
  "receipts": [{ "id": "...", "date": "...", "amount": 500, "currency": "EUR", "description": "...", "budgetItem": "...", "status": "APPROVED" }]
}
```

## Report History

### `GET /api/donor-projects/[id]/report/history`
**Roles**: GVI_FINANCE_ADMIN
**Response**: `{ data: DonorReport[] }` (chronological, most recent first)

### `GET /api/donor-projects/[id]/report/history/[reportId]/download`
**Roles**: GVI_FINANCE_ADMIN
**Response**: Binary file stream (PDF or Excel) with Content-Disposition

### `POST /api/donor-projects/[id]/report/history/[reportId]/regenerate`
**Roles**: GVI_FINANCE_ADMIN
**Response**: `{ data: DonorReport }` (201) — new report with same params, current data
