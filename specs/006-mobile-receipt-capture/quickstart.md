# Quickstart: Mobile Receipt Capture

**Date**: 2026-03-20
**Prerequisites**: Feature 1 implemented (receipt upload infrastructure).

## Setup

No additional npm packages required — uses browser-native APIs only.

Run migration (for `captureSource` field):
```bash
npm run prisma:migrate
```

## Key Workflow

### Single Capture
1. Country Finance user opens app on mobile phone
2. Taps "Capture Receipt" → device camera opens with viewfinder
3. Takes photo of receipt → preview shown with Retake / Proceed options
4. Proceeds → image uploaded, receipt form shown (with AI pre-fill if Feature 5 active)
5. Confirms details → submits receipt

### Batch Capture
1. User enters batch capture mode
2. Captures multiple receipts in sequence (camera → preview → "Capture Next")
3. After all captures: sees list with thumbnails and status
4. Taps each to review form, complete details, and submit

### Offline Capture
1. User is offline → captures receipts as normal
2. Images stored locally with "Pending Upload" indicator
3. Connectivity restored → images auto-upload in background
4. User returns to review and submit each receipt

## Device Compatibility

- **Camera**: Falls back to file picker if `getUserMedia` unavailable
- **Offline storage**: IndexedDB (all modern mobile browsers)
- **Background sync**: Service worker where supported; online event fallback elsewhere
- **Minimum viewport**: 320px width
