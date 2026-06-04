# [MEDIUM] Concurrent token creation can bypass the active-token limit

**File:** [`src/services/api/tokens.ts`](https://github.com/TKlerx/webapp-template/blob/main/src/services/api/tokens.ts#L145-L151) (lines 145, 146, 151)
**Project:** webapp-template
**Severity:** MEDIUM  •  **Confidence:** high  •  **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `tklerx@paiqo.com` _(via last-committer)_

## Finding

createToken enforces PAT_MAX_ACTIVE_PER_USER with a separate countActiveTokens read before creating the token. Because the count and create are not performed under a per-user lock, serializable transaction, or database-enforced quota, an authenticated user can submit parallel token-creation requests with different names and have each request observe the same below-limit count before all create active tokens. This bypasses the intended active bearer-token limit.

## Recommendation

Enforce the active-token limit atomically, for example by taking a per-user lock inside a transaction, using serializable isolation with retry handling, or maintaining a locked per-user active-token counter before inserting the token.

## Recent committers (`git log`)

- Timo Klerx <tklerx@paiqo.com> (2026-05-11)
