# Research: Receipt Review & Audit Dashboard

**Date**: 2026-03-20

## R1: Review State Machine

**Decision**: Add `reviewStatus` enum to Receipt model: `PENDING_REVIEW`, `APPROVED`, `FLAGGED`, `REJECTED`. All transitions allowed for GVI Finance Admins. Country Finance can only trigger FLAGGED→PENDING_REVIEW (by responding).

**Rationale**: Simple linear state machine. No parallel workflows. Unlimited flag-respond cycles (clarification). Rejection is final for submitters, but admins can reopen to FLAGGED.

**State transitions**:
- New receipt → PENDING_REVIEW (automatic)
- PENDING_REVIEW → APPROVED | FLAGGED | REJECTED (GVI Finance Admin)
- FLAGGED → PENDING_REVIEW (Country Finance responds with comment or corrected file)
- APPROVED → FLAGGED (GVI Finance Admin changes mind)
- REJECTED → FLAGGED (GVI Finance Admin reopens)

## R2: Comment and Revision System

**Decision**: `ReviewComment` model linked to a receipt, with actor, text, and optional file revision reference. `ReceiptRevision` model stores corrected file uploads linked to the same receipt.

**Rationale**: Keeping comments and file revisions as separate models allows clean chronological display and preserves all original files for audit purposes. Comments from both reviewers and submitters appear in a single thread.

**Implementation**:
- `ReviewComment`: id, receiptId, authorId, text, createdAt
- `ReceiptRevision`: id, receiptId, uploadedById, fileName, filePath, fileSize, mimeType, createdAt
- Original file stays on Receipt model; revisions are additional files
- Comment thread shows all comments + revision uploads in chronological order

## R3: Inline File Viewer

**Decision**: Use native browser capabilities for inline viewing. `<img>` tag for JPEG/PNG, `<iframe>` or `<embed>` for PDF. No external viewer library needed.

**Rationale**: Browser-native rendering is simplest and works for the three supported file types (JPEG, PNG, PDF). No additional dependencies.

## R4: Audit Trail Export (CSV/PDF)

**Decision**: Server-side generation. CSV via simple string concatenation (no library needed for flat tabular data). PDF via a lightweight library (pdfmake or jspdf) — evaluate during implementation; start with CSV as MVP.

**Rationale**: CSV is the primary format for auditors who import into Excel. PDF is a secondary format for formal documentation. Both apply current filters.

**Alternatives considered**:
- Client-side generation → rejected: audit data could be large (10 years), and server-side ensures consistent output
- Excel export → rejected: CSV is universally compatible and sufficient for audit purposes; Excel export is in Feature 3

## R5: Compliance Dashboard Aggregation

**Decision**: Server-side aggregation query returning per-country summaries and per-budget-item breakdowns. Two API endpoints: one for the country-level summary, one for the drill-down.

**Rationale**: Aggregating receipt amounts by review status across the budget hierarchy requires recursive queries (same pattern as Feature 1's roll-up calculations). Server-side keeps the logic in one place.

**Implementation**:
- `GET /api/compliance` → array of country summaries (total budget, approved spend, total spend, status counts)
- `GET /api/compliance/[countryBudgetId]` → budget hierarchy with per-item aggregation
- Approved spend = sum of receipts with APPROVED status (primary figure)
- Total spend = sum of all receipts regardless of status (secondary)
- Status filter param allows slicing (FR-014a)
