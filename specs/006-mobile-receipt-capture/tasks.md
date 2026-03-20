# Tasks: Mobile Receipt Capture

**Input**: Design documents from `specs/006-mobile-receipt-capture/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.md, research.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

---

## Phase 1: Setup

**Purpose**: Service worker registration and project structure for mobile capture

- [ ] T001 Add `captureSource` field (String, default "upload") to Receipt model in `prisma/schema.prisma` and run `npm run prisma:migrate`
- [ ] T002 [P] Create service worker file at `src/service-worker/sw.ts` — register from capture page layout (`src/app/(dashboard)/receipts/capture/layout.tsx`), NOT globally; cache-first for static assets (JS, CSS, images), network-first for API calls, background sync handler stub for `sync:upload-receipts` tag

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: IndexedDB storage, connectivity detection, and upload queue — MUST complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Create IndexedDB wrapper in `src/lib/capture-store.ts` — database `gvi-capture-store`, object store `captured-images`, CRUD operations: `saveCapture(imageBlob, thumbnailBlob, sessionId)`, `getCapturesBySession(sessionId)`, `getPendingUploads()`, `updateCaptureStatus(id, status, receiptId?)`, `deleteCapture(id)`, `cleanupOldCaptures(maxAgeDays=7)`, enforce max 50 pending captures
- [ ] T004 [P] Create connectivity detection in `src/lib/connectivity.ts` — expose `isOnline()` check, `onOnline` / `onOffline` event listeners using `navigator.onLine` + `window.addEventListener("online"/"offline")`, debounce rapid toggles
- [ ] T005 Create upload queue in `src/lib/upload-queue.ts` — reads pending captures from capture-store, uploads sequentially via existing POST `/api/receipts` with `captureSource: "camera"`, updates status per image (captured → uploading → uploaded/failed), retry logic (3 attempts with backoff), FIFO order, triggered on connectivity restore via connectivity.ts events
- [ ] T006 [P] Add i18n translation keys for mobile capture features across all 5 locales (en, de, es, fr, pt) in `src/i18n/messages/` — keys for capture UI, batch mode, offline indicators, upload status, quality warnings, error messages

**Checkpoint**: Foundation ready — IndexedDB store, upload queue, connectivity detection in place

---

## Phase 3: User Story 1 — Camera Receipt Capture (Priority: P1) 🎯 MVP

**Goal**: Country Finance user photographs a receipt on mobile and submits it immediately

**Independent Test**: Open app on mobile device, capture receipt photo, verify image uploads and form populates

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T007 [P] [US1] Unit test for capture-store in `tests/unit/capture-store.test.ts` — mock IndexedDB, verify saveCapture stores blob with correct fields, verify getPendingUploads returns only "captured" status, verify updateCaptureStatus transitions, verify cleanupOldCaptures removes entries older than 7 days, verify 50-entry limit enforcement
- [ ] T008 [P] [US1] Unit test for upload-queue in `tests/unit/upload-queue.test.ts` — mock fetch and capture-store, verify FIFO upload order, verify status transitions (captured → uploading → uploaded/failed), verify retry logic with 3 attempts, verify upload includes captureSource "camera"

### Implementation

- [ ] T009 [US1] Create `src/components/mobile/CameraCapture.tsx` — use `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })` for rear camera, render video stream to `<video>` element, capture frame to `<canvas>` and export as JPEG blob, fallback to `<input type="file" accept="image/*" capture="environment">` when getUserMedia unavailable or permission denied, show explanation message on permission denial
- [ ] T010 [US1] Create `src/components/mobile/CapturePreview.tsx` — display captured image for review, "Retake" button returns to camera, "Use Photo" button proceeds to submission, show image dimensions and approximate file size
- [ ] T011 [US1] Create capture page at `src/app/(dashboard)/receipts/capture/page.tsx` — mobile-optimized layout, integrates CameraCapture and CapturePreview, after capture accepted: generate thumbnail (canvas resize to ~200px width) and save both imageBlob + thumbnailBlob to IndexedDB via capture-store, if online: trigger upload immediately, navigate to receipt submission form with receiptId after upload completes
- [ ] T012 [US1] Integrate `captureSource` into existing POST `/api/receipts` route — accept optional `captureSource` field in multipart form data, default to "upload", set to "camera" when submitted from mobile capture
- [ ] T013 [P] [US1] Create `src/components/mobile/OfflineIndicator.tsx` — small badge/banner showing connectivity status, uses connectivity.ts, shows "Offline — receipts will upload when connected" when offline, visible on capture and receipt list pages
- [ ] T014 [US1] Add "Capture Receipt" button to receipt list page at `src/app/(dashboard)/receipts/page.tsx` — visible on mobile viewports (responsive), links to capture page, uses camera icon with i18n label
- [ ] T015 [US1] After successful receipt submission from capture flow, show success toast and "Capture Another" button to return to camera immediately

**Checkpoint**: User can photograph receipt on mobile, upload, and submit — full single-capture flow

---

## Phase 4: User Story 2 — Multi-Receipt Batch Capture (Priority: P2)

**Goal**: User captures multiple receipts in sequence, then reviews and submits each one

**Independent Test**: Capture 5 receipts in batch, verify all queued with thumbnails, tap each to complete submission

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T016 [P] [US2] Unit test for batch capture session in `tests/unit/batch-capture.test.ts` — verify sessionId groups captures, verify getCapturesBySession returns correct entries, verify status tracking per capture in batch

### Implementation

- [ ] T017 [US2] Create `src/components/mobile/BatchCaptureList.tsx` — list of captured images with thumbnails, status badge per image (captured, uploading, uploaded, submitted), tap to open submission form, count indicator (e.g., "3 of 5 submitted")
- [ ] T018 [US2] Create batch capture page at `src/app/(dashboard)/receipts/capture/batch/page.tsx` — generates sessionId, camera opens in continuous mode: after each capture shows "Capture Next" button that reopens camera without navigating away, "Done Capturing" button navigates to BatchCaptureList showing all captures in session
- [ ] T019 [US2] Persist unsubmitted captures across app sessions — on page load, check IndexedDB for captures with status "captured" or "uploaded" (not yet submitted), prompt user to continue where they left off or discard
- [ ] T020 [US2] Integrate batch list with receipt submission — tapping a capture in BatchCaptureList opens the receipt form pre-populated with the uploaded image, after submission updates capture status to "submitted" and returns to batch list

**Checkpoint**: User captures 5 receipts in batch, submits each individually

---

## Phase 5: User Story 3 — Offline Capture with Auto-Upload (Priority: P2)

**Goal**: Receipts captured offline are stored locally and uploaded automatically when connectivity returns

**Independent Test**: Disable network, capture receipts, re-enable network, verify auto-upload within 1 minute

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T021 [P] [US3] Unit test for connectivity detection in `tests/unit/connectivity.test.ts` — mock navigator.onLine and online/offline events, verify isOnline() returns correct state, verify onOnline callback fires on reconnect, verify debounce prevents rapid event spam
- [ ] T022 [P] [US3] Unit test for offline upload flow in `tests/unit/offline-upload.test.ts` — mock capture-store and upload-queue, verify captures saved when offline, verify upload triggered on connectivity restore, verify failed uploads retry with backoff, verify partial failure doesn't block remaining uploads

### Implementation

- [ ] T023 [US3] Implement Background Sync in service worker at `src/service-worker/sw.ts` — handle `sync:upload-receipts` event by calling upload-queue.processQueue(), register sync on capture when offline, fallback: use `online` event listener from connectivity.ts when Background Sync API unavailable (iOS Safari)
- [ ] T024 [US3] Update capture flow to work offline — in capture page, when offline: save to IndexedDB only, show "Saved offline — will upload when connected" toast, register Background Sync, update OfflineIndicator to show pending upload count
- [ ] T025 [US3] Create `src/components/mobile/UploadQueue.tsx` — shows list of pending uploads with status, progress indicator during upload, retry button for failed uploads, visible on receipt list page when pending uploads exist
- [ ] T026 [US3] Handle upload failure recovery — if connectivity drops during upload, revert capture status from "uploading" to "captured", retry on next connectivity event, show appropriate error message after 3 failed attempts

**Checkpoint**: Offline capture works, auto-uploads on reconnect, failed uploads retry

---

## Phase 6: User Story 4 — Image Quality Guidance (Priority: P3)

**Goal**: App helps users take good receipt photos with alignment guides and quality warnings

**Independent Test**: Capture blurry/dark photos, verify app warns user with option to retake

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T027 [P] [US4] Unit test for image quality assessment in `tests/unit/image-quality.test.ts` — test blur detection (Laplacian variance below threshold → blurry), test brightness check (average luminance below/above thresholds → too dark/bright), verify quality check returns advisory result (never blocks)

### Implementation

- [ ] T028 [US4] Create image quality service in `src/lib/image-quality.ts` — blur detection via Laplacian variance on grayscale canvas, brightness via average pixel luminance, returns `{ isBlurry: boolean, isDark: boolean, isBright: boolean, score: number }`, thresholds configurable, runs on captured frame (not video stream) for performance
- [ ] T029 [US4] Create `src/components/mobile/ImageQualityCheck.tsx` — after capture, displays quality assessment results, warning message if blurry/dark ("Image may be too blurry for automatic processing. Retake?"), "Retake" and "Use Anyway" buttons, warnings are advisory only (FR-013)
- [ ] T030 [US4] Add alignment guide overlay to CameraCapture.tsx — semi-transparent rectangle overlay on camera viewfinder showing receipt positioning area, help text "Position receipt within the frame", hide on low-end devices if performance issues detected
- [ ] T031 [US4] Integrate ImageQualityCheck into capture flow — run quality assessment after photo capture in CapturePreview, show warning before proceeding if quality is poor, user can always proceed regardless

**Checkpoint**: Quality guidance helps users take better photos, warnings are advisory

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Mobile optimization, edge cases, and overall quality

- [ ] T032 [P] Ensure all mobile components have adequate touch targets (min 44x44px), test on 320px viewport width, verify no horizontal scrolling on capture and submission pages, verify/adapt the existing receipt submission form (from Feature 1) for mobile viewports — input fields, dropdowns, date pickers, and file display must be fully usable on mobile with appropriate touch sizing
- [ ] T033 [P] Implement camera permission fallback — when getUserMedia permission denied, show clear explanation of why camera access is needed, provide direct link to "Upload from Gallery" as alternative (uses standard file input)
- [ ] T034 [P] Handle device storage full scenario — before saving to IndexedDB, check available storage estimate via `navigator.storage.estimate()`, warn user if storage is low, prevent capture if IndexedDB write fails
- [ ] T035 [P] Verify i18n completeness for all mobile capture components — check all 5 locales have translations for capture UI, batch mode, offline indicators, quality warnings (verification pass)
- [ ] T036 Cache capture UI static assets in service worker — ensure capture page loads even when fully offline, test by loading capture page, going offline, refreshing
- [ ] T037 Run quickstart.md validation — verify mobile receipt capture workflow end-to-end per quickstart scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — schema change + service worker
- **Phase 2 (Foundational)**: Depends on Phase 1 — IndexedDB store, upload queue, connectivity
- **Phase 3 (US1 - Camera Capture)**: Depends on Phase 2 — uses capture-store, upload-queue, connectivity
- **Phase 4 (US2 - Batch Capture)**: Depends on Phase 3 — extends single capture with session management
- **Phase 5 (US3 - Offline Capture)**: Depends on Phase 2 + Phase 3 — adds Background Sync and offline flow
- **Phase 6 (US4 - Quality Guidance)**: Depends on Phase 3 — integrates into capture flow
- **Phase 7 (Polish)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Camera Capture)**: Foundation only — independent
- **US2 (Batch Capture)**: Depends on US1 — extends capture page with batch session
- **US3 (Offline Capture)**: Depends on US1 — adds offline storage and sync to capture flow
- **US4 (Quality Guidance)**: Depends on US1 — integrates into capture preview

### Parallel Opportunities

```bash
# Phase 2 parallel tasks:
T004 (connectivity.ts) | T006 (i18n keys)

# Phase 3 tests:
T007 (capture-store test) | T008 (upload-queue test)

# Phase 5 tests:
T021 (connectivity test) | T022 (offline-upload test)

# Phase 7 parallel polish:
T032 (touch targets) | T033 (permission fallback) | T034 (storage full) | T035 (i18n verify)
```

---

## Implementation Strategy

### MVP First (US1 — Single Camera Capture)

1. Complete Phase 1: Setup (schema, service worker)
2. Complete Phase 2: Foundational (IndexedDB, upload queue, connectivity)
3. Complete Phase 3: US1 — Camera Capture
4. **STOP and VALIDATE**: Capture receipt on mobile, submit successfully
5. This alone replaces the desktop-only upload flow for mobile users

### Incremental Delivery

1. Setup + Foundation → Mobile infrastructure ready
2. US1 (Camera Capture) → Core mobile receipt capture → **MVP**
3. US2 (Batch Capture) → Multiple receipts per session → field efficiency
4. US3 (Offline Capture) → Works without connectivity → remote areas
5. US4 (Quality Guidance) → Better photos → better AI extraction
6. Polish → Production-ready across devices

---

## Summary

- **Total tasks**: 37
- **Phase 1 (Setup)**: 2 tasks
- **Phase 2 (Foundational)**: 4 tasks
- **Phase 3 (US1 - Camera Capture)**: 9 tasks (2 test + 7 implementation)
- **Phase 4 (US2 - Batch Capture)**: 5 tasks (1 test + 4 implementation)
- **Phase 5 (US3 - Offline Capture)**: 6 tasks (2 test + 4 implementation)
- **Phase 6 (US4 - Quality Guidance)**: 5 tasks (1 test + 4 implementation)
- **Phase 7 (Polish)**: 6 tasks
- **Parallel opportunities**: 4 groups identified
- **MVP scope**: Phases 1-3 (15 tasks)
