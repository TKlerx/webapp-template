# Data Model: Receipt Review & Audit Dashboard

**Date**: 2026-03-20

## Schema Changes

### New Enum

```
enum ReviewStatus { PENDING_REVIEW, APPROVED, FLAGGED, REJECTED }
```

### Modified Models

#### Receipt (from Feature 1)
Add fields:

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| reviewStatus | ReviewStatus | @default(PENDING_REVIEW) | Current review state |

New relations: → ReviewComment[], ReceiptRevision[]

### New Models

#### ReviewComment
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| receiptId | String | FK → Receipt | |
| authorId | String | FK → User | Reviewer or submitter |
| text | String | | Comment content |
| createdAt | DateTime | @default(now()) | |

Relations: → Receipt, User

#### ReceiptRevision
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| receiptId | String | FK → Receipt | |
| uploadedById | String | FK → User | |
| fileName | String | | Original filename |
| filePath | String | | Stored path (immutable) |
| fileSize | Int | | Bytes |
| mimeType | String | | |
| createdAt | DateTime | @default(now()) | |

Relations: → Receipt, User

### Extended AuditAction Enum (from Feature 1)

Add values:
```
RECEIPT_REVIEWED    // approve, flag, reject
RECEIPT_COMMENTED   // comment added
RECEIPT_REVISED     // corrected file uploaded
```

## State Transitions

### ReviewStatus
```
PENDING_REVIEW → APPROVED     (GVI Finance Admin, no comment required)
PENDING_REVIEW → FLAGGED      (GVI Finance Admin, comment required)
PENDING_REVIEW → REJECTED     (GVI Finance Admin, comment required)
FLAGGED        → PENDING_REVIEW (Country Finance responds: comment or revision)
APPROVED       → FLAGGED      (GVI Finance Admin, comment required)
REJECTED       → FLAGGED      (GVI Finance Admin, comment required)
```

## Validation Rules

1. **Flag/Reject requires comment**: ReviewComment must be created when status changes to FLAGGED or REJECTED.
2. **Approve needs no comment**: Status can change to APPROVED without a comment.
3. **Country Finance response**: Can only respond (comment/revision) when status is FLAGGED. Response auto-sets status to PENDING_REVIEW.
4. **Country Finance cannot respond to REJECTED**: Must upload a new receipt instead.
5. **Corrected file validation**: Same rules as original upload (PDF/JPEG/PNG, ≤20 MB).
6. **Country Admin read-only**: Can view review status and comments but cannot perform review actions.
