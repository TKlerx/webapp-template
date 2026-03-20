# Data Model: Budget Planning & Core Data Model

**Date**: 2026-03-20
**Feature**: [spec.md](spec.md) | [plan.md](plan.md)

## Schema Changes

### Enum Changes

**Replace** existing `Role` enum:
```
// OLD
enum Role { ADMIN, MARKETER_LEAD, MARKETER, REVIEWER }

// NEW
enum Role { GVI_FINANCE_ADMIN, COUNTRY_ADMIN, COUNTRY_FINANCE }
```

**New** enums:
```
enum ProposalType { ADD, EDIT, REMOVE }
enum ProposalStatus { PENDING, APPROVED, REJECTED }
enum AuditAction {
  BUDGET_YEAR_CREATED, BUDGET_YEAR_UPDATED, BUDGET_YEAR_DELETED
  COUNTRY_BUDGET_CREATED, COUNTRY_BUDGET_UPDATED, COUNTRY_BUDGET_DELETED
  BUDGET_ITEM_CREATED, BUDGET_ITEM_UPDATED, BUDGET_ITEM_DELETED, BUDGET_ITEM_MOVED
  RECEIPT_UPLOADED, RECEIPT_METADATA_UPDATED
  ROLE_CHANGED, COUNTRY_ASSIGNMENT_CHANGED
  DONOR_CREATED, DONOR_UPDATED
  DONOR_PROJECT_CREATED, DONOR_PROJECT_UPDATED
  DONOR_PROJECT_TAGGED, DONOR_PROJECT_UNTAGGED
  BUDGET_PROPOSAL_CREATED, BUDGET_PROPOSAL_APPROVED, BUDGET_PROPOSAL_REJECTED
  BUDGET_TEMPLATE_CREATED, BUDGET_TEMPLATE_UPDATED, BUDGET_TEMPLATE_DELETED, BUDGET_TEMPLATE_APPLIED
}
```

### New Models

#### ProgramCountry
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| name | String | @unique | Display name (e.g., "Kenya") |
| code | String | @unique | ISO 3166-1 alpha-2 (e.g., "KE") |
| createdAt | DateTime | @default(now()) | |
| updatedAt | DateTime | @updatedAt | |

Relations: → UserCountryAssignment[], CountryBudget[], AuditEntry[]

#### UserCountryAssignment
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| userId | String | FK → User | |
| countryId | String | FK → ProgramCountry | |
| createdAt | DateTime | @default(now()) | |

Constraints: @@unique([userId, countryId])
Relations: → User, ProgramCountry

#### BudgetYear
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| label | String | @unique | e.g., "2026" |
| startDate | DateTime | | Start of fiscal year |
| endDate | DateTime | | End of fiscal year |
| createdAt | DateTime | @default(now()) | |
| updatedAt | DateTime | @updatedAt | |

Relations: → CountryBudget[]

#### CountryBudget
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| budgetYearId | String | FK → BudgetYear | |
| countryId | String | FK → ProgramCountry | |
| totalAmount | Decimal | | Total allocated budget |
| currency | String | | ISO 4217 (e.g., "EUR", "KES") |
| createdAt | DateTime | @default(now()) | |
| updatedAt | DateTime | @updatedAt | |

Constraints: @@unique([budgetYearId, countryId])
Relations: → BudgetYear, ProgramCountry, BudgetItem[], BudgetProposal[]

#### BudgetItem
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| countryBudgetId | String | FK → CountryBudget | |
| parentId | String? | FK → BudgetItem (self) | null = root item |
| name | String | | e.g., "Personnel", "Fuel" |
| plannedAmount | Decimal | | Planned budget for this item |
| description | String? | | Optional description |
| sortOrder | Int | @default(0) | Display ordering within parent |
| createdAt | DateTime | @default(now()) | |
| updatedAt | DateTime | @updatedAt | |

Relations: → CountryBudget, parent BudgetItem?, children BudgetItem[], Receipt[], DonorProjectTag[]

#### Receipt
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| budgetItemId | String | FK → BudgetItem | |
| uploadedById | String | FK → User | |
| amount | Decimal | | Receipt amount |
| currency | String | | ISO 4217 |
| date | DateTime | | Receipt/expense date |
| description | String | | Brief description |
| fileName | String | | Original filename for display |
| filePath | String | | Stored path (immutable) |
| fileSize | Int | | File size in bytes |
| mimeType | String | | e.g., "application/pdf" |
| createdAt | DateTime | @default(now()) | |
| updatedAt | DateTime | @updatedAt | Tracks metadata edits |

Relations: → BudgetItem, User (uploader), DonorProjectTag[]

#### InstitutionalDonor
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| name | String | @unique | e.g., "European Union" |
| description | String? | | |
| createdAt | DateTime | @default(now()) | |
| updatedAt | DateTime | @updatedAt | |

Relations: → DonorProject[]

#### DonorProject
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| donorId | String | FK → InstitutionalDonor | |
| name | String | | e.g., "EU Grant 2026 - Kenya Education" |
| description | String? | | |
| createdAt | DateTime | @default(now()) | |
| updatedAt | DateTime | @updatedAt | |

Relations: → InstitutionalDonor, DonorProjectTag[]

#### DonorProjectTag
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| donorProjectId | String | FK → DonorProject | |
| budgetItemId | String? | FK → BudgetItem | Exactly one of budgetItemId/receiptId must be set |
| receiptId | String? | FK → Receipt | |
| createdAt | DateTime | @default(now()) | |

Relations: → DonorProject, BudgetItem?, Receipt?

#### BudgetProposal
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| countryBudgetId | String | FK → CountryBudget | |
| proposedById | String | FK → User | Country Admin who proposed |
| type | ProposalType | | ADD, EDIT, or REMOVE |
| targetBudgetItemId | String? | FK → BudgetItem | For EDIT/REMOVE; null for ADD |
| payload | String | | JSON: proposed values (name, amount, parentId, description) |
| status | ProposalStatus | @default(PENDING) | |
| reviewedById | String? | FK → User | GVI Finance Admin who reviewed |
| reviewComment | String? | | Reason for approval/rejection |
| createdAt | DateTime | @default(now()) | |
| updatedAt | DateTime | @updatedAt | |

Relations: → CountryBudget, User (proposer), User (reviewer), BudgetItem? (target)

#### AuditEntry
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| action | AuditAction | | Type of action |
| entityType | String | | e.g., "BudgetItem", "Receipt" |
| entityId | String | | ID of affected entity |
| actorId | String | FK → User | Who performed the action |
| countryId | String? | FK → ProgramCountry | For country-scoped queries |
| details | String | | JSON: before/after values, comments |
| createdAt | DateTime | @default(now()) | |

Relations: → User (actor), ProgramCountry?
Index: @@index([action]), @@index([entityType, entityId]), @@index([actorId]), @@index([countryId]), @@index([createdAt])

#### BudgetTemplate
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| name | String | @unique | e.g., "Standard Country Budget" |
| description | String? | | |
| createdById | String | FK → User | |
| createdAt | DateTime | @default(now()) | |
| updatedAt | DateTime | @updatedAt | |

Relations: → User (creator), BudgetTemplateItem[]

#### BudgetTemplateItem
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | |
| templateId | String | FK → BudgetTemplate | |
| parentId | String? | FK → BudgetTemplateItem (self) | null = root item |
| name | String | | e.g., "Personnel", "Fuel" |
| defaultAmount | Decimal | | Default planned amount |
| description | String? | | |
| sortOrder | Int | @default(0) | Display ordering within parent |

Relations: → BudgetTemplate, parent BudgetTemplateItem?, children BudgetTemplateItem[]

### Modified Models

#### User (existing)
Add relation: → UserCountryAssignment[]

Role enum values change from `ADMIN, MARKETER_LEAD, MARKETER, REVIEWER` to `GVI_FINANCE_ADMIN, COUNTRY_ADMIN, COUNTRY_FINANCE`.

## State Transitions

### BudgetProposal
```
PENDING → APPROVED (GVI Finance Admin approves → changes applied)
PENDING → REJECTED (GVI Finance Admin rejects with comment)
```

### Receipt (metadata only — file is always immutable)
```
Created → metadata editable (amount, date, description, budgetItemId)
Each edit recorded in AuditEntry with before/after values
```

## Validation Rules

1. **Budget item child sum**: Sum of children's `plannedAmount` must be ≤ parent's `plannedAmount`. Block save if exceeded; warn (client-side) if under.
2. **Budget item deletion**: Cannot delete a budget item that has receipts (directly or via descendants). Check recursively.
3. **Receipt file type**: Only `application/pdf`, `image/jpeg`, `image/png` accepted.
4. **Receipt file size**: Max 20 MB.
5. **Budget year uniqueness**: Label must be unique. No overlapping date ranges for the same country.
6. **Country budget uniqueness**: One budget per country per year (`@@unique([budgetYearId, countryId])`).
7. **Donor project tag**: Exactly one of `budgetItemId` or `receiptId` must be non-null (application-level validation).
8. **Country access**: Users with COUNTRY_ADMIN or COUNTRY_FINANCE roles can only access data for their assigned countries (enforced at API level).
9. **Template name uniqueness**: Template names must be unique.
10. **Template application is a copy**: Applying a template creates new BudgetItem records. No FK link between template items and budget items — they are independent after copy.
