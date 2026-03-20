# API Contracts: Email & Notifications

**Date**: 2026-03-20

---

## Notifications

### `GET /api/notifications`

List notifications for the authenticated user, with optional filtering and pagination.

**Auth**: Any authenticated user

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number (1-based) |
| limit | number | 20 | Items per page (max 100) |
| type | NotificationType | - | Filter by notification type |
| isRead | boolean | - | Filter by read status ("true" or "false") |

**Response** (200):
```json
{
  "data": [
    {
      "id": "clx...",
      "type": "RECEIPT_FLAGGED",
      "entityType": "receipt",
      "entityId": "clx...",
      "title": "Receipt flagged for correction",
      "message": "Your receipt #R-2026-0042 has been flagged by Admin.",
      "isRead": false,
      "createdAt": "2026-03-20T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "totalPages": 3
  }
}
```

**Errors**:
- 401: Not authenticated

---

### `GET /api/notifications/unread-count`

Get the count of unread notifications for the authenticated user.

**Auth**: Any authenticated user

**Response** (200):
```json
{
  "data": {
    "count": 5
  }
}
```

**Errors**:
- 401: Not authenticated

---

### `PATCH /api/notifications/[id]`

Mark a single notification as read.

**Auth**: Notification recipient only

**Request Body**:
```json
{
  "isRead": true
}
```

**Response** (200):
```json
{
  "data": {
    "id": "clx...",
    "type": "RECEIPT_FLAGGED",
    "entityType": "receipt",
    "entityId": "clx...",
    "title": "Receipt flagged for correction",
    "message": "Your receipt #R-2026-0042 has been flagged by Admin.",
    "isRead": true,
    "createdAt": "2026-03-20T10:30:00.000Z"
  }
}
```

**Errors**:
- 401: Not authenticated
- 403: Not the notification recipient
- 404: Notification not found

---

### `POST /api/notifications/mark-all-read`

Mark all of the authenticated user's notifications as read.

**Auth**: Any authenticated user

**Request Body**: None

**Response** (200):
```json
{
  "data": {
    "updatedCount": 12
  }
}
```

**Errors**:
- 401: Not authenticated

---

## Notification Preferences

### `GET /api/notification-preferences`

Get the authenticated user's notification preferences. Returns one entry per notification type. Types without an explicit preference record are returned with `emailEnabled: true` (the default).

**Auth**: Any authenticated user

**Response** (200):
```json
{
  "data": [
    {
      "notificationType": "RECEIPT_FLAGGED",
      "emailEnabled": true
    },
    {
      "notificationType": "RECEIPT_APPROVED",
      "emailEnabled": true
    },
    {
      "notificationType": "RECEIPT_REJECTED",
      "emailEnabled": false
    },
    {
      "notificationType": "PROPOSAL_SUBMITTED",
      "emailEnabled": true
    },
    {
      "notificationType": "PROPOSAL_APPROVED",
      "emailEnabled": true
    },
    {
      "notificationType": "PROPOSAL_REJECTED",
      "emailEnabled": true
    },
    {
      "notificationType": "OVER_BUDGET",
      "emailEnabled": true
    },
    {
      "notificationType": "SSO_APPROVAL_PENDING",
      "emailEnabled": true
    }
  ]
}
```

**Errors**:
- 401: Not authenticated

---

### `PUT /api/notification-preferences`

Update the authenticated user's notification preferences. Accepts an array of preference objects. Only provided types are updated; omitted types retain their current setting.

**Auth**: Any authenticated user

**Request Body**:
```json
{
  "preferences": [
    {
      "notificationType": "RECEIPT_REJECTED",
      "emailEnabled": false
    },
    {
      "notificationType": "OVER_BUDGET",
      "emailEnabled": true
    }
  ]
}
```

**Validation**:
- `notificationType` must be a valid `NotificationType` enum value
- `emailEnabled` must be a boolean

**Response** (200):
```json
{
  "data": [
    {
      "notificationType": "RECEIPT_FLAGGED",
      "emailEnabled": true
    },
    {
      "notificationType": "RECEIPT_APPROVED",
      "emailEnabled": true
    },
    {
      "notificationType": "RECEIPT_REJECTED",
      "emailEnabled": false
    },
    {
      "notificationType": "PROPOSAL_SUBMITTED",
      "emailEnabled": true
    },
    {
      "notificationType": "PROPOSAL_APPROVED",
      "emailEnabled": true
    },
    {
      "notificationType": "PROPOSAL_REJECTED",
      "emailEnabled": true
    },
    {
      "notificationType": "OVER_BUDGET",
      "emailEnabled": true
    },
    {
      "notificationType": "SSO_APPROVAL_PENDING",
      "emailEnabled": true
    }
  ]
}
```

**Errors**:
- 400: Invalid notification type or missing required fields
- 401: Not authenticated

---

## Inbound Email

### `POST /api/inbound-email/webhook`

Receives inbound email events from the mail provider (Microsoft Graph subscription or IMAP processor). This endpoint is called by the mail infrastructure, not by end users.

**Auth**: Webhook secret validation via `x-webhook-secret` header (shared secret configured in environment)

**Request Body** (from Graph subscription notification):
```json
{
  "value": [
    {
      "subscriptionId": "...",
      "changeType": "created",
      "resource": "users/{mailbox}/messages/{messageId}",
      "resourceData": {
        "id": "AAMk..."
      }
    }
  ]
}
```

**Processing**:
1. Validate webhook secret
2. Fetch full message (with attachments) from Graph API or IMAP
3. Match sender email to registered user
4. If unrecognized sender: create InboundEmailRecord with status REJECTED, send rejection reply
5. If no valid attachments: create InboundEmailRecord with status REJECTED, send "no valid files" reply
6. Filter attachments: accept PDF/JPEG/PNG under 20 MB; reject others
7. Create one incomplete receipt per valid attachment (file stored, no budget item/country/year)
8. Trigger AI extraction on each receipt (if Feature 5 available), passing email body as context
9. Create InboundEmailRecord with status COMPLETED and receipt IDs
10. Send confirmation reply with receipt IDs and link to review in app
11. Skip automated reply if email has `Auto-Submitted` header (loop prevention per FR-015)

**Response** (200 — acknowledge receipt):
```json
{
  "status": "accepted"
}
```

**Response** (200 — Graph subscription validation, when `validationToken` query param present):
Returns the validation token as plain text (required by Graph subscription protocol).

**Errors**:
- 401: Invalid or missing webhook secret
- 400: Malformed request body
