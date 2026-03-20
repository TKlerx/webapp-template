# Data Model: Email & Notifications

**Date**: 2026-03-20

## New Enums

### NotificationType
```prisma
enum NotificationType {
  RECEIPT_FLAGGED
  RECEIPT_APPROVED
  RECEIPT_REJECTED
  PROPOSAL_SUBMITTED
  PROPOSAL_APPROVED
  PROPOSAL_REJECTED
  OVER_BUDGET
  SSO_APPROVAL_PENDING
}
```

### InboundEmailStatus
```prisma
enum InboundEmailStatus {
  RECEIVED
  PROCESSING
  COMPLETED
  FAILED
  REJECTED
}
```

## New Models

### Notification

Stores in-app notifications for workflow events. Retained indefinitely.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | Primary key |
| recipientId | String | FK -> User | User who receives this notification |
| type | NotificationType | | Event type enum |
| entityType | String | | Type of linked entity: "receipt", "proposal", "user" |
| entityId | String | | ID of the linked entity |
| title | String | | Short notification title (translated at creation time) |
| message | String | | Notification body text (translated at creation time) |
| isRead | Boolean | @default(false) | Read/unread status |
| createdAt | DateTime | @default(now()) | When the notification was created |

**Relations**: `recipient` -> User (many-to-one)
**Indexes**: `@@index([recipientId, isRead])`, `@@index([recipientId, createdAt])`

```prisma
model Notification {
  id          String           @id @default(cuid())
  recipientId String
  type        NotificationType
  entityType  String
  entityId    String
  title       String
  message     String
  isRead      Boolean          @default(false)
  createdAt   DateTime         @default(now())

  recipient   User             @relation(fields: [recipientId], references: [id], onDelete: Cascade)

  @@index([recipientId, isRead])
  @@index([recipientId, createdAt])
}
```

### NotificationPreference

Per-user, per-type email delivery preference. In-app delivery is always on and not configurable.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | Primary key |
| userId | String | FK -> User | User who owns this preference |
| notificationType | NotificationType | | Which notification type this applies to |
| emailEnabled | Boolean | @default(true) | Whether email is sent for this type |

**Relations**: `user` -> User (many-to-one)
**Unique constraint**: `@@unique([userId, notificationType])`

```prisma
model NotificationPreference {
  id               String           @id @default(cuid())
  userId           String
  notificationType NotificationType
  emailEnabled     Boolean          @default(true)

  user             User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, notificationType])
}
```

### InboundEmailRecord

Audit log for each inbound email processed by the system.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | @id @default(cuid()) | Primary key |
| messageId | String | @unique | Email Message-ID header (deduplication) |
| senderEmail | String | | Email address of sender |
| senderUserId | String? | FK -> User | Matched user (null if unrecognized) |
| attachmentCount | Int | | Number of attachments in the email |
| receiptIds | String | | JSON array of created receipt IDs (e.g., `["id1","id2"]`) |
| status | InboundEmailStatus | | Processing status |
| errorMessage | String? | | Error details if FAILED or REJECTED |
| processedAt | DateTime? | | When processing completed |
| createdAt | DateTime | @default(now()) | When the email was received |

**Relations**: `senderUser` -> User (many-to-one, optional)
**Indexes**: `@@index([senderEmail])`, `@@index([status])`

```prisma
model InboundEmailRecord {
  id              String             @id @default(cuid())
  messageId       String             @unique
  senderEmail     String
  senderUserId    String?
  attachmentCount Int
  receiptIds      String             @default("[]")
  status          InboundEmailStatus
  errorMessage    String?
  processedAt     DateTime?
  createdAt       DateTime           @default(now())

  senderUser      User?              @relation(fields: [senderUserId], references: [id], onDelete: SetNull)

  @@index([senderEmail])
  @@index([status])
}
```

## Changes to Existing Models

### User (add relations)

Add the following relation fields to the existing User model:

```prisma
// Add to User model
notifications             Notification[]
notificationPreferences   NotificationPreference[]
inboundEmails             InboundEmailRecord[]
```

## New Audit Actions

Add to the existing audit action constants:

| Action | Description |
|--------|-------------|
| `NOTIFICATION_SENT` | A notification (in-app and/or email) was created and dispatched |
| `INBOUND_EMAIL_PROCESSED` | An inbound email was successfully processed into receipt(s) |
| `INBOUND_EMAIL_REJECTED` | An inbound email was rejected (unrecognized sender, no valid attachments, etc.) |

## Validation Rules

1. **Notification title/message**: Max 500 characters each. Stored in the recipient's locale at creation time.
2. **NotificationPreference**: One record per user per notification type. Created with `emailEnabled: true` by default when a user first accesses preferences (lazy initialization).
3. **InboundEmailRecord.messageId**: Must be unique to prevent duplicate processing of the same email.
4. **InboundEmailRecord.receiptIds**: Stored as a JSON string array since SQLite does not support array fields. Parse with `JSON.parse()` on read.
5. **Attachment validation**: Only PDF, JPEG, PNG accepted. Max 20 MB per file.
