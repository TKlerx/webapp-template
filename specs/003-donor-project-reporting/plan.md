# Implementation Plan: Donor Project Reporting

**Branch**: `003-donor-project-reporting` | **Date**: 2026-03-20 | **Spec**: [spec.md](spec.md)

## Summary

Add one-click donor project report generation with configurable parameters (date range, status filter, language), on-screen preview, PDF and Excel export (with optional receipt image appendix), and report history with re-generation. Builds on donor project tagging (Feature 1) and review statuses (Feature 2).

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16 (App Router)
**Primary Dependencies**: Existing stack + new: PDF generation (pdfmake or @react-pdf/renderer), Excel generation (exceljs or xlsx), i18n for report content.
**Storage**: SQLite via Prisma. Generated reports stored in `uploads/reports/` (same retention as receipts).
**Testing**: Vitest (unit), Playwright (E2E)
**Performance Goals**: Report generation <30s for 500 receipts
**Scale/Scope**: Reports span multiple countries/currencies, up to 500 receipts per report

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | ✅ Pass | Single report template, no custom per-donor templates. |
| II. Test Coverage | ✅ Pass | Unit tests for data aggregation, E2E for generation flow. |
| III. Duplication Control | ✅ Pass | Reuses compliance aggregation logic from Feature 2. |
| IV. Incremental Delivery | ✅ Pass | P1 generation+export first, then preview, then history. |
| V. Azure OpenAI | N/A | |
| VI. Web App Standards | ✅ Pass | |
| VII. i18n | ✅ Pass | Reports generated in selectable language. |
| VIII. Responsive | ✅ Pass | Report config UI responsive; preview adapts. |

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   └── donor-projects/[id]/
│   │       ├── report/            # POST: generate, GET: preview data
│   │       ├── report/export/     # GET: PDF or Excel download
│   │       └── report/history/    # GET: list, GET [historyId]: download
│   ├── (dashboard)/
│   │   └── donors/[id]/
│   │       └── report/            # Report config + preview + export page
├── components/
│   └── reports/
│       ├── ReportConfigForm.tsx   # Parameters: date range, status, language, format
│       ├── ReportPreview.tsx      # On-screen preview matching export layout
│       ├── ReportSummary.tsx      # Financial summary with per-currency subtotals
│       ├── BudgetBreakdownTable.tsx # Budget item breakdown
│       ├── ReceiptListTable.tsx   # Individual receipts
│       └── ReportHistory.tsx      # History list with download/re-generate
├── lib/
│   ├── report-generator.ts       # Core report data aggregation
│   ├── report-pdf.ts             # PDF rendering with GVI branding
│   ├── report-excel.ts           # Excel workbook generation
│   └── report-i18n.ts            # Report-specific translations (independent of UI locale)
```
