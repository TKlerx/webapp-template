# [HIGH] CLI login grants can be issued by a GET-based CSRF flow

**File:** [`src/services/api/cli-auth.ts`](https://github.com/TKlerx/webapp-template/blob/main/src/services/api/cli-auth.ts#L41-L50) (lines 41, 46, 50)
**Project:** webapp-template
**Severity:** HIGH  •  **Confidence:** high  •  **Slug:** `auth-bypass`

## Owners

**Suggested assignee:** `tklerx@paiqo.com` _(via last-committer)_

## Finding

The CLI login page calls bindAuthCodeToUser during server rendering, and this helper binds any unexpired auth-code id to the currently authenticated user without an explicit approval POST, CSRF token, or session-bound nonce. Because /cli-login?request=<id> is a GET page and SameSite=Lax cookies are sent on top-level navigations, a malicious local process can create a CLI auth request with its localhost callback, open the victim browser to /cli-login?request=<id>, receive the resulting code at its callback, and exchange it for a CLI bearer token for the active user.

## Recommendation

Do not bind or approve CLI auth requests during GET rendering. Render a confirmation page, require an explicit POST protected by a CSRF token/session nonce, bind the request to that browser session, and only then redirect to the localhost callback. Consider adding PKCE-style code verifier binding for the token exchange as defense in depth.

## Recent committers (`git log`)

- Timo Klerx <tklerx@paiqo.com> (2026-04-10)
