# Quickstart: Teams Messaging Skeleton

## Prerequisites

1. **Azure AD App Registration** — the existing app registration (used for SSO) needs additional Graph API permissions:
   - `ChannelMessage.Send` (Delegated) and `offline_access`
   - `ChannelMessage.Read.All` (Application)
   - Admin consent granted in Azure portal

2. **Teams Channel** — at least one Teams team + channel for testing outbound delivery

3. **Environment** — existing `.env` already has:
   ```
   AZURE_AD_CLIENT_ID=...
   AZURE_AD_CLIENT_SECRET=...
   AZURE_AD_TENANT_ID=...
   ```
   Add:
   ```
   TEAMS_ENABLED=true
   TEAMS_POLL_INTERVAL_SECONDS=60
   APP_INTERNAL_URL=http://localhost:3270
   TEAMS_DELIVERY_SHARED_SECRET=<same-random-value-at-least-32-characters-in-app-and-worker>
   ```

## Setup Steps

1. Add Graph API permissions in Azure portal for the existing app registration
2. Run `pnpm run prisma:migrate` to create new Teams tables
3. Run `pnpm run prisma:generate` to update Prisma client
4. Start dev server: `pnpm run dev`
5. Start worker: `cd worker && uv run python -m starter_worker.main`
6. Open the avatar admin navigation and navigate to Settings -> Integrations -> Teams
7. Enable Teams integration (send toggle)
8. Connect delegated Teams consent as the administrator who will create the delivery target, then add the target (paste team ID + channel ID). Sending uses this owner's identity; the owner must remain an active platform administrator with channel access.
9. Trigger a notification event (e.g., create a user) → message appears in Teams channel

## Testing Outbound (P1)

Include `BASE_PATH` in `APP_INTERNAL_URL` when configured. Compose supplies the internal app URL automatically; set the shared secret in `.env.docker`. Azure provisions the delivery secret in Key Vault and exposes the grant encryption key only to the app. Tokens never pass through jobs or the internal endpoint response.

1. Configure one delivery target
2. Enable send
3. Create a new user via admin UI → triggers USER_CREATED event
4. Check Teams channel for message
5. Check admin status view for delivery record

## Testing Intake (P2)

1. Add an intake subscription (team + channel)
2. Enable intake
3. Post a message in the subscribed Teams channel
4. Wait for next poll cycle (default 60s)
5. Check admin status view for ingested message record

## Testing Safety Controls (P3)

1. View integration status dashboard
2. Disable send → verify no new outbound messages
3. Disable intake → verify no new inbound polling
4. Re-enable and verify resumption
