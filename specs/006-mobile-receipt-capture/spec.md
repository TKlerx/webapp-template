# Feature Specification: Mobile Receipt Capture

**Feature Branch**: `006-mobile-receipt-capture`
**Created**: 2026-03-19
**Status**: Draft
**Input**: User description: "Mobile-optimized receipt capture — camera-based receipt upload workflow for Country Finance users in the field"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Country Finance User Captures Receipt with Phone Camera (Priority: P1)

A Country Finance user in Kenya has just paid for fuel for a field mission. They open the GVI Finance web app on their phone, tap "Capture Receipt", and the device camera opens. They photograph the receipt, the image is captured, and they are taken directly to the receipt submission form. If AI processing is available (Feature 5), the extracted data is pre-filled. They confirm or complete the details (amount, date, description, budget item) and submit. The entire process takes under 2 minutes while still at the point of purchase.

**Why this priority**: This is the core mobile use case — Country Finance users in program countries often only have phone access and need to submit receipts immediately. Directly addresses goal #3 (automating expense submission, replacing monthly Excel).

**Independent Test**: Can be tested by opening the app on a mobile device, capturing a photo of a receipt, and verifying the image is uploaded and the submission form is populated.

**Acceptance Scenarios**:

1. **Given** a Country Finance user opens the app on a mobile device, **When** they tap "Capture Receipt", **Then** the device camera opens for photo capture.
2. **Given** the camera is open, **When** the user takes a photo of a receipt, **Then** the captured image is displayed for review with options to retake or proceed.
3. **Given** the user accepts the captured image, **When** they proceed, **Then** the image is uploaded and the receipt submission form is shown with AI-extracted data (if available) or blank fields.
4. **Given** the receipt form is displayed on mobile, **When** the user fills in or confirms the details, **Then** they can submit the receipt with a single tap.
5. **Given** the receipt is submitted, **When** the submission completes, **Then** the user sees a success confirmation and can immediately capture another receipt.

---

### User Story 2 - Multi-Receipt Capture Session (Priority: P2)

A Country Finance user has several receipts to submit after a day of field activities. They enter a batch capture mode where they can photograph multiple receipts in sequence. Each captured image is queued for upload and processing. After capturing all receipts, they review and submit each one, with AI-extracted data pre-filled where available. This avoids the overhead of navigating back to the camera for each receipt.

**Why this priority**: Field users often have multiple receipts to submit at once. Batch capture is significantly faster than one-at-a-time submission.

**Independent Test**: Can be tested by capturing 5 receipts in sequence, then verifying all are queued and can be reviewed/submitted individually.

**Acceptance Scenarios**:

1. **Given** the user is in capture mode, **When** they take a photo and tap "Capture Next", **Then** the camera reopens immediately for the next receipt without returning to the form.
2. **Given** multiple receipts have been captured, **When** the user finishes capturing, **Then** they see a list of all captured receipts with thumbnails and processing status.
3. **Given** the captured receipt list is displayed, **When** the user taps on a receipt, **Then** they see the submission form with extracted data (if available) and can complete and submit it.
4. **Given** some captured receipts have been submitted and others are still pending, **When** the user leaves and returns later, **Then** the unsubmitted captures are retained and available for completion.

---

### User Story 3 - Offline Capture with Later Upload (Priority: P2)

A Country Finance user is in a remote area with limited or no internet connectivity. They open the app and capture receipt photos. The images are stored locally on the device. When connectivity is restored, the app detects the connection and uploads the stored images, triggering AI processing and allowing the user to complete the submissions.

**Why this priority**: Program countries often have unreliable internet. Without offline support, receipt capture is limited to areas with connectivity, defeating the purpose of mobile capture.

**Independent Test**: Can be tested by disabling network connectivity, capturing receipts, re-enabling connectivity, and verifying the images are uploaded automatically.

**Acceptance Scenarios**:

1. **Given** the user has no internet connectivity, **When** they open the capture screen, **Then** the camera still works and images are stored locally.
2. **Given** receipts are captured offline, **When** the user views the receipt list, **Then** offline captures are marked as "Pending Upload" with a clear indicator.
3. **Given** offline captures exist, **When** internet connectivity is restored, **Then** the app automatically begins uploading the stored images.
4. **Given** uploads complete after offline capture, **When** the user views the receipts, **Then** AI-extracted data is now available and the user can complete the submission forms.
5. **Given** an upload fails (e.g., connectivity drops again), **When** the partial upload fails, **Then** the image is retained locally and upload retries when connectivity returns.

---

### User Story 4 - Image Quality Guidance (Priority: P3)

When capturing a receipt with the camera, the app provides real-time guidance to help the user take a good photo: alignment guides, lighting warnings (too dark/bright), and blur detection. After capture, the app checks the image quality and warns the user if the image may be too blurry or low-resolution for AI processing, giving them a chance to retake.

**Why this priority**: Poor image quality is a common issue with mobile receipt capture and leads to failed AI extraction. Guidance prevents wasted time.

**Independent Test**: Can be tested by capturing intentionally poor photos (blurry, dark) and verifying the app warns the user.

**Acceptance Scenarios**:

1. **Given** the camera is open for capture, **When** the receipt is not well-aligned in the viewfinder, **Then** alignment guides help the user position the receipt.
2. **Given** a photo has been taken, **When** the image is blurry or low-resolution, **Then** the app warns "Image may be too blurry for automatic processing. Retake?" with options to retake or proceed anyway.
3. **Given** the user proceeds with a low-quality image, **When** the receipt is submitted, **Then** the system accepts it (quality warnings are advisory, not blocking).

---

### Edge Cases

- What happens when the device does not have a camera? The app falls back to the standard file upload interface (select image from gallery or files).
- What happens when the user denies camera permission? The app explains why camera access is needed and provides a fallback to file selection.
- What happens when device storage is full during offline capture? The app warns the user that storage is low and cannot capture more receipts until space is freed.
- What happens when the user closes the app mid-capture session? Captured but unsubmitted images are retained. On next app open, the user is prompted to continue where they left off.
- What happens when the same receipt image is submitted twice? The system stores both (since different receipts could have the same photo), but AI duplicate detection (Feature 5) may flag them during review.
- What happens on very old or low-end devices? The camera interface degrades gracefully — no fancy overlays, but basic capture and upload still works.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a camera-based receipt capture interface optimized for mobile devices.
- **FR-002**: The capture interface MUST allow users to photograph a receipt and immediately proceed to the submission form.
- **FR-003**: After photo capture, the user MUST be able to review the image and choose to retake or proceed.
- **FR-004**: System MUST support capturing multiple receipts in sequence (batch mode) without returning to the main navigation between captures.
- **FR-005**: Captured but unsubmitted receipt images MUST be retained on the device until the user completes or discards the submission.
- **FR-006**: System MUST support offline receipt capture — images are stored locally when no internet connection is available.
- **FR-007**: Offline-captured images MUST be automatically uploaded when internet connectivity is restored.
- **FR-008**: System MUST clearly indicate the upload/processing status of each captured receipt (captured, uploading, uploaded, processing, ready for submission).
- **FR-009**: When the device does not support camera access, the system MUST fall back to file selection (gallery or file picker).
- **FR-010**: The receipt submission form MUST be fully usable on mobile viewports with appropriate touch targets and input methods.
- **FR-011**: System SHOULD provide image quality guidance (alignment, blur detection) to help users capture clear receipt photos.
- **FR-012**: System MUST warn users when a captured image appears too low quality for AI processing, with an option to retake.
- **FR-013**: Image quality warnings MUST be advisory only — users MUST be able to proceed with any captured image.
- **FR-014**: All user-facing text in the mobile capture interface MUST be available in all supported languages (en, de, es, fr, pt).

### Key Entities

- **Captured Image**: A receipt photo taken via the mobile camera, stored locally until uploaded. Has a capture timestamp and quality assessment.
- **Capture Session**: A batch of receipt captures made in sequence. Tracks which images have been submitted and which are pending.
- **Upload Queue**: The set of offline-captured images waiting to be uploaded when connectivity is available.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Country Finance user can capture a receipt photo and submit it in under 2 minutes on a mobile device.
- **SC-002**: Batch capture of 5 receipts takes under 5 minutes (capture only, not including form completion).
- **SC-003**: Offline-captured receipts are automatically uploaded within 1 minute of connectivity being restored.
- **SC-004**: 95% of captured receipt images are of sufficient quality for AI data extraction (when guidance features are used).
- **SC-005**: The mobile receipt capture workflow works on devices with screen sizes as small as 320px width.
- **SC-006**: Unsubmitted captures survive app closure and are available on the next session.

## Assumptions

- This is a progressive web app (PWA) feature, not a native mobile app. Camera access is via the browser's media capture APIs.
- Offline storage uses the browser's built-in storage capabilities. Storage capacity depends on the device and browser.
- Image quality guidance (alignment, blur detection) operates on the device, not via the server, to work offline.
- The maximum image file size per receipt (20 MB as established in Feature 1) applies to camera captures as well.
- The mobile capture workflow reuses the same receipt submission form as the desktop version, adapted for mobile layout.

## Scope Boundaries

**In scope**:
- Camera-based receipt capture on mobile devices
- Batch capture mode
- Offline capture with automatic upload on reconnection
- Image quality guidance and warnings
- Mobile-optimized receipt submission form
- Fallback to file selection when camera is unavailable

**Out of scope (later features)**:
- Native mobile app (iOS/Android)
- Automatic receipt boundary detection and cropping
- Multi-page receipt scanning (multiple images per receipt)
- QR code or barcode scanning on receipts
- Location/GPS tagging of receipt captures

## Dependencies

- **Feature 1 (Budget Planning & Core Data Model)**: Requires receipt upload infrastructure and budget item hierarchy for the submission form.
- **Feature 5 (AI Receipt Processing)**: Optional — AI extraction enhances the mobile workflow but is not required for basic capture and submission.
