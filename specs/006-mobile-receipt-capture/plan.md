# Implementation Plan: Mobile Receipt Capture

**Branch**: `006-mobile-receipt-capture` | **Date**: 2026-03-20 | **Spec**: [spec.md](spec.md)

## Summary

Add mobile-optimized receipt capture using PWA camera APIs, batch capture mode, offline storage with automatic upload on reconnect, and image quality guidance. Extends the existing receipt upload flow from Feature 1 with a mobile-first camera workflow.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16 (App Router)
**Primary Dependencies**: Existing stack + browser APIs: MediaDevices (camera), IndexedDB (offline storage), Service Worker (offline detection + background sync)
**Storage**: IndexedDB for offline image queue. SQLite via Prisma for receipt records once uploaded.
**Testing**: Vitest (unit), Playwright (E2E with mobile viewport emulation)
**Performance Goals**: Capture-to-submit in <2 minutes, batch 5 captures in <5 minutes, auto-upload within 1 minute of reconnect
**Constraints**: PWA (browser-only, no native app), varying device capabilities, limited offline storage

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | ✅ Pass | Browser-native APIs only. No native app framework. |
| II. Test Coverage | ✅ Pass | Unit tests for queue logic, E2E with mobile viewport emulation. |
| III. Duplication Control | ✅ Pass | Reuses existing receipt submission form, adapted for mobile. |
| IV. Incremental Delivery | ✅ Pass | P1 basic capture → P2 batch + offline → P3 quality guidance. |
| V. Azure OpenAI | ✅ Pass | N/A for this feature (uses Feature 5's AI if available). |
| VI. Web App Standards | ✅ Pass | Toast notifications for capture/upload status. |
| VII. i18n | ✅ Pass | All mobile capture UI text uses translation keys. |
| VIII. Responsive | ✅ Pass | Mobile-first design — this is the primary mobile feature. |

## Project Structure

```text
src/
├── app/
│   ├── (dashboard)/
│   │   └── receipts/
│   │       ├── capture/              # Mobile capture page
│   │       └── capture/batch/        # Batch capture mode
├── components/
│   ├── mobile/
│   │   ├── CameraCapture.tsx         # Camera interface with viewfinder
│   │   ├── CapturePreview.tsx        # Image review (retake/proceed)
│   │   ├── BatchCaptureList.tsx      # List of captured images in batch
│   │   ├── OfflineIndicator.tsx      # Connectivity status badge
│   │   ├── ImageQualityCheck.tsx     # Blur/brightness assessment
│   │   └── UploadQueue.tsx           # Pending uploads list with status
├── lib/
│   ├── capture-store.ts             # IndexedDB wrapper for offline images
│   ├── upload-queue.ts              # Upload queue with retry logic
│   ├── connectivity.ts              # Online/offline detection + events
│   └── image-quality.ts             # Client-side quality assessment
├── service-worker/
│   └── sw.ts                        # Service worker for offline + background sync
```
