# Data Model: Azure DB Export for Power BI

**Date**: 2026-03-20

## New Models (Local SQLite)

#### ExportConfig
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| key | String | @unique | Config key name |
| value | String | | Value (encrypted for credentials) |
| updatedAt | DateTime | @updatedAt | |

#### ExportRun
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| triggeredById | String? | FK → User | null for scheduled runs |
| triggerType | String | | "manual" or "scheduled" |
| status | String | | "running", "success", "failed" |
| categoriesExported | String | | JSON array of category names |
| filters | String | | JSON: countries, years, dateSince |
| recordCounts | String? | | JSON: { budgets: N, receipts: N, ... } |
| errorMessage | String? | | Error details if failed |
| startedAt | DateTime | @default(now()) | |
| completedAt | DateTime? | | |

Relations: → User?

### Extended AuditAction Enum

Add: `EXPORT_TRIGGERED`, `EXPORT_COMPLETED`, `EXPORT_FAILED`, `EXPORT_CONFIG_CHANGED`

## Azure DB Tables (Target — created by export service)

See research.md R3 for full schema. Tables are created/managed by the export service via DDL statements, not by Prisma.

## Validation Rules

1. **Connection test**: Validate credentials before saving (attempt connection + simple query).
2. **Cron expression**: Must be valid cron syntax.
3. **Concurrent exports**: Only one export can run at a time (check ExportRun status).
4. **At least one category**: Export must include at least one data category.
