# Implementation Plan: Receipt Review & Audit Dashboard

**Branch**: `002-review-audit-dashboard` | **Date**: 2026-03-20 | **Spec**: [spec.md](spec.md)

## Summary

Add review workflow (approve/flag/reject) to receipts, a two-way comment system between reviewers and submitters, corrected file uploads for flagged receipts, a full audit trail viewer with CSV/PDF export, and a compliance dashboard showing budget vs. actual with review status aggregation. Extends the Receipt model from Feature 1 with review status, comments, and file revisions.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16 (App Router)
**Primary Dependencies**: Prisma 7, next-intl 4.8, Tailwind CSS 4 (existing). New: PDF generation library (e.g., @react-pdf/renderer or pdfmake), CSV export (json2csv or manual).
**Storage**: SQLite via Prisma. File storage reuses Feature 1's `uploads/` infrastructure for corrected files.
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Web application
**Performance Goals**: Filtering <3s, compliance dashboard <5s for 30 countries
**Constraints**: ~10 users, shared review queue (no assignment)
**Scale/Scope**: Up to 30 countries, thousands of receipts, 10 years of audit data

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | ✅ Pass | Linear state machine (no parallel workflows). Shared queue, no assignment. |
| II. Test Coverage | ✅ Pass | Unit tests for state transitions, E2E for review workflow. |
| III. Duplication Control | ✅ Pass | Reuses audit service from Feature 1. |
| IV. Incremental Delivery | ✅ Pass | P1 review workflow first, then audit viewer, then compliance dashboard. |
| V. Azure OpenAI | N/A | |
| VI. Web App Standards | ✅ Pass | Toast notifications for review actions. |
| VII. i18n | ✅ Pass | All review/audit UI text via translation keys. |
| VIII. Responsive | ✅ Pass | Review dashboard and compliance views responsive. |

## Project Structure

### Source Code

```text
src/
├── app/
│   ├── api/
│   │   ├── receipts/[id]/
│   │   │   ├── review/           # POST: approve/flag/reject
│   │   │   ├── comments/         # GET/POST: review comments
│   │   │   └── revisions/        # POST: corrected file upload
│   │   ├── audit/
│   │   │   ├── route.ts          # GET: filtered audit entries
│   │   │   └── export/           # GET: CSV/PDF export
│   │   └── compliance/           # GET: dashboard aggregation
│   ├── (dashboard)/
│   │   ├── review/               # Review dashboard (filterable list)
│   │   │   └── [receiptId]/      # Receipt detail with inline file viewer
│   │   ├── audit-trail/          # Audit log viewer with filters + export
│   │   └── compliance/           # Compliance dashboard with drill-down
├── components/
│   ├── review/
│   │   ├── ReviewDashboard.tsx   # Filterable receipt list for review
│   │   ├── ReceiptReviewDetail.tsx # File viewer + metadata + review actions
│   │   ├── ReviewActions.tsx     # Approve/Flag/Reject buttons + comment input
│   │   ├── CommentThread.tsx     # Chronological comments display
│   │   └── FileRevisionViewer.tsx # Side-by-side original + corrected files
│   ├── audit/
│   │   ├── AuditTrailViewer.tsx  # Filterable audit log
│   │   └── AuditExportButton.tsx # CSV/PDF export trigger
│   ├── compliance/
│   │   ├── ComplianceDashboard.tsx # Country summary cards
│   │   └── BudgetDrillDown.tsx   # Hierarchy with review status counts
│   └── ui/
│       ├── FileViewer.tsx        # Inline PDF/image viewer component
│       └── StatusBadge.tsx       # Review status badge component
├── lib/
│   ├── review.ts                 # Review state machine + validation
│   ├── audit-export.ts           # CSV/PDF generation for audit trail
│   └── compliance.ts             # Aggregation queries for dashboard
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Audit trail CSV/PDF export | Required for Finanzamt/donor auditors (FR-013a) | In-app only view insufficient for external audit requirements |
