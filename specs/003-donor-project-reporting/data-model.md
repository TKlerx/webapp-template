# Data Model: Donor Project Reporting

**Date**: 2026-03-20

## New Models

#### DonorReport
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| donorProjectId | String | FK → DonorProject | |
| generatedById | String | FK → User | Who generated |
| dateFrom | DateTime | | Reporting period start |
| dateTo | DateTime | | Reporting period end |
| statusFilter | String | | "approved" or "all" |
| language | String | | Report language (en/de/es/fr/pt) |
| includeImages | Boolean | @default(false) | Include receipt images in PDF |
| format | String | | "pdf" or "xlsx" |
| filePath | String | | Path to stored report file |
| fileName | String | | Display filename |
| fileSize | Int | | Bytes |
| receiptCount | Int | | Number of receipts included |
| createdAt | DateTime | @default(now()) | |

Relations: → DonorProject, User

### Extended AuditAction Enum

Add: `DONOR_REPORT_GENERATED`

## No State Transitions

Reports are immutable once generated. Re-generation creates a new DonorReport record.

## Validation Rules

1. **Date range**: dateTo must be after dateFrom.
2. **Language**: Must be one of en, de, es, fr, pt.
3. **Format**: Must be "pdf" or "xlsx".
4. **Donor project must have tagged items**: Block generation if no budget items or receipts are tagged.
