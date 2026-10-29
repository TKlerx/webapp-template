# Data Model: Auth Security Hardening

**Feature**: 010-auth-security-hardening | **Date**: 2026-04-01

## Existing Entities

Implementation alignment on 2026-10-15 makes AuditEntry.actorId and its User relation nullable so rejected unauthenticated attempts can be recorded honestly. Existing authenticated audit entries and their foreign-key protection are preserved. Spec 022 retains this change in the single PostgreSQL schema.

### AuditEntry

Already defined in `prisma/schema.prisma` with all required fields:

| Field      | Type                 | Notes                                                                                                                               |
| ---------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| id         | String (CUID)        | Primary key                                                                                                                         |
| action     | AuditAction (enum)   | Already includes: AUTH_LOGIN_SUCCEEDED, AUTH_LOGIN_REJECTED, AUTH_LOGOUT_SUCCEEDED, USER_CREATED, ROLE_CHANGED, USER_STATUS_CHANGED |
| entityType | String               | e.g., "User", "Session"                                                                                                             |
| entityId   | String               | Target entity ID                                                                                                                    |
| actorId    | String? (FK → User)  | Authenticated actor, or null for anonymous rejected login attempts; the target user is not presumed to be the actor                 |
| scopeId    | String? (FK → Scope) | Optional scope context                                                                                                              |
| details    | String (JSON)        | Serialized additional context                                                                                                       |
| createdAt  | DateTime             | Event timestamp                                                                                                                     |

### AuditAction Enum (existing — may need additions)

Current values:

- `USER_CREATED`, `ROLE_CHANGED`, `SCOPE_ASSIGNMENT_CHANGED`
- `USER_STATUS_CHANGED`, `USER_THEME_CHANGED`
- `AUTH_LOGIN_SUCCEEDED`, `AUTH_LOGIN_REJECTED`
- `AUTH_LOGOUT_SUCCEEDED`, `AUDIT_EXPORT_REQUESTED`

**Potentially needed additions**:

- `AUTH_PASSWORD_CHANGED` — for password change events (FR-009)
- `AUTH_RATE_LIMITED` — optional, for rate-limit trigger events (could use details field on AUTH_LOGIN_REJECTED instead)

**Decision**: Add `AUTH_PASSWORD_CHANGED` to the enum. Rate-limited attempts can be logged as `AUTH_LOGIN_REJECTED` with `{ reason: "rate_limited" }` in the details field — no new enum value needed.

## New In-Memory State (not persisted)

### RateLimitEntry (in-memory Map)

```typescript
type RateLimitEntry = {
  attempts: number[]; // Allowed attempt timestamps inside the sliding window
  blockedUntil: number; // Full cooldown from the threshold attempt
  windowMs: number;
  maxAttempts: number;
};

// Storage: Map<string, RateLimitEntry>
// Key format: "{endpoint}:{ipAddress}" (e.g., "login:192.168.1.1")
```

| Property     | Type     | Description                                             |
| ------------ | -------- | ------------------------------------------------------- |
| attempts     | number[] | Allowed attempts in the last 15 minutes                 |
| blockedUntil | number   | Cooldown expiry, 15 minutes after the threshold attempt |
| windowMs     | number   | Bucket window duration                                  |
| maxAttempts  | number   | Bucket threshold; defaults to 5                         |

**Lifecycle**:

- Created on first attempt from an IP to a rate-limited endpoint
- Expire old attempts individually; append an allowed attempt to the sliding window
- At the threshold, reject subsequent attempts until a full 15-minute cooldown expires; blocked retries do not extend it
- Cleaned up by a periodic sweep every 5 minutes after both the cooldown and retained attempts expire
- Lost on server restart (acceptable per clarification)

## Entity Relationships

```
User ──0..1:N──► AuditEntry (via nullable actorId)
  │
  └── Referenced as entityId in audit entries for:
      - Login attempts (success/failure/rate-limited)
      - Password changes
      - Status changes (approve/deactivate/reactivate)
      - Role changes
      - User creation

RateLimitEntry (in-memory, no DB relationship)
  └── Keyed by endpoint + IP address
  └── No FK to User (rate limiting is pre-authentication)
```

## Migration Requirements

**Prisma migrations**: The historical password-change audit migration is retained, followed by the nullable-actor migration. Spec 022 supersedes the earlier dual-database setup with the single PostgreSQL schema and migration history.

- Add `AUTH_PASSWORD_CHANGED` to the `AuditAction` enum in `prisma/schema.prisma`
- Run `pnpm exec prisma migrate dev --name add-password-changed-audit-action`
- PostgreSQL: requires an `ALTER TYPE` migration (Prisma handles this automatically)

**2026-10-15 correction**: The additional `20261015010000_allow_anonymous_audit_actors` PostgreSQL migration makes actorId nullable. Apply it before deploying the corrected login handler. Anonymous attempts use entityType LoginAttempt and a random entityId unless the target User ID is already known; credentials and submitted raw email are not persisted in their details. The subsequent user-approved PostgreSQL-only change removes SQLite runtime support while preserving local data files.
