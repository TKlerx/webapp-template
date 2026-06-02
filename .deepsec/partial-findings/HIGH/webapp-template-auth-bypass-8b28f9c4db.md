# [HIGH] Environment-gated mock SSO endpoint can take over existing accounts

**File:** [`src/app/api/auth/sso/azure/route.ts`](https://github.com/TKlerx/webapp-template/blob/main/src/app/api/auth/sso/azure/route.ts#L44-L120) (lines 44, 52, 62, 83, 90, 107, 120)
**Project:** webapp-template
**Severity:** HIGH  •  **Confidence:** high  •  **Slug:** `auth-bypass`

## Owners

**Suggested assignee:** `tklerx@paiqo.com` _(via last-committer)_

## Finding

When E2E_MOCK_SSO=1 and the environment is non-production or E2E_TESTING=1, this public GET/POST handler accepts an attacker-controlled email query parameter, derives a deterministic password from it, upserts the user, creates or overwrites that user's credential account password, and immediately signs in with that password. For an existing active user, an attacker can request the endpoint with the victim email and receive a valid session; the credential password remains usable afterward. The production guard still permits this path when E2E_TESTING=1, and the branch has no authentication, domain allowlist, existing-user restriction, or rate limit.

## Recommendation

Remove the mock SSO branch from production-shipped route code. If test SSO must remain, compile it only into test builds or require a server-side test-only secret, restrict it to isolated test users, never overwrite existing credential accounts, never create persistent passwords, and fail closed for any production deployment regardless of E2E_TESTING.

## Recent committers (`git log`)

- Timo Klerx <tklerx@paiqo.com> (2026-05-11)
