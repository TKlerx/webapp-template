# [MEDIUM] Public CLI authorization can create unbounded database rows

**File:** [`src/services/api/cli-auth.ts`](https://github.com/TKlerx/webapp-template/blob/main/src/services/api/cli-auth.ts#L28-L118) (lines 28, 29, 31, 34, 118)
**Project:** webapp-template
**Severity:** MEDIUM  •  **Confidence:** high  •  **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `tklerx@paiqo.com` _(via last-committer)_

## Finding

createAuthCode writes a CliAuthCode row for the public /api/cli-auth/authorize flow. The caller validates only that callback_url is local and state is non-empty, with no rate limit, length limit, or guaranteed cleanup path. Expired codes are deleted only when the token exchange endpoint runs cleanupExpiredCodes, so an unauthenticated attacker can repeatedly hit the authorize endpoint and grow the database with stale auth-code records.

## Recommendation

Add rate limiting to the authorize endpoint, enforce maximum lengths for state and callbackUrl, run cleanup on authorize as well as exchange or via a scheduled job, and consider a database TTL/retention policy for expired CLI auth codes.

## Recent committers (`git log`)

- Timo Klerx <tklerx@paiqo.com> (2026-04-10)
