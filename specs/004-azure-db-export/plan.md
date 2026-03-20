# Implementation Plan: Azure DB Export for Power BI

**Branch**: `004-azure-db-export` | **Date**: 2026-03-20 | **Spec**: [spec.md](spec.md)

## Summary

Add manual and scheduled export of financial data + audit trail to Azure SQL Database for Power BI consumption. Configurable data categories, date range filters, country/year filters. Export history with monitoring. Atomic exports (transaction-based).

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16 (App Router)
**Primary Dependencies**: Existing stack + new: `mssql` (tedious) for Azure SQL Database connectivity. `node-cron` or `cron` for scheduled exports.
**Storage**: Source: SQLite via Prisma. Target: Azure SQL Database (external).
**Testing**: Vitest (unit with mocked SQL connection), E2E with test Azure DB or mock
**Performance Goals**: Export 10,000 receipts in <5 minutes
**Constraints**: Atomic exports, no partial writes. At most daily frequency.

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | ✅ Pass | Full-replace per category (no change tracking). Direct SQL inserts. |
| II. Test Coverage | ✅ Pass | Mock Azure DB for unit tests; integration test with real DB if configured. |
| III. Duplication Control | ✅ Pass | Single export service handles all categories. |
| IV. Incremental Delivery | ✅ Pass | P1 manual export first, then scheduling, then monitoring. |
| V. Azure OpenAI | N/A | |
| VI. Web App Standards | ✅ Pass | |
| VII. i18n | ✅ Pass | Export config UI translated. |
| VIII. Responsive | ✅ Pass | |

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   └── export/
│   │       ├── route.ts          # POST: trigger manual export
│   │       ├── config/           # GET/PUT: export configuration
│   │       ├── schedule/         # GET/PUT: schedule config
│   │       ├── history/          # GET: export history
│   │       └── test-connection/  # POST: validate Azure DB credentials
│   ├── (dashboard)/
│   │   └── export/               # Export management page
├── components/
│   └── export/
│       ├── ExportConfigForm.tsx  # Credentials, categories, filters
│       ├── ExportScheduleForm.tsx # Frequency and time
│       ├── ExportHistory.tsx     # History list with status
│       └── ExportProgress.tsx    # Progress indicator during export
├── lib/
│   ├── azure-db.ts              # Azure SQL connection management
│   ├── export-service.ts        # Core export logic (read local, write remote)
│   ├── export-schema.ts         # Azure DB table definitions (DDL)
│   ├── export-scheduler.ts      # Cron-based scheduling
│   └── export-transforms.ts     # Data denormalization for Power BI
```
