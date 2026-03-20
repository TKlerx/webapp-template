# Research: Donor Project Reporting

**Date**: 2026-03-20

## R1: PDF Generation Library

**Decision**: Use `pdfmake` for server-side PDF generation.

**Rationale**: pdfmake works server-side in Node.js, supports tables, headers/footers, page numbers, and custom fonts — all needed for a branded financial report. It uses a declarative document definition (JSON-like) which is easy to build programmatically.

**Alternatives considered**:
- @react-pdf/renderer → rejected: React-based, better for client-side; adds React rendering overhead on server
- puppeteer/headless Chrome → rejected: heavy dependency, requires Chrome binary in deployment
- jsPDF → rejected: lower-level API, more code for complex table layouts

## R2: Excel Generation Library

**Decision**: Use `exceljs` for server-side Excel (.xlsx) generation.

**Rationale**: exceljs supports worksheets, styling, number formatting, and formulas — needed for structured financial data sheets. Produces standard .xlsx files.

**Alternatives considered**:
- xlsx (SheetJS) → rejected: community edition has limited styling; pro version is paid
- csv-only → rejected: spec requires Excel with structured sheets

## R3: Multi-Currency Handling in Reports

**Decision**: Group financial summaries by currency. Each currency gets its own subtotal row. No conversion.

**Rationale**: Clarification confirmed: display in original currencies with per-currency subtotals. Daily exchange rate conversion is a future feature.

**Implementation**:
- Report data aggregation groups receipts by currency
- Summary section: one row per currency (e.g., "EUR: €32,000 of €50,000 allocated", "KES: KSh 150,000 of KSh 500,000")
- Budget breakdown: amounts shown in the budget's currency; receipts in their original currency

## R4: Report Language Selection

**Decision**: Report content (headers, labels, notes) uses the selected language. Data (names, descriptions) remains as stored. Uses the same i18n message files but loaded server-side with the selected locale.

**Rationale**: The 5 supported locales already have translation infrastructure via next-intl. Report-specific keys are added to the existing message files.

## R5: Report Storage and History

**Decision**: Store generated report files (PDF/Excel) in `uploads/reports/{donorProjectId}/{uuid}.{ext}`. Metadata (parameters, generation date, preparer) stored in a `DonorReport` database model.

**Rationale**: Storing the actual generated file ensures the report reflects data at generation time. Re-generation creates a new file with current data.

## R6: Receipt Image Appendix

**Decision**: When the "include images" toggle is on, append receipt files as additional pages in the PDF. Images are embedded directly; PDFs are converted to images first (or referenced as attachment links if conversion is too complex).

**Rationale**: For simplicity, start with embedding JPEG/PNG images as appendix pages. PDF receipts get a reference link in the appendix rather than embedded pages (PDF-in-PDF is complex). Can improve later.
