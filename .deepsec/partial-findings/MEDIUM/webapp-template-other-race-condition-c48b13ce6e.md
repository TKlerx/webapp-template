# [MEDIUM] CLI authorization codes are not consumed atomically

**File:** [`src/services/api/cli-auth.ts`](https://github.com/TKlerx/webapp-template/blob/main/src/services/api/cli-auth.ts#L60-L90) (lines 60, 68, 79, 90)
**Project:** webapp-template
**Severity:** MEDIUM  •  **Confidence:** high  •  **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `tklerx@paiqo.com` _(via last-committer)_

## Finding

exchangeAuthCode first reads the code and checks exchanged=false, then creates a CLI token, and only afterward updates the auth code to exchanged=true. Concurrent exchanges for the same code and state can pass the initial check before either update occurs, resulting in multiple active CLI tokens. If token creation succeeds but the exchanged update fails, the code also remains redeemable.

## Recommendation

Consume the authorization code atomically. Use a transaction with a conditional update/updateMany requiring exchanged=false, matching state, userId present, and expiresAt in the future, then create the token only if exactly one row was consumed.

## Recent committers (`git log`)

- Timo Klerx <tklerx@paiqo.com> (2026-04-10)
