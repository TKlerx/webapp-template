# Research: Teams Messaging Skeleton

**Feature**: 015-teams-messaging-skeleton
**Date**: 2026-04-26

## R1: Microsoft Graph API for Teams Channel Messaging

**Decision**: Send via Microsoft Graph v1.0 using the delivery target creator's delegated `ChannelMessage.Send` grant. Read via application `ChannelMessage.Read.All`. The April delegated-consent clarification and user-approved 2026-10-15 reconciliation supersede the original app-only send decision.

**Rationale**: Channel sending requires delegation. The administrator consents once; the app encrypts the grant and refreshes it for background sends. The worker retains application credentials for read-only intake, without receiving delegated tokens or their encryption key.

**Key endpoints**:

- Send to channel: `POST /teams/{team-id}/channels/{channel-id}/messages`
- List channel messages: `GET /teams/{team-id}/channels/{channel-id}/messages` (with `$top` and delta query)
- Required permissions: `ChannelMessage.Send` (delegated), `offline_access` (refresh), `ChannelMessage.Read.All` (application intake).

**Alternatives considered**:

- Bot Framework: More complex, requires bot registration, webhook endpoint. Overkill for skeleton scope. TeamsClient abstraction keeps this as future migration path.
- Power Automate / Webhooks: Incoming webhooks are simpler for send-only but don't support read. Deprecated path for new integrations.
- App-only sending: Rejected; ordinary channel sending uses delegated consent. A refreshable grant supports background delivery without interactive sign-in for every job.

## R2: Credential Reuse — Extending Azure AD App Registration

**Decision**: Extend the existing Azure AD app registration (used for SSO) with additional Graph API permissions for Teams. No new app registration needed.

**Rationale**: Spec clarification confirms credential reuse. The existing env vars (`AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`) already hold the client credentials. The token endpoint is the same. Only the requested scopes change.

**New env vars needed**:

- `TEAMS_ENABLED` — feature flag (default: `false`)
- `TEAMS_POLL_INTERVAL_SECONDS` — intake polling frequency (default: `60`)

The existing registration gets the additional permissions. `TEAMS_DELIVERY_SHARED_SECRET` authenticates worker-to-app delivery (minimum 32 random characters); `APP_INTERNAL_URL` includes the deployment base path. `TEAMS_DELEGATED_GRANT_ENCRYPTION_KEY` stays app-only, falling back to `BETTER_AUTH_SECRET`.

## R3: Outbound Message Delivery Pattern

**Decision**: Queue `teams_message_delivery`; the worker claims it and submits only its job ID to `POST /api/internal/teams/deliver`. The app loads persisted target/content, verifies send controls and an active platform-admin owner, refreshes that owner's grant, sends, and saves the Graph receipt before responding. Replayed successful jobs reuse the receipt. Never put delegated tokens in job payloads or worker configuration.

**Rationale**: Proven pattern from spec 014. Worker already handles `notification_delivery` jobs with retry logic (3 attempts, configurable backoff). Teams delivery needs identical semantics: queue → claim → send → record outcome.

**Payload structure** (BackgroundJob.payload):

```json
{
  "teamsOutboundMessageId": "cuid",
  "targetId": "cuid",
  "teamId": "graph-team-id",
  "channelId": "graph-channel-id",
  "content": "message body (HTML or text)",
  "contentType": "html"
}
```

**Retry**: At most 3 attempts, further bounded by `WORKER_MAX_ATTEMPTS`, at a fixed `WORKER_RETRY_BACKOFF_SECONDS` interval. Permanent failure is surfaced in admin status. Other job types retain their existing retry timing.

## R4: Inbound Message Intake Pattern

**Decision**: Follow the existing `inbound_mail_poll` pattern — periodic `teams_intake_poll` background job fetches new messages from approved conversations via Graph API.

**Rationale**: Spec clarification mandates polling (no webhooks). The mail poll pattern in `main.py` (lines 59–172) demonstrates: list messages → check duplicates → store new records. Teams intake follows the same flow with Teams-specific fields.

**Deduplication**: Use Graph message ID (`message.id`) as `providerMessageId` with unique constraint. Same approach as `InboundEmail.providerMessageId`. Target: <1 duplicate per 1,000 messages (SC-003).

**Channel paging (2026-10-15 correction)**: Use Graph v1.0 `GET /teams/{team-id}/channels/{channel-id}/messages?$top=50`, following `@odata.nextLink` until exhausted. The previously planned channel `/messages/delta` endpoint is not supported by the documented channel API. Each poll scans approved channel pages and deduplicates by provider ID; retained `deltaToken` fields are cleared and reserved for compatibility. Reject continuation links outside the approved Graph channel. This simple history scan suits the stated small-team scope; reconsider change notifications if historical volume makes it costly. Reference: https://learn.microsoft.com/en-us/graph/api/channel-list-messages?view=graph-rest-1.0 .

## R5: Teams Message Size and Formatting

**Decision**: Truncate outbound messages to 28KB (Teams limit is ~28KB for HTML content). Strip unsupported formatting. Log truncation in delivery record.

**Rationale**: Edge case from spec. Teams channels support HTML subset (bold, italic, links, lists). No Adaptive Cards in skeleton scope. If content exceeds limit, truncate with ellipsis marker and record truncation in outbound message record.

**Inbound**: Store raw content snapshot (text + HTML) up to 64KB. Larger messages store truncated preview with flag.

## R6: Independent Send/Read Controls

**Decision**: Two boolean flags in integration config: `sendEnabled` and `intakeEnabled`. Each independently toggleable. Disabling either immediately stops the corresponding background jobs.

**Rationale**: FR-010 requires independent emergency controls. Check intake controls again when processing an already-queued poll; recheck send controls at actual app-side delivery. Already-started provider requests may finish, but no subsequent delivery/poll starts while disabled.

**Implementation**: `TeamsIntegrationConfig` model with `sendEnabled` and `intakeEnabled` booleans. API and UI expose both as independent toggles.

## R7: Admin Status and Health View

**Decision**: Aggregate recent delivery/intake outcomes into a status dashboard showing: integration enabled state, last successful send/read timestamps, recent failure count, and last 20 activity records.

**Rationale**: FR-009 and SC-002 require admin visibility. Follows the pattern of existing notification admin view (`services/notifications/admin.ts`). Query recent `TeamsOutboundMessage` and `TeamsInboundMessage` records with status filters.

Intake failure counts and activity come from failed/retrying `teams_intake_poll` jobs, including failures before any message can be read. An ignored inbound record is not itself a read failure.

**No separate health-check endpoint** — status is served by the same API route that returns integration config, enriched with computed health metrics.
