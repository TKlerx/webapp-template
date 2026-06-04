# [MEDIUM] Delegated Microsoft Graph tokens are stored and propagated in plaintext

**File:** [`src/services/teams/consent.ts`](https://github.com/TKlerx/webapp-template/blob/main/src/services/teams/consent.ts#L121-L171) (lines 121, 122, 128, 129, 171)
**Project:** webapp-template
**Severity:** MEDIUM  •  **Confidence:** high  •  **Slug:** `secrets-exposure`

## Owners

**Suggested assignee:** `tklerx@paiqo.com` _(via last-committer)_

## Finding

saveTeamsDelegatedGrant persists raw Microsoft Graph access and refresh tokens directly in TeamsDelegatedGrant, and getFreshTeamsDelegatedAccessToken returns the raw bearer token. Tracing the call flow shows queueTeamsMessages writes that delegatedAccessToken into BackgroundJob.payload, while the background job APIs and admin page render job payloads. A platform admin, database reader, backup reader, or job-payload exposure can exfiltrate a usable delegated Graph token and send Teams messages as the consenting user until token expiry or revocation; the refresh token persistence also extends the impact of a database compromise.

## Recommendation

Encrypt delegated access and refresh tokens at rest with a server-side key/KMS, avoid storing short-lived access tokens when a refresh token is available, and do not place bearer tokens in background job payloads. Store a grant/user reference in the job and let the worker fetch/decrypt the token just in time. Redact token-shaped fields from job list APIs and admin UI.

## Recent committers (`git log`)

- Timo Klerx <tklerx@paiqo.com> (2026-05-11)
