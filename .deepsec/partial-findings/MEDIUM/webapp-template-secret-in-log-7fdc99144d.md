# [MEDIUM] Logger can retain auth secrets in query strings and common token fields

**File:** [`src/lib/logger.ts`](https://github.com/TKlerx/webapp-template/blob/main/src/lib/logger.ts#L16-L136) (lines 16, 44, 68, 131, 136)
**Project:** webapp-template
**Severity:** MEDIUM  •  **Confidence:** medium  •  **Slug:** `secret-in-log`

## Owners

**Suggested assignee:** `tklerx@paiqo.com` _(via last-committer)_

## Finding

The logger only redacts exact object keys from REDACTED_KEYS, preserves Error.message/Error.stack verbatim, and then writes the entry to console. A traced production caller in src/proxy.ts logs request.nextUrl.search for non-static requests, which includes /api/auth/callback/* query strings carrying OAuth code/state values. The redaction set also misses common snake_case OAuth keys such as access_token, refresh_token, id_token, and client_secret. In deployments that collect console logs, short-lived auth codes or token-shaped fields can be retained in durable logs and reused by anyone with log access before expiry.

## Recommendation

Normalize metadata keys before redaction, add common header-case and snake_case secret names, scrub URL/query-string values before logging, and avoid logging raw Error messages/stacks when they can contain upstream auth responses.

## Recent committers (`git log`)

- Timo Klerx <tklerx@paiqo.com> (2026-05-11)
