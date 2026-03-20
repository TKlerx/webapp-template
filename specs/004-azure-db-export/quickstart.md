# Quickstart: Azure DB Export for Power BI

**Date**: 2026-03-20
**Prerequisites**: Features 1 and 2 implemented. Azure SQL Database provisioned and accessible.

## Setup

```bash
npm install mssql node-cron
```

Add to `.env`:
```
# Optional — can also be configured via UI
AZURE_SQL_HOST=your-server.database.windows.net
AZURE_SQL_DATABASE=gvi-powerbi
AZURE_SQL_USER=gvi-export
AZURE_SQL_PASSWORD=...
```

## Key Workflow

1. Log in as GVI Finance Admin → navigate to Export
2. Configure Azure DB credentials → Test Connection
3. Select categories: ✅ Budgets ✅ Receipts ✅ Donor Projects ✅ Audit Trail
4. Set filters: countries, budget years, date range
5. Click "Export Now" → monitor progress
6. Configure schedule: daily at 02:00 → Enable
7. Check Export History for run status

## Azure DB Schema

The export service automatically creates tables on first run:
- `dim_country`, `dim_budget_year`, `dim_budget_item`
- `fact_receipt`, `fact_audit`
- `dim_donor`, `dim_donor_project`, `bridge_donor_tag`
- `meta_export` (schema version tracking)

Power BI connects to these tables directly.
