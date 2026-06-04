# [MEDIUM] E2E server uses static admin and mock SSO credentials

**File:** [`playwright.config.ts`](https://github.com/TKlerx/webapp-template/blob/main/playwright.config.ts#L20-L35) (lines 20, 28, 29, 30, 31, 32, 33, 34, 35)
**Project:** webapp-template
**Severity:** MEDIUM  •  **Confidence:** medium  •  **Slug:** `dev-auth-bypass`

## Owners

**Suggested assignee:** `tklerx@paiqo.com` _(via last-committer)_

## Finding

The Playwright config starts the app with `pnpm run build && pnpm run start`, which exercises the production-mode app server, while injecting static E2E auth material: default initial admin credentials, a static BetterAuth secret, `E2E_TESTING=1`, `E2E_MOCK_SSO=1`, and a static mock SSO header secret. Tracing the flow shows `tests/e2e/global.setup.ts` seeds the E2E database with those credentials, and `src/app/api/auth/sso/azure/route.ts` accepts mock SSO in production mode when `E2E_TESTING` is enabled and the request supplies the matching header secret. If this Playwright web server is reachable from an untrusted network, such as an exposed CI runner or shared development host, an attacker who knows the repository values can authenticate as the seeded admin or use mock SSO against existing accounts.

## Recommendation

Generate a per-run random admin password and mock SSO secret in Playwright setup, pass them only to the test process and web server, and avoid hardcoded fallback secrets. Also bind the E2E server to loopback or an isolated CI network, and make production-mode mock SSO reject known/default test secrets.

## Revalidation

**Verdict:** true-positive

The Playwright config still starts a production-mode server with `pnpm run build && pnpm run start` and injects static E2E auth material, including `admin@example.com`, `ChangeMe123!`, a fixed Better Auth secret, `E2E_TESTING=1`, `E2E_MOCK_SSO=1`, and `E2E_MOCK_SSO_SECRET=e2e-mock-sso-secret`. `tests/e2e/global.setup.ts` provisions `file:./e2e.db` using those default initial admin credentials when env overrides are absent. `prisma/seed.ts` creates that initial user as an ACTIVE `PLATFORM_ADMIN` with a credential account, so the static password is enough for a direct login if the E2E server is reachable. The mock SSO route currently has a production guard, but it explicitly allows mock SSO when `E2E_TESTING=1` and the request supplies `x-e2e-mock-sso-secret` matching the env secret, which is hardcoded in this config and in the E2E helper. For an existing admin email, the mock SSO branch preserves the existing role/status, updates the credential password to a deterministic mock password, and signs the user in. `scripts/run-next.mjs` passes only `--port` to Next and does not force a loopback hostname, so the repository code does not itself prevent exposure on a shared host or misconfigured CI runner. This is conditional on network reachability of the Playwright web server, but under that condition the attacker has a concrete path to authenticate as the seeded admin using repository-known values.

## Recent committers (`git log`)

- Timo Klerx <tklerx@paiqo.com> (2026-05-20)
