# Research: Budget Planning & Core Data Model

**Date**: 2026-03-20
**Feature**: [spec.md](spec.md) | [plan.md](plan.md)

## R1: Role Migration Strategy

**Decision**: Replace existing enum `Role(ADMIN, MARKETER_LEAD, MARKETER, REVIEWER)` with `Role(GVI_FINANCE_ADMIN, COUNTRY_ADMIN, COUNTRY_FINANCE)`. Add a `UserCountryAssignment` join table for many-to-many user↔country relationships.

**Rationale**: The existing roles are placeholder leftovers from the marketing-agent app. A clean rename avoids confusion. The join table supports the clarified requirement that a single user can hold a role for multiple countries.

**Alternatives considered**:
- Keep old roles and map them → rejected: creates ongoing confusion and doesn't support country-scoped access
- Single `countryId` on User → rejected: doesn't support multi-country assignment (clarification confirmed users can be assigned to multiple countries)

**Migration impact**: Existing seed data creates one ADMIN user. Migration will map ADMIN → GVI_FINANCE_ADMIN. Other old roles have no users and can be dropped.

## R2: File Storage for Receipts (Immutable, 10-Year Retention)

**Decision**: Store receipt files on the local filesystem under an `uploads/` directory at project root. Files are named with a UUID to prevent collisions and ensure immutability. The file path is stored in the database. No delete API is exposed.

**Rationale**: For a ~10-user system with 20 MB max uploads, local filesystem is the simplest approach. SQLite doesn't handle large blobs well. The filesystem path can later be swapped to Azure Blob Storage when Docker/cloud deployment is configured.

**Alternatives considered**:
- Store as binary blob in SQLite → rejected: poor performance with large files, bloats database
- Azure Blob Storage immediately → rejected: adds external dependency and complexity before deployment architecture is decided
- S3-compatible storage → rejected: same as above, over-engineering for current scale

**Implementation**:
- `uploads/` directory created at startup if missing
- Files saved as `uploads/{year}/{month}/{uuid}.{ext}`
- Original filename stored in database for display
- No delete endpoint; admin cannot remove files
- `.gitignore` excludes `uploads/`
- `file-storage.ts` service with `saveFile(buffer, originalName) → storedPath` and `getFilePath(storedPath) → absolutePath`

## R3: Self-Referencing Hierarchy for Budget Items

**Decision**: Use Prisma self-relation with `parentId` field on `BudgetItem`. Queries use recursive CTEs (via raw SQL) for roll-up calculations, and simple `include: { children: true }` for single-level tree loading.

**Rationale**: Self-referencing parent-child is the standard pattern for unlimited-depth hierarchies. Prisma supports this natively. Roll-up calculations (sum of all descendant receipts) need recursive queries which SQLite supports via `WITH RECURSIVE`.

**Alternatives considered**:
- Materialized path (e.g., `/root/personnel/salaries`) → rejected: more complex to maintain on moves, Prisma doesn't natively support path queries
- Nested set model → rejected: complex updates on insert/move, over-engineering for this scale
- Closure table → rejected: additional join table complexity, not needed at this scale (<500 items per country)

**Implementation**:
- `BudgetItem` has optional `parentId` → self-relation
- Tree loading: fetch all items for a country budget, build tree client-side (simple and efficient for <500 items)
- Roll-up calculation: `WITH RECURSIVE` CTE in a Prisma raw query, or compute client-side from the flat list
- Child sum validation: computed at save time by querying siblings

## R4: Budget Proposal Workflow

**Decision**: Implement as a `BudgetProposal` model with status (PENDING, APPROVED, REJECTED). Country Admins create proposals; GVI Finance Admins approve/reject. On approval, the proposed changes are applied to the actual budget items.

**Rationale**: This is the simplest approach that satisfies FR-005a. A proposal captures the intended change (add/edit/remove) as a JSON payload, and approval triggers the actual mutation.

**Alternatives considered**:
- Shadow/draft budget items with a "draft" flag → rejected: complicates queries for all other features that read budget items
- Git-style branching of budget data → rejected: massively over-engineered for this use case

**Implementation**:
- `BudgetProposal` model: id, countryBudgetId, proposedBy (userId), type (ADD/EDIT/REMOVE), payload (JSON with proposed values), targetBudgetItemId (nullable, for EDIT/REMOVE), status (PENDING/APPROVED/REJECTED), reviewedBy, reviewComment, timestamps
- API: Country Admins POST to `/api/budget-proposals`, GVI Finance Admins PATCH to approve/reject
- On approval: service applies the change (creates/updates/deletes the budget item)
- Audit trail records both the proposal and the approval action

## R5: Audit Trail Design

**Decision**: Single `AuditEntry` model storing structured log entries. All mutation endpoints call an `audit.log()` helper after successful database writes.

**Rationale**: A single table with typed `action` field and JSON `details` is flexible enough for all auditable actions (budget changes, receipt uploads, role changes, donor tagging) without creating separate audit tables per entity.

**Alternatives considered**:
- Separate audit tables per entity → rejected: duplication, harder to query across types
- Event sourcing → rejected: massive over-engineering for a 10-user system
- Database triggers → rejected: Prisma/SQLite doesn't support triggers well, and we need application-level context (actor, session)

**Implementation**:
- `AuditEntry`: id, action (enum), entityType, entityId, actorId, timestamp, details (JSON with before/after values), countryId (for scoped queries)
- `audit.ts` service: `logAudit({ action, entityType, entityId, actorId, details, countryId })`
- Called in API route handlers after successful mutations
- Queryable via `/api/audit` (GVI Finance Admins only, with filters)

## R6: Donor Project Tagging (Cross-Country)

**Decision**: `DonorProjectTag` is a polymorphic join table that can reference either a `BudgetItem` or a `Receipt`. Donor projects are not scoped to a single country.

**Rationale**: The clarification confirmed donor projects can span multiple countries. Budget item tagging provides implicit receipt inclusion (all receipts under the tagged item and descendants are included). Individual receipt tagging provides explicit inclusion regardless of budget item tags.

**Implementation**:
- `DonorProjectTag` has `donorProjectId`, optional `budgetItemId`, optional `receiptId` (exactly one must be set)
- Query for "all receipts in a donor project": union of (receipts under tagged budget items via recursive CTE) + (directly tagged receipts)
- Tagging UI: on the budget item detail or receipt detail page, admin can select donor projects to tag

## R7: Next.js File Upload Handling

**Decision**: Use Next.js API routes with `FormData` parsing. The App Router in Next.js 16 supports `request.formData()` natively.

**Rationale**: No external upload library needed. Next.js handles multipart form data natively.

**Implementation**:
- Receipt upload API: `POST /api/receipts` accepts `FormData` with file + metadata fields
- Server-side: parse FormData, validate file type and size (20 MB), save via `file-storage.ts`, create receipt record
- Client-side: `ReceiptUploadForm` component uses `<input type="file" accept=".pdf,.jpg,.jpeg,.png">` with preview
- File serving: `GET /api/receipts/[id]/file` streams the file from disk with proper content-type headers
