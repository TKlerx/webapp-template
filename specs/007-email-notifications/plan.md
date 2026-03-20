# Implementation Plan: Email & Notifications

**Branch**: `007-email-notifications` | **Date**: 2026-03-20 | **Spec**: [spec.md](spec.md)

## Summary

Add in-app and email notifications for workflow events (receipt review, budget proposals, over-budget alerts), a dual-provider email transport layer (SMTP + Microsoft Graph), inbound email-to-receipt submission, and per-user notification preferences. Notifications are created synchronously in-app and dispatched asynchronously via email respecting user preferences.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16 (App Router)
**Primary Dependencies**: Existing stack + nodemailer (SMTP), @microsoft/microsoft-graph-client (Graph API)
**Storage**: SQLite via Prisma for Notification, NotificationPreference, and InboundEmailRecord models
**Testing**: Vitest (unit), Playwright (E2E)
**Performance Goals**: In-app notifications within 5 seconds of event, email within 2 minutes, inbound email processed within 5 minutes
**Constraints**: ~10 users, single instance, low email volume (tens/day)

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | Pass | Two well-known mail libraries behind a common interface. No message broker — simple async dispatch. |
| II. Test Coverage | Pass | Unit tests for notification service, mail transport, inbound processor. E2E for bell icon and preferences UI. |
| III. Duplication Control | Pass | Single mail transport abstraction serves both outbound notifications and inbound email replies. |
| IV. Incremental Delivery | Pass | P1 in-app + email notifications, P2 inbound email + preferences UI, P3 over-budget alerts. |
| V. Azure OpenAI | Pass | Inbound email receipts feed into Feature 5 AI extraction when available. Email body text passed as context. |
| VI. Web App Standards | Pass | Toast for notification actions. Bell icon follows common UX patterns. |
| VII. i18n | Pass | All notification text uses next-intl keys. Email templates rendered in recipient's locale. |
| VIII. Responsive | Pass | Notification bell and dropdown responsive across breakpoints. Preferences page mobile-friendly. |

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   ├── notifications/
│   │   │   ├── route.ts                    # GET (list), POST (mark-all-read)
│   │   │   ├── unread-count/
│   │   │   │   └── route.ts                # GET unread count
│   │   │   └── [id]/
│   │   │       └── route.ts                # PATCH (mark read)
│   │   ├── notification-preferences/
│   │   │   └── route.ts                    # GET, PUT
│   │   └── inbound-email/
│   │       └── webhook/
│   │           └── route.ts                # POST (webhook receiver)
│   ├── (dashboard)/
│   │   └── settings/
│   │       └── notifications/
│   │           └── page.tsx                # Notification preferences page
├── components/
│   └── notifications/
│       ├── NotificationBell.tsx            # Bell icon with unread badge
│       ├── NotificationDropdown.tsx        # Dropdown panel from bell click
│       ├── NotificationList.tsx            # Full notification history list
│       └── NotificationPreferences.tsx     # Preference toggles per type
├── lib/
│   ├── mail-transport.ts                  # Abstract mail provider (SMTP + Graph)
│   ├── notification-service.ts            # Create notifications + dispatch emails
│   └── inbound-email-processor.ts         # Parse inbound email, create receipts
├── i18n/
│   └── messages/
│       ├── en/notifications.json          # English notification strings
│       ├── de/notifications.json          # German
│       ├── es/notifications.json          # Spanish
│       ├── fr/notifications.json          # French
│       └── pt/notifications.json          # Portuguese
```

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/notifications` | List notifications (paginated, filterable by type and read status) |
| GET | `/api/notifications/unread-count` | Get current user's unread notification count |
| PATCH | `/api/notifications/[id]` | Mark a single notification as read |
| POST | `/api/notifications/mark-all-read` | Mark all of user's notifications as read |
| GET | `/api/notification-preferences` | Get current user's notification preferences |
| PUT | `/api/notification-preferences` | Update notification preferences (array of type/email toggles) |
| POST | `/api/inbound-email/webhook` | Receive inbound email events from mail provider |

## New Components

| Component | Purpose |
|-----------|---------|
| `NotificationBell` | Bell icon in nav bar with unread count badge. Polls `/api/notifications/unread-count` every 30 seconds. |
| `NotificationDropdown` | Dropdown panel showing recent notifications. Click notification navigates to entity and marks as read. |
| `NotificationList` | Full-page notification history with pagination, type filter, and "Mark all read" action. |
| `NotificationPreferences` | Settings form with toggles per notification type for email delivery. |

## New Libraries

| Module | Purpose |
|--------|---------|
| `mail-transport.ts` | Abstract `MailTransport` interface with `SmtpTransport` and `GraphTransport` implementations. Provider selected by `MAIL_PROVIDER` env var. Handles send, retry (3 attempts), and error logging. |
| `notification-service.ts` | `createNotification()` — creates in-app record + dispatches email if user preference allows. `notifyRecipients()` — fan-out to multiple users. Checks `NotificationPreference` before sending email. |
| `inbound-email-processor.ts` | `processInboundEmail()` — validates sender, extracts attachments, creates incomplete receipts, triggers AI extraction, sends confirmation/rejection reply. Handles auto-reply loop prevention. |

## Implementation Phases

### Phase 1 — In-App Notifications + Email Delivery (P1)
1. Prisma schema: Notification, NotificationPreference models + enums
2. `mail-transport.ts` with SMTP and Graph implementations
3. `notification-service.ts` with event-to-notification mapping
4. API routes: notifications CRUD, unread count
5. `NotificationBell` and `NotificationDropdown` components
6. Integration points: hook into receipt review and proposal workflows to trigger notifications
7. i18n message files for all 5 locales

### Phase 2 — Inbound Email + Preferences UI (P2)
1. Prisma schema: InboundEmailRecord model
2. `inbound-email-processor.ts`
3. Webhook endpoint for inbound email
4. Notification preferences API + settings page
5. `NotificationList` full-page history
6. Integration with Feature 5 AI extraction (email body as context)

### Phase 3 — Over-Budget Alerts (P3)
1. Over-budget detection logic in receipt save flow
2. Threshold-crossing tracking (one notification per crossing)
3. Notifications to GVI Finance admins + relevant Country Admin
