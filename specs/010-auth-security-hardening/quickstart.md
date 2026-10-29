# Quickstart: Auth Security Hardening

**Feature**: 010-auth-security-hardening | **Date**: 2026-04-01

## Prerequisites

- Node.js 20+
- Project dependencies installed (`pnpm install`)
- Database initialized (`pnpm run prisma:migrate && pnpm run prisma:seed`)
- `.env` file configured (copy from `.env.example`)

## What This Feature Changes

1. **Rate limiting** on login and change-password endpoints (5 attempts in a sliding 15-minute window; full 15-minute cooldown after the threshold, in-memory). Later trusted-proxy and account protections remain in place.
2. **Proxy trust hardening** — forwarded headers only trusted when `AUTH_BASE_URL` is explicitly set
3. **SSO identity safety** — removes unsigned id_token fallback; mock SSO blocked in production
4. **Status filter validation** — `/api/users?status=INVALID` now returns 400 instead of failing silently
5. **Audit trail** — all auth and user-admin actions now create audit entries
6. **Seed password validation** — initial admin password must meet complexity requirements

## Files Changed

### New files

- `src/lib/rate-limit.ts` — In-memory rate limiter utility
- `tests/unit/rate-limit.test.ts` — Rate limiter unit tests

### Modified files

- `src/app/api/auth/login/route.ts` — Rate limiting + audit
- `src/app/api/auth/logout/route.ts` — Audit
- `src/app/api/auth/change-password/route.ts` — Rate limiting + audit
- `src/app/api/auth/sso/azure/route.ts` — Production gate on mock SSO
- `src/app/api/users/route.ts` — Status filter validation + audit
- `src/app/api/users/[id]/approve/route.ts` — Audit
- `src/app/api/users/[id]/deactivate/route.ts` — Audit
- `src/app/api/users/[id]/reactivate/route.ts` — Audit
- `src/app/api/users/[id]/role/route.ts` — Audit
- `src/lib/audit.ts` — Add `safeLogAudit` wrapper (log-and-continue)
- `src/lib/azure-auth.ts` — Remove id_token fallback, tighten `getExternalOrigin`
- `src/lib/better-auth.ts` — Conditional `trustedProxyHeaders`
- `prisma/schema.prisma` — Add `AUTH_PASSWORD_CHANGED` to AuditAction enum
- `prisma/seed.ts` — Add password complexity validation

## How to Verify

```bash
# Run all checks
pnpm run validate

# Run unit tests (includes rate limiter tests)
pnpm test

# Run E2E tests
pnpm run test:e2e

# Manual verification: attempt 6 rapid login failures
# → 6th attempt should return 429 with Retry-After header
```

## Implementation Alignment (2026-10-15)

- First attempt at 10:00 and fifth at 10:14: subsequent attempts stay blocked until 10:29, not merely until 10:15. Rejected retries do not extend that cooldown.
- Invalid payloads, wrong passwords (including known users), unknown accounts and rate-limited login attempts create best-effort audit records. Rejected unauthenticated actors are null; target accounts are not misidentified as actors.
- Unknown/pre-lookup targets use a random LoginAttempt identifier. Submitted passwords and raw email are not stored in these audit details. The existing log-and-continue policy still applies if audit storage fails.
- Apply migration `20261015010000_allow_anonymous_audit_actors` before deploying the updated handler: `pnpm run prisma:deploy` with the intended PostgreSQL deployment connection configured. Spec 022 supersedes the former dual-database setup.
- Anonymous records are supported in the translated audit viewer and CSV/PDF exports.
- Regression command: `pnpm exec vitest run tests/unit/rate-limit.test.ts tests/unit/auth/login-route.test.ts tests/integration/anonymous-audit-migration.test.ts tests/unit/audit.test.ts tests/unit/audit-trail.test.ts`.

## Environment Variables

No new environment variables. Existing `AUTH_BASE_URL` behavior is tightened:

- **Set**: Forwarded proxy headers are trusted (existing behavior)
- **Unset**: Only `request.url` origin is used (hardened behavior — forwarded headers ignored)
