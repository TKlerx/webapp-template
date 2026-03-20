# Data Model: Mobile Receipt Capture

**Date**: 2026-03-20

## Client-Side Storage (IndexedDB — not Prisma)

#### CapturedImage (IndexedDB object store)
| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID, generated client-side |
| imageBlob | Blob | Captured image data (JPEG) |
| thumbnailBlob | Blob | Smaller preview for list display |
| capturedAt | Date | Client-side timestamp |
| status | string | "captured", "uploading", "uploaded", "failed" |
| receiptId | string? | Set after server-side receipt creation |
| sessionId | string | Groups images from same batch capture |
| retryCount | number | Upload retry attempts |
| lastError | string? | Last upload error message |

**Note**: This data lives only on the user's device. It is temporary — entries are cleaned up after successful receipt submission.

## Server-Side Changes (Prisma)

No new server-side models required. The mobile capture workflow uses the existing Receipt model and file upload endpoint from Feature 1. The uploaded image is stored in the same `uploads/` directory.

## Extended Receipt Model

Add the following field to the existing Receipt model:

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| captureSource | String | @default("upload") | "upload" (desktop file picker) or "camera" (mobile capture) |

## Validation Rules

1. **Image format**: Camera captures are stored as JPEG. Max file size 20 MB (same as Feature 1 upload limit).
2. **Session cleanup**: IndexedDB entries older than 7 days with status "uploaded" are auto-cleaned.
3. **Offline queue limit**: Maximum 50 pending captures in IndexedDB to prevent storage overflow.
4. **Upload order**: FIFO — oldest captures uploaded first.
