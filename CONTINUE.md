# Continue

<!-- continuity:fingerprint=54d11111fcd9467085f296b973c6107b9c3a453fa5b2d7e2ae3caf351dd65787 -->

## Current Snapshot

- Updated: 2026-04-01 12:28:27
- Branch: `010-auth-security-hardening`

## Recent Non-Continuity Commits

- 4a99b42 chore(validate): verify template provenance files
- 3c4062c docs(template): clarify env and provenance defaults
- 1f92bd6 docs(template): track upstream template provenance
- 0a0c1df fix(auth): consolidate credential password storage
- 80a21b3 docs(template): add upstream maintenance workflow

## Git Status

- M AUTH_FLOWS.md
-  M CLAUDE.md
-  M prisma/schema.postgres.prisma
-  M prisma/schema.prisma
-  M prisma/seed.ts
-  M src/app/api/auth/change-password/route.ts
-  M src/app/api/auth/login/route.ts
-  M src/app/api/auth/logout/route.ts
-  M src/app/api/auth/sso/azure/route.ts
-  M src/app/api/users/[id]/approve/route.ts
-  M src/app/api/users/[id]/deactivate/route.ts
-  M src/app/api/users/[id]/reactivate/route.ts
-  M src/app/api/users/[id]/role/route.ts
-  M src/app/api/users/[id]/theme/route.ts
-  M src/app/api/users/route.ts
-  M src/lib/audit.ts
-  M src/lib/azure-auth.ts
-  M src/lib/better-auth.ts
-  M src/lib/user-management.ts
-  M tests/unit/auth/change-password-route.test.ts
- ?? AUTH_REVIEW_CHECKLIST.md
- ?? AUTH_REVIEW_CHECKLIST_2026-04-01.md
- ?? prisma/migrations-postgres/20260401160000_add_password_changed_audit_action/
- ?? prisma/migrations/20260401160000_add_password_changed_audit_action/
- ?? specs/010-auth-security-hardening/
- ?? specs/011-route-refactor/
- ?? specs/OVERVIEW.md
- ?? src/lib/rate-limit.ts
- ?? tests/unit/azure-auth-sso.test.ts
- ?? tests/unit/azure-auth.test.ts
- ?? tests/unit/rate-limit.test.ts
- ?? tests/unit/users-status-filter.test.ts

## Active Specs

- 010-auth-security-hardening
- 011-route-refactor

## Next Recommended Actions

1. No unchecked tasks detected in the active specs.
