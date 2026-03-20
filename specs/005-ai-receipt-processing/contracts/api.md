# API Contracts: AI Receipt Processing

**Date**: 2026-03-20

## Extraction

### `POST /api/receipts/[id]/ai-extract`
**Auth**: COUNTRY_FINANCE, COUNTRY_ADMIN, GVI_FINANCE_ADMIN (receipt owner or admin)
**Body**: None (uses the receipt's uploaded file)
**Response**: `{ data: { status: "processing" } }` (202)
**Note**: Typically triggered automatically on receipt upload. Can be re-triggered manually if initial extraction failed.

### `GET /api/receipts/[id]/ai-extract`
**Auth**: Same as above
**Response**: `{ data: AiExtractionResult | null }` (200)
**Note**: Returns null if extraction hasn't run yet. Includes confidence scores per field.

## Classification

### `GET /api/receipts/[id]/ai-classify`
**Auth**: COUNTRY_FINANCE, COUNTRY_ADMIN, GVI_FINANCE_ADMIN
**Response**: `{ data: { suggestions: [{ budgetItemId, budgetItemName, fullPath, confidence, reasoning }] } }` (200)
**Note**: Returns up to 3 suggestions ranked by confidence. Empty array if classification hasn't run.

### `POST /api/receipts/[id]/ai-classify/accept`
**Auth**: COUNTRY_FINANCE, COUNTRY_ADMIN, GVI_FINANCE_ADMIN
**Body**: `{ budgetItemId: string }`
**Response**: `{ data: { receiptId, budgetItemId } }` (200)
**Note**: Records which suggestion was accepted (or user's manual override). Updates the receipt's budget item assignment.

## Review Notes

### `GET /api/receipts/[id]/ai-review`
**Auth**: GVI_FINANCE_ADMIN
**Response**: `{ data: AiReviewNote[] }` (200)
**Note**: Returns all AI-generated review notes for this receipt. Empty array if no issues found or review analysis hasn't run.

## Status

### `GET /api/receipts/[id]`
**Extended Response**: The existing receipt endpoint now includes `aiStatus` field ("none", "pending", "processing", "complete", "failed") and `aiProcessedAt` timestamp.
**Note**: Client polls this endpoint while aiStatus is "pending" or "processing".
