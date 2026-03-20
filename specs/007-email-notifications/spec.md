# Feature Specification: Email & Notifications

**Feature Branch**: `007-email-notifications`
**Created**: 2026-03-20
**Status**: Draft
**Input**: User description: "Email-based receipt submission and in-app plus email notifications for GVI Finance workflow events"

## Clarifications

### Session 2026-03-20

- Q: How are email-submitted receipts assigned to a budget item and country? → A: Receipts are created as "incomplete" (file stored, no budget item/country assigned). AI processes both the attachment and the email body text for extraction hints (amount, vendor, context clues for classification). The user then reviews and completes the assignment in the app.
- Q: Notification retention policy? → A: Keep all notifications indefinitely. No auto-cleanup needed for ~10 users.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - In-App Notifications for Workflow Events (Priority: P1)

A GVI Finance admin reviews a receipt and flags it for correction. The Country Finance user who uploaded the receipt sees a notification badge appear on the bell icon in the navigation bar. They click the bell to see the notification: "Your receipt #R-2026-0042 has been flagged for correction by Admin." They tap the notification and are taken directly to the flagged receipt to address the issue. Meanwhile, when a Country Admin submits a budget proposal, the GVI Finance admin sees a notification about the pending proposal.

**Why this priority**: In-app notifications are the foundation — they work for all users regardless of email configuration. They provide immediate feedback within the application where users are already working.

**Independent Test**: Can be tested by triggering workflow events (flag receipt, approve/reject receipt, submit proposal) and verifying the correct user sees the notification with a link to the relevant item.

**Acceptance Scenarios**:

1. **Given** a GVI Finance admin flags a receipt, **When** the Country Finance user who uploaded it opens the app, **Then** they see a notification badge (unread count) on the bell icon and a notification entry linking to the flagged receipt.
2. **Given** a Country Admin submits a budget proposal, **When** a GVI Finance admin opens the app, **Then** they see a notification about the pending proposal with a link to review it.
3. **Given** a GVI Finance admin approves or rejects a budget proposal, **When** the Country Admin who submitted it opens the app, **Then** they see a notification with the decision and any review comment.
4. **Given** a receipt is approved or rejected, **When** the Country Finance user opens the app, **Then** they see a notification with the review decision.
5. **Given** a user has multiple unread notifications, **When** they open the notification panel, **Then** notifications are listed in reverse chronological order with unread items visually distinguished.
6. **Given** a user reads a notification, **When** they click on it or mark it as read, **Then** the unread count decreases accordingly.

---

### User Story 2 - Email Notifications for Workflow Events (Priority: P1)

In addition to in-app notifications, users receive email notifications for important workflow events. A Country Finance user receives an email when their receipt is flagged, approved, or rejected. A GVI Finance admin receives an email when a new budget proposal is submitted or when a budget item goes over-budget. Users can configure their email notification preferences — opting out of email while still receiving in-app notifications.

**Why this priority**: Email notifications ensure users are informed even when they are not actively using the application. Critical for time-sensitive actions like receipt corrections and proposal reviews.

**Independent Test**: Can be tested by triggering workflow events and verifying the correct email is sent to the appropriate user with the expected content.

**Acceptance Scenarios**:

1. **Given** a receipt is flagged by a reviewer, **When** the notification is created, **Then** the Country Finance user receives an email with the receipt details, flag reason, and a link to the receipt in the application.
2. **Given** a budget proposal is submitted, **When** the notification is created, **Then** all GVI Finance admins receive an email with proposal details and a link to review it.
3. **Given** a user has opted out of email notifications, **When** a workflow event triggers a notification, **Then** they receive only the in-app notification (no email is sent).
4. **Given** the email provider is temporarily unavailable, **When** a notification is triggered, **Then** the in-app notification is still created and the email is queued for retry.
5. **Given** a user receives a notification email, **When** they click the link in the email, **Then** they are taken directly to the relevant item in the application (after login if needed).

---

### User Story 3 - Email-to-Receipt Submission (Priority: P2)

A Country Finance user in the field emails a receipt photo to the dedicated GVI Finance receipts address (e.g., receipts@gvi-finance.org). The system receives the email, identifies the sender by matching the email address to a registered user, extracts the file attachments, and creates "incomplete" receipt records (file stored, no budget item or country assigned yet). AI processes both the attachment and the email body text to extract hints (amount, vendor, context for budget item classification). The user receives a confirmation reply with a link to review and complete the receipts in the app. If the sender is not a registered user, they receive a rejection reply.

**Why this priority**: Email submission is a convenience feature that complements the web and mobile capture workflows. It is especially valuable for users who receive receipts digitally (forwarded invoices, email receipts) and want to submit them without opening the app.

**Independent Test**: Can be tested by sending an email with receipt attachments to the inbound address and verifying receipt records are created and a confirmation reply is sent.

**Acceptance Scenarios**:

1. **Given** a registered Country Finance user sends an email with a PDF attachment to the receipts address, **When** the system processes the email, **Then** an incomplete receipt record is created (file stored, no budget item or country assigned) with the sender as the uploader.
2. **Given** an email contains multiple attachments (e.g., 3 receipt images), **When** the system processes it, **Then** 3 separate incomplete receipt records are created, one per attachment.
3. **Given** the receipt is created from email, **When** AI processing is available, **Then** extraction and classification run automatically on each attachment and the email body text is used as additional context for AI extraction hints.
4. **Given** the system successfully creates receipts from an email, **When** processing completes, **Then** the sender receives a confirmation reply listing the receipt IDs and a link to review and complete them in the application.
5. **Given** email-submitted receipts exist as incomplete, **When** the user opens them in the app, **Then** they see AI-suggested values (if available) and must assign a budget item, country, and budget year before the receipt is fully submitted.
5. **Given** an unrecognized email address sends to the receipts address, **When** the system processes it, **Then** a rejection reply is sent explaining that only registered users can submit receipts.
6. **Given** an email contains no valid attachments (no PDF/JPEG/PNG files), **When** the system processes it, **Then** the sender receives a reply explaining that no valid receipt files were found.

---

### User Story 4 - Notification Preferences (Priority: P2)

Users can manage their notification preferences from a settings page. They can choose which notification types they want to receive via email (while in-app notifications are always on). They can also see a full history of their past notifications with read/unread status and filter by type.

**Why this priority**: Notification preferences prevent notification fatigue and give users control. The notification history provides a record of all workflow events relevant to the user.

**Independent Test**: Can be tested by changing notification preferences and verifying that subsequent events respect the updated settings.

**Acceptance Scenarios**:

1. **Given** a user navigates to notification settings, **When** they view the preferences page, **Then** they see a list of notification types with toggles for email delivery (in-app is always enabled).
2. **Given** a user disables email for "Receipt Review Decisions", **When** their receipt is approved, **Then** they receive an in-app notification but no email.
3. **Given** a user opens the notification history, **When** they view the list, **Then** they see all past notifications sorted by date with read/unread indicators and notification type labels.
4. **Given** a user has many notifications, **When** they use the "Mark all as read" action, **Then** all notifications are marked as read and the unread count resets to zero.

---

### User Story 5 - Over-Budget Notifications (Priority: P3)

When the total actual spend for a budget item exceeds its planned amount, the system automatically sends a notification to the relevant GVI Finance admin(s) and the Country Admin for that country. The notification includes the budget item name, planned amount, actual spend, and the percentage over budget. This alert helps stakeholders react quickly to budget overruns.

**Why this priority**: Over-budget alerts are a proactive feature that adds value on top of the budget overview dashboard. Lower priority because the dashboard already shows this information — notifications make it push-based rather than pull-based.

**Independent Test**: Can be tested by uploading receipts that push a budget item over its planned amount and verifying the notification is sent to the correct stakeholders.

**Acceptance Scenarios**:

1. **Given** a receipt is submitted that causes a budget item's actual spend to exceed its planned amount, **When** the receipt is saved, **Then** a notification is sent to GVI Finance admins and the Country Admin for that country.
2. **Given** an over-budget notification is sent, **When** the recipient views it, **Then** it includes the budget item name, country, planned amount, actual spend, and percentage over budget.
3. **Given** a budget item was already over-budget and another receipt is added, **When** the receipt is saved, **Then** no duplicate over-budget notification is sent (one notification per threshold crossing).

---

### Edge Cases

- What happens when an inbound email has attachments larger than 20 MB? The system rejects those specific attachments and notifies the sender that files must be under 20 MB. Other valid attachments in the same email are still processed.
- What happens when the inbound email processing encounters a malformed email? The system logs the error and skips the email. No reply is sent (to avoid loops with spam/automated emails).
- What happens when a user has no country assignment and a notification is triggered? Country-scoped notifications are only sent to users assigned to the relevant country. Users without assignments do not receive country-specific notifications.
- What happens when the email provider is completely down for an extended period? Emails are queued with a maximum retention of 72 hours. After that, unsent emails are logged as failed and the in-app notification remains as the record.
- What happens when a user deletes their account? Their unread notifications are discarded. Sent email notifications cannot be recalled.
- What happens when the inbound mailbox receives spam or automated replies? The system only processes emails from registered user addresses. All others receive the standard rejection reply. To prevent mail loops, the system does not reply to emails that appear to be automated (e.g., contain auto-reply headers like `Auto-Submitted: auto-replied`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create in-app notifications for the following events: receipt flagged, receipt approved, receipt rejected, budget proposal submitted, budget proposal approved, budget proposal rejected, over-budget threshold crossed, new user pending SSO approval.
- **FR-002**: In-app notifications MUST include a link to the relevant entity (receipt, proposal, user) so the recipient can navigate directly to it.
- **FR-003**: System MUST display an unread notification count badge on a bell icon in the application navigation bar, visible on all pages.
- **FR-004**: System MUST provide a notification panel listing all notifications in reverse chronological order, with unread items visually distinguished from read items.
- **FR-005**: Users MUST be able to mark individual notifications as read, or mark all notifications as read at once. Notifications are retained indefinitely (no auto-cleanup).
- **FR-006**: System MUST send email notifications for the same events as in-app notifications, respecting per-user email preferences.
- **FR-007**: Email notifications MUST include a direct link to the relevant item in the application.
- **FR-008**: Users MUST be able to configure which notification types they receive via email. In-app notifications are always delivered and cannot be disabled.
- **FR-009**: The email transport layer MUST support two interchangeable providers — standard SMTP and Microsoft Graph Send Mail — configured via environment variable without code changes.
- **FR-010**: System MUST process inbound emails sent to a dedicated receipts address: extract file attachments, match sender to a registered user, and create incomplete receipt records (file stored, no budget item/country/year assigned). The user completes assignment in the app.
- **FR-011**: When an inbound email contains multiple valid attachments, the system MUST create one receipt record per attachment.
- **FR-012**: After processing an inbound email, the system MUST send a confirmation reply to the sender listing created receipt IDs, or a rejection reply if the sender is not a registered user or no valid attachments were found.
- **FR-013**: Inbound email processing MUST reject attachments that are not PDF, JPEG, or PNG, or that exceed 20 MB.
- **FR-014**: Inbound email processing MUST trigger AI extraction and classification (Feature 5) on created receipts when AI processing is available. The email body text MUST be provided as additional context to the AI for extraction hints (amount, vendor, description).
- **FR-015**: System MUST NOT send automated replies to emails that contain auto-reply headers (to prevent mail loops).
- **FR-016**: Email delivery failures MUST be retried (up to 3 attempts). Failed emails MUST be logged. In-app notifications MUST still be delivered regardless of email delivery status.
- **FR-017**: Over-budget notifications MUST be sent only once per budget item per threshold crossing (no duplicate alerts for additional receipts after the item is already over-budget).
- **FR-018**: All notification-related user-facing text MUST be available in all supported languages (en, de, es, fr, pt).
- **FR-019**: Notification emails MUST be sent in the recipient's preferred locale.

### Key Entities

- **Notification**: A record of a workflow event relevant to a user. Has a type (receipt_flagged, receipt_approved, etc.), recipient, link to the related entity, read/unread status, and creation timestamp.
- **Notification Preference**: Per-user, per-notification-type setting for email delivery (enabled/disabled). In-app delivery is always on.
- **Inbound Email Record**: A log entry for each processed inbound email, tracking sender, attachment count, created receipt IDs, processing status, and any errors.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users see in-app notifications within 5 seconds of the triggering event.
- **SC-002**: Email notifications are sent within 2 minutes of the triggering event (under normal provider availability).
- **SC-003**: 100% of workflow events listed in FR-001 generate the correct in-app notification to the correct recipient(s).
- **SC-004**: Inbound emails with valid attachments from registered users result in receipt records within 5 minutes of email arrival.
- **SC-005**: Users can configure notification preferences and see changes take effect immediately for subsequent events.
- **SC-006**: Switching email providers (between the two supported options) requires only environment variable changes — no code deployment.

## Assumptions

- The inbound email address is provisioned and accessible by the application (either via a polling mechanism or webhook/push from the mail provider). The specific polling/push mechanism will be determined during planning.
- The application has network access to the configured email provider (SMTP server or Microsoft Graph endpoint).
- Email notification volume is low (~10 users, tens of notifications per day) — no need for high-throughput email infrastructure.
- Over-budget detection runs synchronously when a receipt is saved (checking the budget item's total actual spend against planned amount).
- Notification preferences default to "email enabled" for all types when a new user is created.

## Scope Boundaries

**In scope**:
- In-app notifications (bell icon, notification panel, unread count)
- Email notifications with dual-provider support (SMTP and Microsoft Graph)
- Per-user email notification preferences
- Inbound email-to-receipt processing
- Confirmation and rejection replies for inbound emails
- Over-budget threshold notifications
- Notification history with read/unread tracking
- Mail loop prevention for automated replies

**Out of scope (later features)**:
- Push notifications (browser push, mobile push)
- Real-time WebSocket notification delivery (polling is sufficient for ~10 users)
- Notification digest/summary emails (daily/weekly rollups)
- Custom notification rules or filters beyond type-based preferences
- SMS notifications
- Email template designer or customization UI

## Dependencies

- **Feature 1 (Budget Planning & Core Data Model)**: Receipts, budget items, budget proposals, user roles, country assignments.
- **Feature 2 (Receipt Review & Audit Dashboard)**: Receipt review status changes (flagged, approved, rejected) trigger notifications.
- **Feature 5 (AI Receipt Processing)**: Optional — AI processing runs on email-submitted receipts if available.
