# Research: Email & Notifications

**Date**: 2026-03-20

## R1: Mail Transport Abstraction

**Decision**: Use `nodemailer` for SMTP transport and `@microsoft/microsoft-graph-client` for Microsoft Graph Send Mail, both behind a common `MailTransport` interface. Provider is selected at runtime via the `MAIL_PROVIDER` environment variable (`smtp` or `graph`).

**Rationale**: The spec requires two interchangeable email providers with no code changes when switching (FR-009). Both libraries are mature, well-maintained, and widely used. A common interface makes the provider transparent to calling code.

**Alternatives considered**:
- Single provider only (SMTP) -- rejected: spec explicitly requires dual-provider support for Microsoft Graph
- `@azure/communication-email` (Azure Communication Services) -- rejected: adds a third Azure dependency; Microsoft Graph is already needed for SSO and inbound mail
- Custom HTTP-based SMTP client -- rejected: unnecessary when nodemailer handles all SMTP complexity
- `resend` or `sendgrid` SDK -- rejected: introduces external SaaS dependency; SMTP and Graph cover the deployment scenarios

**Implementation**:
```typescript
interface MailTransport {
  send(options: {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
  }): Promise<{ messageId: string }>;
}

class SmtpTransport implements MailTransport { /* nodemailer */ }
class GraphTransport implements MailTransport { /* @microsoft/microsoft-graph-client */ }

function getMailTransport(): MailTransport {
  return process.env.MAIL_PROVIDER === 'graph'
    ? new GraphTransport()
    : new SmtpTransport();
}
```

## R2: Inbound Email Access

**Decision**: Use Microsoft Graph mailbox subscription (webhook) for push-based inbound email notification, with IMAP polling via `nodemailer`/`imapflow` as a fallback for non-Graph deployments.

**Rationale**: For organizations already using Microsoft 365 (which GVI uses for SSO), Graph subscriptions provide near-instant push notification when an email arrives in the dedicated mailbox. The webhook endpoint receives a notification, then the app fetches the email via Graph API. For environments without Graph access, IMAP polling on a configurable interval (e.g., every 60 seconds) provides universal compatibility.

**Alternatives considered**:
- IMAP polling only -- rejected: adds unnecessary latency (up to polling interval) when Graph is available; spec targets processing within 5 minutes but faster is better
- POP3 polling -- rejected: POP3 doesn't support server-side flags/deletion as cleanly as IMAP; less capable protocol
- Forwarding rule to webhook (e.g., via Power Automate) -- rejected: adds external orchestration dependency outside the app
- Dedicated inbound email service (e.g., Mailgun inbound routing, SendGrid Inbound Parse) -- rejected: introduces external SaaS dependency for a feature that can be handled with Graph or IMAP

**Implementation**:
- Graph path: register a subscription on the inbound mailbox via `POST /subscriptions` with `changeType: "created"`, `resource: "users/{mailbox}/mailFolders/Inbox/messages"`. Webhook endpoint validates, fetches message via Graph, processes, and marks as read.
- IMAP path: scheduled job polls the inbox, fetches unseen messages, processes, and marks as seen.
- Both paths funnel into the same `processInboundEmail()` function.

## R3: Notification Delivery Pattern

**Decision**: Synchronous in-app notification creation + asynchronous email dispatch via a simple in-process queue with retry.

**Rationale**: With ~10 users and tens of notifications per day, a full message broker (Redis, RabbitMQ) is over-engineering. The in-app notification is created synchronously within the triggering request so it appears immediately. Email is dispatched asynchronously (fire-and-forget from the request handler's perspective) using a lightweight in-process approach. Failed emails are retried up to 3 times with exponential backoff. This satisfies FR-016 (retry + in-app always delivered) without infrastructure complexity.

**Alternatives considered**:
- Fully synchronous (block request until email sent) -- rejected: email provider latency would slow down UI actions; email failure would need graceful handling in the request flow
- External message queue (Redis/BullMQ, RabbitMQ) -- rejected: over-engineering for ~10 users; adds infrastructure dependency
- Cron-based email batch (process queued emails every N minutes) -- rejected: adds delay beyond what async dispatch provides; more complex than needed
- Next.js `after()` API -- considered viable: Next.js 16 supports `after()` for post-response work, which is a clean fit. Will use this as the primary async mechanism, with a database-backed retry for failures.

**Implementation**:
- Trigger point calls `notificationService.notify(event)`.
- `notify()` creates the Notification record in the database (synchronous, within transaction if applicable).
- `notify()` checks user's NotificationPreference for email.
- If email enabled: uses Next.js `after()` or `setTimeout` to dispatch email without blocking.
- On email failure: logs the failure, increments retry count, schedules retry with backoff.
- After 3 failures: marks as permanently failed, logs for admin review.

## R4: Email Templates

**Decision**: Use next-intl for email template text in the recipient's preferred locale, with simple inline-CSS HTML templates.

**Rationale**: The app already uses next-intl for all UI text (Constitution principle VII: i18n). Reusing it for email templates keeps translation management centralized. Email HTML is kept simple with inline CSS for maximum email client compatibility. No need for a heavy template engine — the emails are short notification messages with a link.

**Alternatives considered**:
- `react-email` library -- rejected: adds a dependency for rendering React components to HTML; over-engineering for simple notification emails
- `mjml` (email markup language) -- rejected: the emails are simple enough that raw HTML with inline CSS suffices; MJML adds build complexity
- Plain text only (no HTML) -- rejected: spec requires links (FR-007) and readable formatting; HTML provides a better experience
- Handlebars/EJS templates -- rejected: adds another template engine when next-intl already handles interpolation and pluralization

**Implementation**:
- Email templates defined as functions that accept `{ locale, data }` and return `{ subject, html }`.
- Translation keys stored in `i18n/messages/{locale}/notifications.json` alongside UI translations.
- Template functions use next-intl's `createTranslator()` API for server-side rendering in the recipient's locale.
- HTML structure: simple single-column layout with header, body text, action button (link), and footer. Inline CSS only.
- Example template keys: `notification.email.receiptFlagged.subject`, `notification.email.receiptFlagged.body`.
