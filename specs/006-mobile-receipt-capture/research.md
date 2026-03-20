# Research: Mobile Receipt Capture

**Date**: 2026-03-20

## R1: Camera Access in PWA

**Decision**: Use the `navigator.mediaDevices.getUserMedia()` API for camera access, with `<input type="file" accept="image/*" capture="environment">` as fallback.

**Rationale**: `getUserMedia` provides a custom camera viewfinder UI, enabling alignment guides and quality checks. The `<input capture>` fallback works on browsers/devices that don't support `getUserMedia` or when the user denies camera permission — it opens the native camera app instead.

**Alternatives considered**:
- `<input capture>` only → rejected: no custom viewfinder UI, no quality guidance, no batch mode
- Native app (React Native / Capacitor) → rejected: out of scope per spec; PWA is sufficient for the use case
- Third-party camera library (e.g., webcam.js) → rejected: unnecessary wrapper; native API is well-supported

**Implementation**:
- Primary: `getUserMedia({ video: { facingMode: "environment" } })` for rear camera
- Render video stream to `<video>` element with CSS overlay for viewfinder guides
- Capture frame to `<canvas>`, export as JPEG blob
- Fallback: detect `getUserMedia` support; if unavailable, show `<input type="file" capture>`

## R2: Offline Storage with IndexedDB

**Decision**: Use IndexedDB to store captured images as Blobs when offline. Each entry includes the image blob, capture timestamp, and submission status.

**Rationale**: IndexedDB supports Blob storage, has higher storage limits than localStorage (~50MB+ depending on browser), and is the standard for offline web app storage. Works across all modern mobile browsers.

**Alternatives considered**:
- Service Worker Cache API → rejected: designed for HTTP responses, not arbitrary blob storage
- localStorage with base64 → rejected: 5MB limit, base64 encoding increases size by ~33%
- File System Access API → rejected: limited browser support, especially on iOS Safari

**Implementation**:
- Database: `gvi-capture-store`, object store: `captured-images`
- Schema: `{ id: string, imageBlob: Blob, capturedAt: Date, status: "captured" | "uploading" | "uploaded" | "failed", receiptId?: string }`
- Thin wrapper in `capture-store.ts` with CRUD operations
- Cleanup: remove entries after successful upload and receipt submission

## R3: Background Sync for Auto-Upload

**Decision**: Use the Background Sync API where available, with a polling fallback for browsers that don't support it.

**Rationale**: Background Sync allows the service worker to defer upload until connectivity is available, even if the user has closed the tab. For browsers without Background Sync support (notably iOS Safari), a polling fallback using `navigator.onLine` + periodic checks works adequately.

**Alternatives considered**:
- Manual "sync now" button only → rejected: user must remember to come back; defeats purpose of offline capture
- Periodic Sync API → rejected: very limited browser support, requires site engagement heuristics
- WebSocket-based sync → rejected: over-engineering for this use case

**Implementation**:
- Service worker registers for `sync` event with tag `upload-receipts`
- On connectivity restored: read all `status: "captured"` entries from IndexedDB → upload sequentially
- Fallback: `window.addEventListener("online", ...)` triggers upload queue processing
- Upload queue: process one at a time, mark as "uploading" → "uploaded" or "failed" with retry

## R4: Image Quality Assessment

**Decision**: Client-side quality checks using canvas-based analysis: blur detection via Laplacian variance, brightness check via average pixel luminance.

**Rationale**: Quality checks must work offline (can't rely on server). Canvas-based analysis is lightweight and provides sufficient accuracy for detecting obviously blurry or dark images. This is advisory — users can always proceed.

**Alternatives considered**:
- TensorFlow.js model → rejected: large download size, over-engineering for basic quality checks
- Server-side analysis → rejected: doesn't work offline
- No quality check → rejected: spec requires it (FR-011, FR-012)

**Implementation**:
- Blur detection: compute Laplacian (edge detection convolution) on grayscale image, measure variance. Low variance = blurry.
- Brightness: average pixel luminance. Below threshold = too dark; above = overexposed.
- Thresholds tuned empirically; user sees warning but can proceed (FR-013: advisory only)
- Runs on captured frame before upload, not on video stream (to avoid performance issues on low-end devices)

## R5: Service Worker Strategy

**Decision**: Use a service worker for offline detection, background sync, and caching of the capture UI's static assets. Do not use a full PWA manifest with install prompt — keep it as a web app that works well from the browser.

**Rationale**: The service worker adds offline capabilities without requiring the user to "install" an app. Caching the capture UI ensures the camera page loads even offline. No need for push notifications or home screen install for this use case.

**Implementation**:
- Register service worker from the capture page
- Cache strategy: cache-first for static assets (JS, CSS, images), network-first for API calls
- Background sync handler for upload queue
- No `manifest.json` install prompt (can be added later if desired)
