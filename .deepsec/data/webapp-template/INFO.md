# webapp-template

## What this codebase does

Reusable internal business-app starter built with Next.js 16 App Router, React 19, Better Auth, Prisma 7, SQLite for local dev, PostgreSQL for Docker/production-style deployment, a Go PAT-backed CLI, and a uv-managed Python worker. It provides admin/user management, RBAC, audit trail/export, PAT and CLI-login tokens, Azure SSO/local password login, Microsoft Graph mail, Teams delivery/intake, notifications, i18n, theme preferences, and continuity/spec maintenance tooling.

## Auth shape

- `getSessionUser()` and `requireSession()` are the server-page/session primitives; inactive users return null and pending users redirect to `/pending`.
- `requireApiUser()`, `requireApiUserWithRoles()`, and `authorizeRoute()` wrap API route authorization through `authorizeRouteContext()`.
- `resolveTokenUser()` accepts PAT/CLI tokens from `Authorization: Bearer` or `x-api-key`; tokens are SHA-256 hashed at rest and rejected when expired, revoked, inactive, or pending.
- RBAC is enum-based: `Role.PLATFORM_ADMIN` is global admin; `SCOPE_ADMIN` and `SCOPE_USER` are scoped roles checked with `checkRole()` and `checkScopeAccess()`.
- `src/proxy.ts` handles page-level session redirects and public paths, but API routes must call route auth explicitly.

## Threat model

Highest-impact targets are global admin actions, user approval/role changes, PAT/CLI token issuance or renewal, and stored Microsoft Graph delegated/application credentials. A practical attacker may try to bypass route-level auth on App Router handlers, abuse public auth/CLI callback flows, exfiltrate tokens through logs/job payloads, or use background-job and Graph integration paths to act as trusted users. Tenant/scope boundaries matter: any path that accepts a `scopeId`, Teams target, mailbox, token id, or user id should prove ownership or require `PLATFORM_ADMIN`.

## Project-specific patterns to flag

- Any `src/app/api/**/route.ts` that mutates users, tokens, audit data, notifications, Teams config, or background jobs without `requireApiUser*()` or `authorizeRoute()`.
- API handlers that call `requireApiUser()` without passing `request` when PAT/CLI access is intended; omitting `request` makes token auth unavailable and can create inconsistent auth behavior.
- Redirect builders must reject protocol-relative or absolute attacker input; local examples include `getSafeRedirectTarget()`, `isValidCliCallbackUrl()`, and Teams consent redirect handling.
- Graph and Teams flows store or pass access/refresh tokens through `TeamsDelegatedGrant`, background-job payloads, and worker calls; check for logging, persistence, or client response exposure.
- Runtime DB URL separation is intentional: app uses `APP_DATABASE_URL`, worker uses `WORKER_DATABASE_URL`, migrations/seeding use `MIGRATION_DATABASE_URL`; shared `DATABASE_URL` fallback exists mainly for local/back-compat paths.

## Known false-positives

- `src/app/api/health/route.ts`, `src/app/api/openapi/route.ts`, `src/app/api/locale/route.ts`, and Better Auth/public login/session endpoints are intentionally public or unauthenticated.
- `.env.example`, `.env.docker.example`, and `scripts/testdata/runtime-credentials/**` contain placeholder or deliberately invalid secret-looking values for validation tests.
- `dev.db`, `e2e.db`, `worker/dev.db`, coverage, `.next`, `.runlogs`, and generated Prisma output are local/generated artifacts, not source-of-truth application code.
- `scripts/seed-initial-admin.mjs` and `prisma/seed.ts` handle bootstrap admin creation and intentionally read `INITIAL_ADMIN_EMAIL/PASSWORD`; production rejects the default password.
- Python worker job handlers process trusted DB-backed background jobs and Graph responses; treat inbound mail/Teams message content as untrusted, but job polling itself is not an HTTP entry point.
