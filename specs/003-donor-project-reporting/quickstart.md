# Quickstart: Donor Project Reporting

**Date**: 2026-03-20
**Prerequisites**: Features 1 and 2 implemented. Donor project with tagged budget items and receipts.

## Key Workflow

1. Log in as GVI Finance Admin
2. Navigate to Donors → select donor project
3. Click "Generate Report"
4. Configure: date range (Q1 2026), status filter (approved only), language (English), format (PDF)
5. Click "Preview" → review on-screen
6. Click "Export as PDF" → download
7. View report history → download previous reports or re-generate

## New Dependencies

```bash
npm install pdfmake exceljs
```

## File Storage

Generated reports stored in `uploads/reports/{donorProjectId}/{uuid}.{ext}`. Same retention policy as receipts (10 years).
