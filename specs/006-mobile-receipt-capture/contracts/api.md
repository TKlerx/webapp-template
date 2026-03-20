# API Contracts: Mobile Receipt Capture

**Date**: 2026-03-20

No new server-side API endpoints are required. The mobile capture workflow uses the existing endpoints from Feature 1:

### Existing Endpoints Used

#### `POST /api/receipts` (from Feature 1)
**Auth**: COUNTRY_FINANCE, COUNTRY_ADMIN
**Body**: Multipart form data with receipt image file + metadata
**Response**: `{ data: Receipt }` (201)
**Note**: Mobile capture uploads the camera-captured JPEG via this same endpoint. The `captureSource` field is set to `"camera"` to distinguish from desktop uploads.

#### `GET /api/receipts/[id]` (from Feature 1)
**Auth**: Receipt owner or admin
**Response**: `{ data: Receipt }` (200)
**Note**: Used after upload to check AI processing status (if Feature 5 is active).

### Client-Side Contracts (IndexedDB)

The mobile capture workflow is primarily client-side. The following operations are handled in `capture-store.ts`:

- `saveCapture(imageBlob, sessionId)` → stores image in IndexedDB
- `getCapturesBySession(sessionId)` → retrieves all captures in a batch session
- `getPendingUploads()` → retrieves all captures with status "captured"
- `updateCaptureStatus(id, status, receiptId?)` → updates upload status
- `deleteCapture(id)` → removes capture after successful submission
- `cleanupOldCaptures(maxAgeDays)` → removes stale entries

### Service Worker Events

- `sync:upload-receipts` — triggered when connectivity restored; processes pending upload queue
