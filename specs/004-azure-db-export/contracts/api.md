# API Contracts: Azure DB Export for Power BI

**Date**: 2026-03-20

All endpoints: GVI_FINANCE_ADMIN only.

### `POST /api/export`
**Body**: `{ categories?: string[], filters?: { countries?: string[], budgetYears?: string[], dateSince?: string } }`
**Note**: Uses saved config if params not provided
**Response**: `{ data: ExportRun }` (201, status "running")

### `GET /api/export/config`
**Response**: `{ data: { host, database, user, port, categories, filters } }` (password excluded)

### `PUT /api/export/config`
**Body**: `{ host?, database?, user?, password?, port?, categories?, filters? }`
**Response**: `{ data: ExportConfig }` (password masked in response)

### `POST /api/export/test-connection`
**Body**: `{ host, database, user, password, port }`
**Response**: `{ data: { success: boolean, message: string } }`

### `GET /api/export/schedule`
**Response**: `{ data: { enabled: boolean, cronExpression: string, lastRunAt?: string } }`

### `PUT /api/export/schedule`
**Body**: `{ enabled: boolean, cronExpression: string }`
**Response**: `{ data: ExportSchedule }`

### `GET /api/export/history?status=X&page=N&limit=M`
**Response**: `{ data: ExportRun[], total: number }`

### `GET /api/export/history/[id]`
**Response**: `{ data: ExportRun }` (full details including recordCounts and errorMessage)
