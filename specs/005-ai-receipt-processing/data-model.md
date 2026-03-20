# Data Model: AI Receipt Processing

**Date**: 2026-03-20

## New Models (Local SQLite via Prisma)

#### AiExtractionResult
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| receiptId | String | FK → Receipt, @unique | One extraction per receipt |
| extractedAmount | Float? | | AI-extracted amount |
| extractedCurrency | String? | | AI-extracted currency code |
| extractedDate | DateTime? | | AI-extracted date |
| extractedDescription | String? | | AI-extracted vendor/description |
| confidenceAmount | String? | | "high", "medium", "low" |
| confidenceCurrency | String? | | "high", "medium", "low" |
| confidenceDate | String? | | "high", "medium", "low" |
| confidenceDescription | String? | | "high", "medium", "low" |
| rawResponse | String? | | Full JSON response from AI |
| processingTimeMs | Int? | | Time taken for extraction |
| createdAt | DateTime | @default(now()) | |

Relations: → Receipt (one-to-one)

#### AiClassificationResult
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| receiptId | String | FK → Receipt, @unique | One classification per receipt |
| suggestions | String | | JSON array: [{ budgetItemId, confidence, reasoning }] |
| acceptedBudgetItemId | String? | FK → BudgetItem | Which suggestion the user accepted |
| createdAt | DateTime | @default(now()) | |

Relations: → Receipt (one-to-one), → BudgetItem? (accepted)

#### AiReviewNote
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| receiptId | String | FK → Receipt | Multiple notes per receipt |
| noteType | String | | "anomaly", "duplicate", "mismatch" |
| content | String | | Human-readable note text |
| severity | String | | "info", "warning" |
| linkedReceiptId | String? | FK → Receipt | For duplicate detection |
| createdAt | DateTime | @default(now()) | |

Relations: → Receipt (many-to-one), → Receipt? (linked duplicate)

## Extended Receipt Model

Add the following fields to the existing Receipt model (from Feature 1):

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| aiStatus | String | @default("none") | "none", "pending", "processing", "complete", "failed" |
| aiProcessedAt | DateTime? | | When AI processing completed |

## Extended AuditAction Enum

Add: `AI_EXTRACTION_COMPLETE`, `AI_EXTRACTION_FAILED`, `AI_CLASSIFICATION_ACCEPTED`

## Validation Rules

1. **One extraction per receipt**: AiExtractionResult has a unique constraint on receiptId.
2. **One classification per receipt**: AiClassificationResult has a unique constraint on receiptId.
3. **AI status transitions**: none → pending → processing → complete|failed. "none" means AI was not triggered (e.g., manual upload with AI unavailable).
4. **Confidence values**: Must be one of "high", "medium", "low" (validated at application level).
5. **Linked receipt for duplicates**: When noteType is "duplicate", linkedReceiptId should be set.
