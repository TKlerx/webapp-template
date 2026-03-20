# Quickstart: Email & Notifications

**Date**: 2026-03-20
**Prerequisites**: Feature 1 (budget planning & receipts), Feature 2 (receipt review workflow) implemented.

## Setup

### Install Dependencies

```bash
npm install nodemailer @microsoft/microsoft-graph-client @azure/identity
npm install -D @types/nodemailer
```

### Run Migration

```bash
npm run prisma:migrate
npm run prisma:generate
```

### Environment Variables

Add to `.env`:

```env
# Mail provider: "smtp" or "graph"
MAIL_PROVIDER=smtp

# SMTP configuration (when MAIL_PROVIDER=smtp)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@gvi-finance.org
SMTP_PASS=your-smtp-password
SMTP_FROM=GVI Finance <notifications@gvi-finance.org>

# Microsoft Graph configuration (when MAIL_PROVIDER=graph)
GRAPH_CLIENT_ID=your-azure-app-client-id
GRAPH_CLIENT_SECRET=your-azure-app-client-secret
GRAPH_TENANT_ID=your-azure-tenant-id

# Inbound email
INBOUND_MAILBOX=receipts@gvi-finance.org

# Webhook security
INBOUND_WEBHOOK_SECRET=your-random-webhook-secret

# Application URL (for links in emails)
APP_URL=https://your-gvi-finance-instance.example.com
```

## Key Workflows

### 1. Configure Mail Provider

**SMTP** (default): Set `MAIL_PROVIDER=smtp` and provide `SMTP_*` variables. Works with any SMTP server (Gmail, Outlook, Amazon SES, self-hosted).

**Microsoft Graph**: Set `MAIL_PROVIDER=graph` and provide `GRAPH_*` variables. Requires an Azure AD app registration with `Mail.Send` permission. Uses the same tenant as the SSO configuration from the auth setup.

Switching providers requires only changing environment variables and restarting the server — no code changes (FR-009).

### 2. Trigger a Notification

Notifications are triggered automatically by workflow events:

1. Admin reviews a receipt (flags, approves, or rejects) -- triggers notification to the receipt uploader
2. Country Admin submits a budget proposal -- triggers notification to all GVI Finance admins
3. Admin approves/rejects a budget proposal -- triggers notification to the submitting Country Admin
4. A new user registers via SSO -- triggers SSO_APPROVAL_PENDING notification to admins

Each event creates an in-app notification immediately. If the recipient has email enabled for that notification type, an email is dispatched asynchronously.

### 3. Process Inbound Email (Email-to-Receipt)

**Setup with Microsoft Graph**:
1. Register a Graph subscription for the inbound mailbox (POST to `/subscriptions`)
2. Point the notification URL to `{APP_URL}/api/inbound-email/webhook`
3. Include the `INBOUND_WEBHOOK_SECRET` for validation

**Processing flow**:
1. User emails a receipt image to `receipts@gvi-finance.org`
2. Webhook receives notification of new email
3. System fetches the email, matches sender to a registered user
4. Creates incomplete receipt(s) — one per valid attachment (PDF/JPEG/PNG, under 20 MB)
5. Triggers AI extraction if Feature 5 is active (email body text used as context)
6. Sends confirmation reply with receipt IDs and link to complete in app
7. User opens app, reviews AI suggestions, assigns budget item/country/year, submits

### 4. Manage Notification Preferences

1. User navigates to Settings > Notifications
2. Sees a list of all notification types with email toggle for each
3. Toggles off email for types they don't want emailed (in-app always stays on)
4. Changes take effect immediately for subsequent events

### 5. View Notification History

1. User clicks the bell icon in the nav bar
2. Dropdown shows recent notifications with unread count
3. Clicking a notification navigates to the related entity and marks it as read
4. "View All" opens the full notification history page with filters and "Mark all read"

## Development Tips

- **Testing email locally**: Use `MAIL_PROVIDER=smtp` with a local SMTP tool like [Mailpit](https://github.com/axllent/mailpit) (`SMTP_HOST=localhost`, `SMTP_PORT=1025`). Mailpit provides a web UI to inspect sent emails.
- **Testing inbound email locally**: Call the webhook endpoint directly with a test payload via curl or Postman.
- **Notification polling**: The bell component polls every 30 seconds. During development, you can lower this interval in `NotificationBell.tsx`.
