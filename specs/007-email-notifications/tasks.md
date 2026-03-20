# Tasks: Email & Notifications

**Feature Branch**: `007-email-notifications` | **Date**: 2026-03-20

---

## Phase 1 — Setup

- [ ] T001 Install `nodemailer` and `@types/nodemailer` as dependencies — `package.json`
- [ ] T002 [P] Install `@microsoft/microsoft-graph-client` and `@microsoft/microsoft-graph-types` as dependencies — `package.json`
- [ ] T003 [P] Add environment variables for mail configuration: `MAIL_PROVIDER` (smtp|graph), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_MAIL_FROM`, `INBOUND_WEBHOOK_SECRET`, `INBOUND_MAILBOX` — `.env.example`
- [ ] T004 Add env var validation/types for all new mail-related variables — `src/lib/env.ts` (or equivalent config module)

---

## Phase 2 — Foundational

- [ ] T005 Add `NotificationType` enum (RECEIPT_FLAGGED, RECEIPT_APPROVED, RECEIPT_REJECTED, PROPOSAL_SUBMITTED, PROPOSAL_APPROVED, PROPOSAL_REJECTED, OVER_BUDGET, SSO_APPROVAL_PENDING) to Prisma schema — `prisma/schema.prisma`
- [ ] T006 Add `InboundEmailStatus` enum (RECEIVED, PROCESSING, COMPLETED, FAILED, REJECTED) to Prisma schema — `prisma/schema.prisma`
- [ ] T007 Add `Notification` model with fields (id, recipientId, type, entityType, entityId, title, message, isRead, createdAt) and indexes — `prisma/schema.prisma`
- [ ] T008 Add `NotificationPreference` model with fields (id, userId, notificationType, emailEnabled) and unique constraint — `prisma/schema.prisma`
- [ ] T009 Add `InboundEmailRecord` model with fields (id, messageId, senderEmail, senderUserId, attachmentCount, receiptIds, status, errorMessage, processedAt, createdAt) and indexes — `prisma/schema.prisma`
- [ ] T010 Add relation fields to `User` model (notifications, notificationPreferences, inboundEmails) — `prisma/schema.prisma`
- [ ] T011 Run `npx prisma migrate dev` to generate migration for new models — `prisma/migrations/`
- [ ] T012 Run `npx prisma generate` to update Prisma client — `prisma/`
- [ ] T013 Implement `MailTransport` interface, `SmtpTransport` class (nodemailer), and `GraphTransport` class (Graph client), with `getMailTransport()` factory selecting provider via `MAIL_PROVIDER` env var — `src/lib/mail-transport.ts`
- [ ] T014 Implement `notification-service.ts` with `createNotification()` (creates in-app record), `notifyRecipients()` (fan-out to multiple users), and async email dispatch via `after()` with preference check — `src/lib/notification-service.ts`
- [ ] T015 Add notification i18n keys (titles, messages, email subjects, email bodies) for all 8 notification types — `src/i18n/messages/en/notifications.json`
- [ ] T016 [P] Add notification i18n keys — `src/i18n/messages/de/notifications.json`
- [ ] T017 [P] Add notification i18n keys — `src/i18n/messages/es/notifications.json`
- [ ] T018 [P] Add notification i18n keys — `src/i18n/messages/fr/notifications.json`
- [ ] T019 [P] Add notification i18n keys — `src/i18n/messages/pt/notifications.json`
- [ ] T020 Add new audit action constants: `NOTIFICATION_SENT`, `INBOUND_EMAIL_PROCESSED`, `INBOUND_EMAIL_REJECTED` — `src/lib/audit.ts` (or equivalent)

---

## Phase 3 — US1: In-App Notifications (P1)

### Tests

- [ ] T021 [US1] Write unit tests for `createNotification()` — verify Notification record is created with correct fields, recipientId, type, entityType, entityId, isRead defaults to false — `tests/unit/notification-service.test.ts`
- [ ] T022 [P] [US1] Write unit tests for `notifyRecipients()` — verify fan-out creates one Notification per recipient — `tests/unit/notification-service.test.ts`
- [ ] T023 [P] [US1] Write unit tests for GET `/api/notifications` — verify pagination, type filter, isRead filter, reverse chronological order, 401 if unauthenticated — `tests/unit/api-notifications.test.ts`
- [ ] T024 [P] [US1] Write unit tests for GET `/api/notifications/unread-count` — verify count accuracy, returns 0 when no unread, 401 if unauthenticated — `tests/unit/api-notifications-unread.test.ts`
- [ ] T025 [P] [US1] Write unit tests for PATCH `/api/notifications/[id]` — verify marks as read, 403 if not recipient, 404 if not found — `tests/unit/api-notifications-patch.test.ts`
- [ ] T026 [P] [US1] Write unit tests for POST `/api/notifications/mark-all-read` — verify all user notifications marked read, returns updatedCount — `tests/unit/api-notifications-mark-all.test.ts`
- [ ] T027 [US1] Write E2E test: trigger workflow event, verify bell icon shows unread count, click bell, see notification, click notification to navigate to entity — `tests/e2e/notifications-bell.spec.ts`

### Implementation

- [ ] T028 [US1] Implement GET `/api/notifications` route — paginated list with type and isRead filters, scoped to authenticated user, include computed `linkUrl` field (derived from entityType + entityId) in each notification — `src/app/api/notifications/route.ts`
- [ ] T029 [US1] Implement GET `/api/notifications/unread-count` route — count of unread notifications for authenticated user — `src/app/api/notifications/unread-count/route.ts`
- [ ] T030 [US1] Implement PATCH `/api/notifications/[id]` route — mark single notification as read, verify recipient ownership — `src/app/api/notifications/[id]/route.ts`
- [ ] T031 [US1] Implement POST `/api/notifications/mark-all-read` route — mark all user notifications as read, return updatedCount — `src/app/api/notifications/mark-all-read/route.ts`
- [ ] T032 [US1] Implement `NotificationBell` component — bell icon with unread count badge, polls `/api/notifications/unread-count` every 30 seconds — `src/components/notifications/NotificationBell.tsx`
- [ ] T033 [US1] Implement `NotificationDropdown` component — dropdown panel from bell click, shows recent notifications in reverse chronological order, unread visually distinguished, click navigates to entity and marks as read — `src/components/notifications/NotificationDropdown.tsx`
- [ ] T034 [US1] Integrate `NotificationBell` into main navigation layout — `src/app/(dashboard)/layout.tsx`
- [ ] T035 [US1] Add notification triggers to receipt review workflow — call `notifyRecipients()` on flag, approve, reject — `src/app/api/receipts/[id]/review/route.ts` (or equivalent)
- [ ] T036 [US1] Add notification triggers to budget proposal workflow — call `notifyRecipients()` on submit, approve, reject — `src/app/api/proposals/` (or equivalent)

---

## Phase 4 — US2: Email Notifications (P1)

### Tests

- [ ] T037 [US2] Write unit tests for `MailTransport` — verify `SmtpTransport.send()` calls nodemailer with correct options, verify `GraphTransport.send()` calls Graph API, verify `getMailTransport()` returns correct provider based on env var — `tests/unit/mail-transport.test.ts`
- [ ] T038 [P] [US2] Write unit tests for email template rendering — verify subject and HTML body are rendered in recipient's locale using next-intl, verify all 8 notification types produce valid templates — `tests/unit/email-templates.test.ts`
- [ ] T039 [P] [US2] Write unit tests for async email dispatch — verify email is sent after notification creation when emailEnabled is true, verify email is NOT sent when emailEnabled is false, verify retry logic on failure (up to 3 attempts) — `tests/unit/email-dispatch.test.ts`
- [ ] T040 [US2] Write unit test for graceful degradation — verify in-app notification is created even when email dispatch throws — `tests/unit/email-dispatch.test.ts`

### Implementation

- [ ] T041 [US2] Implement email template rendering functions — accept `{ locale, data }`, return `{ subject, html }`, use `createTranslator()` from next-intl for server-side rendering in recipient locale, inline-CSS HTML layout — `src/lib/email-templates.ts`
- [ ] T042 [US2] Wire async email dispatch into `createNotification()` — after in-app record creation, use Next.js `after()` to dispatch email if user preference allows — `src/lib/notification-service.ts`
- [ ] T043 [US2] Implement email retry logic — up to 3 attempts with exponential backoff, log failures, mark as permanently failed after 3 failures — `src/lib/mail-transport.ts`
- [ ] T044 [US2] Verify email links include correct base path and resolve to entity pages — `src/lib/email-templates.ts`

---

## Phase 5 — US3: Email-to-Receipt (P2)

### Tests

- [ ] T045 [US3] Write unit tests for `processInboundEmail()` — verify sender matched to registered user, unrecognized sender creates REJECTED record, valid attachments create incomplete receipts, invalid attachments (wrong type, >20MB) rejected, multiple attachments create multiple receipts — `tests/unit/inbound-email-processor.test.ts`
- [ ] T046 [P] [US3] Write unit tests for confirmation/rejection reply sending — verify confirmation reply lists receipt IDs with app link, verify rejection reply for unrecognized sender, verify "no valid files" reply — `tests/unit/inbound-email-processor.test.ts`
- [ ] T047 [P] [US3] Write unit tests for mail loop prevention — verify no reply sent when email has `Auto-Submitted: auto-replied` header or similar auto-reply headers — `tests/unit/inbound-email-processor.test.ts`
- [ ] T048 [P] [US3] Write unit tests for POST `/api/inbound-email/webhook` — verify webhook secret validation (401 on invalid), verify Graph subscription validation token passthrough, verify processing is triggered on valid request — `tests/unit/api-inbound-email.test.ts`
- [ ] T049 [US3] Write E2E test: simulate inbound email webhook, verify InboundEmailRecord created, verify incomplete receipt records created — `tests/e2e/inbound-email.spec.ts`

### Implementation

- [ ] T050 [US3] Implement `processInboundEmail()` — validate sender, extract attachments (PDF/JPEG/PNG, <20MB), create incomplete receipt records, trigger AI extraction (Feature 5) with email body as context, create InboundEmailRecord — `src/lib/inbound-email-processor.ts`
- [ ] T051 [US3] Implement confirmation reply logic — send reply email listing created receipt IDs and link to review in app — `src/lib/inbound-email-processor.ts`
- [ ] T052 [US3] Implement rejection reply logic — reply for unrecognized sender and for no valid attachments — `src/lib/inbound-email-processor.ts`
- [ ] T053 [US3] Implement mail loop prevention — check `Auto-Submitted`, `X-Auto-Response-Suppress`, and similar headers; skip reply if detected — `src/lib/inbound-email-processor.ts`
- [ ] T054 [US3] Implement POST `/api/inbound-email/webhook` route — validate webhook secret, handle Graph subscription validation token, parse request body, call `processInboundEmail()` — `src/app/api/inbound-email/webhook/route.ts`
- [ ] T055 [US3] Implement Graph message fetch — fetch full message with attachments from Graph API given message resource URI — `src/lib/inbound-email-processor.ts`

---

## Phase 6 — US4: Notification Preferences (P2)

### Tests

- [ ] T056 [US4] Write unit tests for GET `/api/notification-preferences` — verify returns all 8 notification types with defaults (emailEnabled: true) for types without explicit records, 401 if unauthenticated — `tests/unit/api-notification-preferences.test.ts`
- [ ] T057 [P] [US4] Write unit tests for PUT `/api/notification-preferences` — verify upserts preference records, validates notificationType enum, validates emailEnabled boolean, 400 on invalid input, 401 if unauthenticated — `tests/unit/api-notification-preferences.test.ts`
- [ ] T058 [P] [US4] Write unit test for preference integration — verify email dispatch respects updated preferences (disable email for a type, trigger event, confirm no email sent) — `tests/unit/notification-preferences-integration.test.ts`
- [ ] T059 [US4] Write E2E test: navigate to notification preferences page, toggle email for a notification type, save, verify toggle persists on reload — `tests/e2e/notification-preferences.spec.ts`

### Implementation

- [ ] T060 [US4] Implement GET `/api/notification-preferences` route — return all notification types with user's email preference (default true for types without explicit record) — `src/app/api/notification-preferences/route.ts`
- [ ] T061 [US4] Implement PUT `/api/notification-preferences` route — upsert NotificationPreference records for provided types, validate input — `src/app/api/notification-preferences/route.ts`
- [ ] T062 [US4] Implement `NotificationPreferences` component — settings form with toggles per notification type for email delivery, save button — `src/components/notifications/NotificationPreferences.tsx`
- [ ] T063 [US4] Create notification preferences settings page — integrate `NotificationPreferences` component — `src/app/(dashboard)/settings/notifications/page.tsx`
- [ ] T064 [US4] Implement `NotificationList` component — full notification history with pagination, type filter, read/unread indicators, "Mark all read" action — `src/components/notifications/NotificationList.tsx`
- [ ] T065 [US4] Integrate preference check into email dispatch in `notification-service.ts` — query NotificationPreference before sending email, skip if emailEnabled is false — `src/lib/notification-service.ts`

---

## Phase 7 — US5: Over-Budget Notifications (P3)

### Tests

- [ ] T066 [US5] Write unit tests for over-budget detection — verify detection triggers when actual spend exceeds planned amount on receipt save, verify correct budget item and country identified — `tests/unit/over-budget-detection.test.ts`
- [ ] T067 [P] [US5] Write unit tests for over-budget notification recipients — verify notification sent to GVI Finance admins and the Country Admin for the relevant country — `tests/unit/over-budget-detection.test.ts`
- [ ] T068 [P] [US5] Write unit tests for deduplication — verify no duplicate notification when budget item was already over-budget before new receipt, verify notification IS sent on first threshold crossing — `tests/unit/over-budget-detection.test.ts`

### Implementation

- [ ] T069 [US5] Implement over-budget detection service — check budget item's total actual spend vs planned amount on receipt save, determine if threshold newly crossed — `src/lib/over-budget-detection.ts`
- [ ] T070 [US5] Implement deduplication logic — track whether an over-budget notification has already been sent for a budget item (query existing Notification of type OVER_BUDGET for that entityId), skip if already notified — `src/lib/over-budget-detection.ts`
- [ ] T071 [US5] Wire over-budget detection into receipt save flow — call detection after receipt save, trigger `notifyRecipients()` to admins and Country Admin if threshold newly crossed — `src/app/api/receipts/` (or equivalent save handler)
- [ ] T072 [US5] Verify over-budget notification includes budget item name, country, planned amount, actual spend, and percentage over budget in notification message — `src/lib/over-budget-detection.ts`

---

## Phase 8 — Polish

- [ ] T073 Verify graceful degradation when mail provider is down — in-app notifications still created, email failures logged, no user-facing errors — `src/lib/notification-service.ts`
- [ ] T074 [P] Verify all i18n notification keys present and non-empty in all 5 locales (en, de, es, fr, pt) — `src/i18n/messages/*/notifications.json`
- [ ] T075 [P] Verify email templates render correctly in all 5 locales — `src/lib/email-templates.ts`
- [ ] T076 Run full validation suite (`npm run validate`) — lint, typecheck, unit tests, E2E tests — project root
- [ ] T077 Quickstart validation: set up SMTP provider, trigger a workflow event, verify in-app notification appears and email is delivered — manual test
- [ ] T078 Quickstart validation: set up Graph provider (switch `MAIL_PROVIDER=graph`), trigger a workflow event, verify email is delivered — manual test
- [ ] T079 Add SSO_APPROVAL_PENDING notification trigger — when a new SSO user logs in and is pending admin approval, call `notifyRecipients()` to notify all GVI Finance admins — `src/app/api/auth/` (or equivalent SSO callback handler)
- [ ] T080 [P] Verify mobile responsive layout for notification components — test NotificationDropdown, NotificationPreferences, and NotificationList on 320px, 375px, and 768px viewports; verify dropdown positions correctly on mobile; verify preferences page toggles are touch-friendly; verify no horizontal scrolling

---

## Summary

| Metric | Value |
|--------|-------|
| **Total tasks** | 80 |
| **Phase 1 — Setup** | 4 tasks |
| **Phase 2 — Foundational** | 16 tasks |
| **Phase 3 — US1: In-App Notifications** | 16 tasks (7 test + 9 impl) |
| **Phase 4 — US2: Email Notifications** | 8 tasks (4 test + 4 impl) |
| **Phase 5 — US3: Email-to-Receipt** | 11 tasks (5 test + 6 impl) |
| **Phase 6 — US4: Notification Preferences** | 10 tasks (4 test + 6 impl) |
| **Phase 7 — US5: Over-Budget Notifications** | 7 tasks (3 test + 4 impl) |
| **Phase 8 — Polish** | 8 tasks (includes SSO trigger + mobile responsive verification) |
| **Parallel opportunities** | T001-T003 (installs), T016-T019 (i18n locales), T022-T026 (US1 unit tests), T037-T039 (US2 tests), T046-T048 (US3 tests), T057-T058 (US4 tests), T067-T068 (US5 tests), T074-T075 (polish) |
| **MVP scope (P1)** | Phases 1-4 (44 tasks): setup + foundational + in-app notifications + email notifications |
| **P2 scope** | Phases 5-6 (21 tasks): inbound email-to-receipt + notification preferences |
| **P3 scope** | Phase 7 (7 tasks): over-budget notifications |
| **Test tasks** | 23 total (every user story has tests before implementation) |
