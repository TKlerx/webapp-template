# Authentication Flows

## Overview

This app uses **BetterAuth v1.5.4** with a custom session layer, bcryptjs password hashing (12 rounds), and Prisma-backed storage. Two login methods: email/password and Azure AD SSO. Self-service signup is disabled; users are created by admins or provisioned on first SSO login.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/better-auth.ts` | BetterAuth configuration |
| `src/lib/auth.ts` | Session management, password hashing/validation |
| `src/lib/azure-auth.ts` | Azure AD OAuth2 helpers |
| `src/lib/rbac.ts` | Role-based access control |
| `src/lib/route-auth.ts` | API route authorization helpers |
| `src/lib/user-management.ts` | User lifecycle (provisioning, approval, deactivation) |
| `src/app/api/auth/login/route.ts` | Email/password login endpoint |
| `src/app/api/auth/logout/route.ts` | Logout endpoint |
| `src/app/api/auth/change-password/route.ts` | Password change endpoint |
| `src/app/api/auth/session/route.ts` | Session info endpoint |
| `src/app/api/auth/sso/azure/route.ts` | Azure SSO initiation |
| `src/app/api/auth/sso/azure/callback/route.ts` | Azure SSO callback handler |
| `src/app/(dashboard)/layout.tsx` | Dashboard layout with auth enforcement |
| `prisma/schema.prisma` | User, Session, Account, Scope models |
| `prisma/seed.ts` | Initial admin user seeding |

---

## 1. Email/Password Login

```
User submits email + password
  → POST /api/auth/login
    → Validate credentials against Prisma DB
    → Check user status (INACTIVE → 403)
    → BetterAuth signInEmail()
    → Update authMethod to BOTH if previously SSO-only
    → Return redirect:
        mustChangePassword=true  → /change-password
        mustChangePassword=false → /dashboard
```

**Component:** `src/components/auth/LoginForm.tsx`

---

## 2. Azure AD SSO Login

```
User clicks "Sign in with Azure AD"
  → GET/POST /api/auth/sso/azure
    → Check Azure AD config is real (not placeholder values)
    → BetterAuth signInSocial({ provider: "microsoft" })
    → Redirect to Azure AD login page
      (scope: openid profile email offline_access, prompt: select_account)

Azure returns authorization code
  → GET /api/auth/sso/azure/callback
    → Redirect to /api/auth/callback/microsoft (BetterAuth standard handler)
    → BetterAuth exchanges code for tokens
    → provisionSsoUser():
        User exists  → update authMethod to BOTH (if was LOCAL)
        User absent  → create with status=PENDING_APPROVAL, authMethod=SSO
    → Create session
    → Redirect to /dashboard (or /pending if PENDING_APPROVAL)
```

**OAuth2 config:** Tenant, client ID/secret from env vars. Scope: `openid profile email offline_access`.

---

## 3. Session Management

Two session layers run in parallel:

1. **BetterAuth session** — managed by the library, stored in Prisma `Session` model
2. **Custom session cookie** (`starter_app_session`) — 32-byte random token, 7-day TTL, httpOnly

**`getSessionUser()`** tries BetterAuth first, falls back to custom session. Returns `null` if user is INACTIVE.

**Session cookie attributes:**
- `httpOnly: true`, `sameSite: "lax"`, `secure` in production
- Path scoped via `getScopedCookiePath()` for reverse-proxy deployments

---

## 4. Route Protection

### Dashboard routes (server-side)
All routes under `src/app/(dashboard)/` call `requireSession()` in the shared layout:
- Not authenticated → redirect to `/login`
- Status PENDING_APPROVAL → redirect to `/pending`
- Authenticated + ACTIVE → render page

### API routes
`src/lib/route-auth.ts` provides:
- **`requireApiUser()`** — returns authenticated user or error response
- **`requireApiUserWithRoles(roles)`** — user + role check
- **`authorizeRoute(request, options)`** — full auth + role + scope validation

---

## 5. Role-Based Access Control

```
enum Role {
  PLATFORM_ADMIN   // System-wide admin
  SCOPE_ADMIN      // Admin for specific business scope(s)
  SCOPE_USER       // Regular user within scope(s)  (default for new users)
}
```

**Key functions in `src/lib/rbac.ts`:**
- `requireRole(user, allowedRoles)` — throws FORBIDDEN if not authorized
- `isAdmin(role)` — true for PLATFORM_ADMIN
- `getUserScopeIds(userId)` — returns scope IDs from UserScopeAssignment
- `requireScopeAccess(user, scopeId)` — PLATFORM_ADMIN bypasses; others checked against assignments

**Scope model:** Users are assigned to scopes via `UserScopeAssignment` (userId + scopeId, unique pair).

---

## 6. Password Management

**Hashing:** bcryptjs, 12 salt rounds.

**Complexity rules** (`validatePasswordComplexity`):
- Minimum 8 characters
- At least one lowercase, one uppercase, one digit

**Change password flow:**
```
POST /api/auth/change-password
  → Verify current password
  → Validate new password complexity
  → Update passwordHash in User and Account tables
  → Set mustChangePassword = false
```

---

## 7. User Lifecycle

### Admin-created users
```
Admin POST /api/users { email, name, role, temporaryPassword }
  → Requires PLATFORM_ADMIN role
  → Validates email uniqueness, password complexity, valid role
  → Creates user: status=ACTIVE, authMethod=LOCAL, mustChangePassword=true
  → Creates Account record (credential provider)
```

### SSO-provisioned users
```
First Azure AD login
  → provisionSsoUser()
  → Creates user: status=PENDING_APPROVAL, authMethod=SSO, mustChangePassword=false
  → User sees /pending page until admin approves
```

### Approval / Deactivation
- `PATCH /api/users/[id]/approve` — PENDING_APPROVAL → ACTIVE (admin only)
- `PATCH /api/users/[id]/deactivate` — any → INACTIVE (admin only, cannot deactivate last admin)

### Status behavior
| Status | Dashboard | Login | Session |
|--------|-----------|-------|---------|
| ACTIVE | Allowed | Allowed | Valid |
| PENDING_APPROVAL | Blocked (→ /pending) | Allowed | Valid but restricted |
| INACTIVE | Blocked | Blocked (403) | Revoked |

---

## 8. Sign-Out

```
POST /api/auth/logout
  → BetterAuth signOut()
  → destroySession() — deletes Prisma record + clears cookie
  → Redirect to /login
```

---

## 9. Initial Setup / Seeding

`prisma/seed.ts` creates the first admin user from env vars:
- `INITIAL_ADMIN_EMAIL` (default: admin@example.com)
- `INITIAL_ADMIN_PASSWORD` (default: ChangeMe123!)
- Role: PLATFORM_ADMIN, mustChangePassword: true
- Skips if any users already exist

---

## 10. API Endpoint Summary

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/login` | Public | Email/password login |
| POST | `/api/auth/logout` | Authenticated | Sign out |
| POST | `/api/auth/change-password` | Authenticated | Change password |
| GET | `/api/auth/session` | Authenticated | Get session user info |
| GET/POST | `/api/auth/sso/azure` | Public | Initiate Azure SSO |
| GET/POST | `/api/auth/sso/azure/callback` | Public | Azure OAuth callback |
| GET/POST | `/api/auth/callback/[provider]` | Public | BetterAuth OAuth callback |
| GET | `/api/users` | PLATFORM_ADMIN | List users |
| POST | `/api/users` | PLATFORM_ADMIN | Create user |
| PATCH | `/api/users/[id]/approve` | PLATFORM_ADMIN | Approve pending user |
| PATCH | `/api/users/[id]/deactivate` | PLATFORM_ADMIN | Deactivate user |

---

## Environment Variables

```env
BETTER_AUTH_SECRET=<32+ character secret>
AUTH_BASE_URL=http://localhost:3270
AZURE_AD_CLIENT_ID=<azure app registration client id>
AZURE_AD_CLIENT_SECRET=<azure app registration secret>
AZURE_AD_TENANT_ID=<azure tenant id>
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=ChangeMe123!
```

---

## 11. Review Findings & Cleanup Recommendations

The following issues were identified during a review on 2026-03-31. They are ordered by priority.

### P0 — Security

#### 1. SSO route has unauthenticated provisioning backdoor

**File:** `src/app/api/auth/sso/azure/route.ts:14-27`

The GET handler checks for an `?email=` query parameter. If present, it bypasses Azure AD entirely, provisions or finds the user via `provisionSsoUser()`, and creates a session — no password, no OAuth, no verification. Anyone who can reach this endpoint can log in as any SSO user.

**Fix:** Remove the `?email=` branch entirely, or gate it behind `NODE_ENV === "development"`.

---

### P1 — Architectural Simplification

#### 2. Dual session layer (custom + BetterAuth) adds unnecessary complexity

**Files:** `src/lib/auth.ts`, `src/lib/better-auth.ts`

Two independent session mechanisms run in parallel:
- **BetterAuth sessions** — managed by the library, stored in Prisma via `Session` model, cookie prefix `business-app-starter`.
- **Custom sessions** — `starter_app_session` cookie, 32-byte random token, 7-day TTL, manually managed in `createSession()` / `destroySession()`.

`getSessionUser()` tries BetterAuth first and falls back to the custom cookie. However, the email/password login route (`/api/auth/login`) only calls `auth.api.signInEmail()` — it never calls `createSession()`. So the custom session fallback is only populated by the SSO backdoor path (finding #1). For normal login flows, the custom layer is dead.

**Fix:** Consolidate to BetterAuth sessions only. Remove `createSession()`, `createSessionRedirect()`, `createSessionRecord()`, `SESSION_COOKIE`, and the fallback branch in `getSessionUser()`. Simplify `destroySession()` to only clear BetterAuth cookies.

#### 3. Password hash / verify duplicated across two files

**Files:** `src/lib/auth.ts:20-27`, `src/lib/better-auth.ts:59-64`

`hashPassword` and `verifyPassword` in `auth.ts` use bcrypt with 12 rounds. The BetterAuth config in `better-auth.ts` also defines `password.hash` and `password.verify` with the same bcrypt logic. Two sources of truth for the same operation — if one changes, the other won't.

**Fix:** Export from one place, import in the other.

#### 4. `change-password` route does dual writes

**File:** `src/app/api/auth/change-password/route.ts:40-64`

Updates both `user.passwordHash` (used by custom auth code) and `account.password` (used by BetterAuth credential provider) with an upsert. This dual-write exists because BetterAuth reads from `Account` while custom login code reads from `User.passwordHash`.

**Fix:** After consolidating to BetterAuth (finding #2), only the `Account.password` update is needed. The `User.passwordHash` field could potentially be removed from the schema.

#### 5. Fallback secret in BetterAuth config

**File:** `src/lib/better-auth.ts:39-41`

```typescript
secret:
  process.env.BETTERAUTH_SECRET ??
  process.env.BETTER_AUTH_SECRET ??
  "dev-secret-very-long-and-secure",
```

If both env vars are missing, the app silently falls back to a hardcoded secret. In production, this would mean all sessions are signed with a known key.

**Fix:** Throw on startup if no secret is configured and `NODE_ENV === "production"`.

---

### P2 — Dead Code & Unnecessary Indirection

#### 6. `revokeInvalidSsoSession` is dead code

**File:** `src/lib/auth.ts:178-187`

Defined in `auth.ts` and referenced in `tests/unit/auth/revoked-access.test.ts`, but never called from any route, middleware, or layout. If it was intended to run on every request to revoke sessions for deactivated SSO users, it's missing from the pipeline.

**Fix:** Either wire it into the request pipeline (middleware or `getSessionUser`) or delete it. `getSessionUser` already returns `null` for INACTIVE users (line 134), so this function may be fully redundant.

#### 7. SSO callback route is a no-op redirect

**File:** `src/app/api/auth/sso/azure/callback/route.ts`

The entire route just redirects from `/api/auth/sso/azure/callback` to `/api/auth/callback/microsoft`. This intermediate hop adds latency and a file to maintain.

**Fix:** Configure the Azure AD app registration to redirect directly to `/api/auth/callback/microsoft`, then delete this route.

#### 8. `requireApiUserWithRoles` constructs a fake Request

**File:** `src/lib/route-auth.ts:30-32`

```typescript
export async function requireApiUserWithRoles(roles: Role[]) {
  return authorizeRoute(new Request("http://localhost"), { roles });
}
```

Creates a dummy `Request` object just to call `authorizeRoute`. This means `getScopeId` would parse `http://localhost` for query params — nonsensical. If anyone adds `scopeRestricted: true` to a call through this path, it will silently fail to resolve a scope.

**Fix:** Inline the auth + role check directly, or refactor `authorizeRoute` so the request is only needed when scope resolution is required.

---

### P3 — Code Quality & Consistency

#### 9. `trimTrailingSlash` defined twice

**Files:** `src/lib/azure-auth.ts:6`, `src/lib/better-auth.ts:17`

Identical function defined in two files.

**Fix:** Extract to a shared util (e.g. `src/lib/url.ts`) or pick one and import from there.

#### 10. `applySetCookieHeader` / `applySetCookieHeaders` alias

**File:** `src/lib/better-auth-http.ts:19`

```typescript
export const applySetCookieHeader = applySetCookieHeaders;
```

Two names for the same function. The login route imports the singular form, the SSO route imports the plural.

**Fix:** Pick one name, update all imports, remove the alias.

#### 11. `provisionSsoUser` lives in the wrong module

**File:** `src/lib/auth.ts:37-66`

This is a user lifecycle function (create or update user on SSO login) sitting in `auth.ts` alongside session and password utilities. The repo already has `src/lib/user-management.ts` for this purpose.

**Fix:** Move `provisionSsoUser` to `user-management.ts`.

#### 12. RBAC throws plain errors instead of returning results

**File:** `src/lib/rbac.ts:7-11`

```typescript
export function requireRole(user, allowedRoles) {
  if (!user || !allowedRoles.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
}
```

Callers must wrap in try/catch and translate to HTTP responses (see `route-auth.ts:21-27`). This is inconsistent with `requireApiUser()` which returns `{ error }` or `{ user }`.

**Fix:** Have RBAC functions return a result type (`{ error } | { user }`) instead of throwing, matching the pattern used by `route-auth.ts`.

#### 13. Login route re-queries user unnecessarily

**File:** `src/app/api/auth/login/route.ts:54-55`

```typescript
const refreshedUser = await prisma.user.findUnique({
  where: { id: user.id },
});
```

Fetches the user a second time immediately after updating `authMethod`. The update on line 47-52 doesn't change `mustChangePassword`, so the original `user` object already has the correct value. The re-query adds a database round trip for no reason.

**Fix:** Use the original `user.mustChangePassword` directly.
