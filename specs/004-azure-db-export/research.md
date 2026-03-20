# Research: Azure DB Export for Power BI

**Date**: 2026-03-20

## R1: Azure SQL Database Connectivity

**Decision**: Use the `mssql` npm package (built on `tedious`) for connecting to Azure SQL Database.

**Rationale**: `mssql` is the standard Node.js library for SQL Server / Azure SQL. Supports connection pooling, transactions, and parameterized queries. Well-maintained, widely used.

**Alternatives considered**:
- Prisma with SQL Server provider → rejected: we'd need a second Prisma client instance with different provider, adds complexity. Direct SQL is simpler for bulk writes.
- ODBC driver → rejected: requires native binary, complicates deployment

## R2: Export Strategy

**Decision**: Full-replace per selected category within the configured scope. Use SQL transactions for atomicity: BEGIN TRAN → TRUNCATE target tables → INSERT new data → COMMIT. On failure, ROLLBACK leaves previous data intact.

**Rationale**: Clarification confirmed configurable categories and date range. Full-replace per slice is simpler than change tracking and guarantees consistency. Transaction ensures atomicity.

**Implementation**:
- Export categories: budgets (years + countries + items), receipts, donor_projects (donors + projects + tags), audit_trail
- Each category maps to one or more Azure DB tables
- Within a transaction: truncate category tables → bulk insert → commit
- Date range filter: for receipts and audit, only export records within the "since" date
- Country/year filters: restrict scope of all categories

## R3: Azure DB Schema Design (Denormalized for Power BI)

**Decision**: Denormalized flat tables optimized for Power BI. No foreign keys in Azure DB — Power BI builds its own relationships via shared key columns.

**Tables**:
- `dim_country` (id, name, code)
- `dim_budget_year` (id, label, start_date, end_date)
- `dim_budget_item` (id, country_budget_id, parent_id, name, planned_amount, full_path, depth)
- `fact_receipt` (id, budget_item_id, country_id, budget_year_id, amount, currency, date, description, review_status, submitter_name, uploaded_at)
- `dim_donor` (id, name)
- `dim_donor_project` (id, donor_id, donor_name, name)
- `bridge_donor_tag` (donor_project_id, budget_item_id, receipt_id)
- `fact_audit` (id, action, entity_type, entity_id, actor_name, actor_email, country_id, details, created_at)

Schema version tracked in a `meta_export` table: (key, value) with entries for schema_version and last_export_at.

## R4: Scheduling Mechanism

**Decision**: Use `node-cron` for in-process scheduling. Schedule config stored in database.

**Rationale**: For a single-instance app with at-most-daily exports, in-process cron is sufficient. No need for external scheduler (like Azure Functions or system cron).

**Alternatives considered**:
- System cron calling an API endpoint → rejected: requires OS-level configuration, harder to manage via UI
- Azure Functions → rejected: adds external service dependency for a simple timer
- Next.js API route called by external timer → viable alternative but adds deployment complexity

**Implementation**:
- `ExportSchedule` config stored in DB: enabled (boolean), cronExpression (string), lastRunAt
- On app startup, load schedule and register with node-cron
- Schedule changes via API update DB + re-register cron job
- Cron callback calls the same export service as manual trigger

## R5: Export Configuration Storage

**Decision**: Store export config (credentials, schedule, category toggles, filters) in the `ExportConfiguration` table as key-value pairs. Credentials encrypted at rest using the BETTER_AUTH_SECRET.

**Rationale**: Flexible key-value storage avoids schema changes for new config options. Encryption uses the existing app secret.

**Implementation**:
- `ExportConfig` model: id, key (unique), value (encrypted for sensitive fields), updatedAt
- Keys: `azure_host`, `azure_database`, `azure_user`, `azure_password` (encrypted), `azure_port`, `categories_budgets`, `categories_receipts`, `categories_donors`, `categories_audit`, `filter_countries`, `filter_budget_years`, `filter_date_since`, `schedule_enabled`, `schedule_cron`
