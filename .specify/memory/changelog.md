# Changelog

## Merged Features Log

### PostgreSQL-only Database Support — archived 2026-10-15

**Branch:** Not specified in current plan.md
**Spec:** [specs/022-postgresql-only/spec.md](../../specs/022-postgresql-only/spec.md)

**What was added:**

- PostgreSQL-only app, worker and seed storage; retained migration identifiers, persistent loopback development database, isolated test provisioning and preservation of old local files.

**New Components:**

- Single Prisma schema/migration history, PostgreSQL worker store, development Compose service and guarded test database provisioning.

**Tasks Completed:** 6/6 tasks


### Ops Health Dashboard — archived 2026-10-15

**Branch:** 021-ops-health-dashboard
**Spec:** [specs/021-ops-health-dashboard/spec.md](../../specs/021-ops-health-dashboard/spec.md)

**What was added:**

- Administrator-only snapshot dashboard, environment/build identity, safe health states, recent recorded evidence, manual refresh and copyable diagnostic summary.

**New Components:**

- Ops health snapshot service/API, administrator page and navigation, localized status and copy feedback.

**Tasks Completed:** 60/60 tasks


### Logging Standardization — archived 2026-10-15

**Branch:** 019-logging-standardization
**Spec:** [specs/019-logging-standardization/spec.md](../../specs/019-logging-standardization/spec.md)

**What was added:**

- Structured app and worker events, safe correlation and metadata, default-on request completion with explicit opt-out, documented conventions and production logging guardrails.

**New Components:**

- Existing structured logger, worker JSON logging, request completion events, logging guidance and validation guard.

**Tasks Completed:** 44/44 tasks


### DeepSec Remediation — archived 2026-10-15

**Branch:** 017-deepsec-remediation
**Spec:** [specs/017-deepsec-remediation/spec.md](../../specs/017-deepsec-remediation/spec.md)

**What was added:**

- Delegated credential secrecy and historical cleanup, atomic last-admin coverage, bounded audit operations, trusted-proxy login identity, immutable release publishing and auth regression closure.

**New Components:**

- Shared job redaction/cleanup and pre-persistence credential rejection, security invariants, release workflow boundaries and security-finding evidence.

**Tasks Completed:** 103/103 tasks


### Runtime Credential Separation — archived 2026-10-15

**Branch:** 016-runtime-credential-separation
**Spec:** [specs/016-runtime-credential-separation/spec.md](../../specs/016-runtime-credential-separation/spec.md)

**What was added:**

- Explicit credential ownership, runtime-specific database URLs, integration-secret exceptions and validation against wrong-runtime exposures.

**New Components:**

- Runtime credential contract and ownership tables; service-specific Compose environments; runtime URL fallbacks and a lightweight credential validator.

**Tasks Completed:** 41/41 tasks


### Teams Messaging Skeleton — archived 2026-10-15

**Branch:** 015-teams-messaging-skeleton
**Spec:** [specs/015-teams-messaging-skeleton/spec.md](../../specs/015-teams-messaging-skeleton/spec.md)

**What was added:**

- Delegated administrator sends, approved-channel read-only intake, independent emergency controls, size limits, deduplication and status visibility.
- Reconciled grant refresh, fixed retries, paged channel listing and delivery credential boundaries before archival.

**New Components:**

- Teams client/services/admin UI and routes, encrypted delegated grants, outbound/inbound/config/target/subscription models and worker job handlers.

**Tasks Completed:** 47/47 tasks


### Cross-Platform CLI Client — archived 2026-10-15

**Branch:** 013-cli-client
**Spec:** [specs/013-cli-client/spec.md](../../specs/013-cli-client/spec.md)

**What was added:**

- Browser/PAT CLI login, user/audit/job/health commands, shell completion, structured output and release distribution.
- Owner-only Windows token-file ACL enforcement and null-safe audit projections after implementation alignment.

**New Components:**

- Standalone Go CLI, configuration and HTTP/output/auth/completion/update modules; platform-specific private config writers.

**Tasks Completed:** 53/53 tasks

### OpenAPI Specification & Personal Access Tokens — archived 2026-10-15

**Branch:** 012-openapi-and-pat
**Spec:** [specs/012-openapi-and-pat/spec.md](../../specs/012-openapi-and-pat/spec.md)

**What was added:**

- Personal token lifecycle, Bearer/X-API-Key auth, current-role RBAC, admin token controls, browser CLI login and authenticated OpenAPI documentation.

**New Components:**

- Token and CLI auth services/routes, token-management pages, documentation viewer and token/code models.

**Tasks Completed:** 59/59 tasks

### API Route Refactor — archived 2026-10-15

**Branch:** 011-route-refactor
**Spec:** [specs/011-route-refactor/spec.md](../../specs/011-route-refactor/spec.md)

**What was added:**

- Shared route contexts/services preserving auth, validation, audit, payload and error contracts.
- Explicit route duplication policy and deferred document/AI service contracts.

**New Components:**

- src/services/api route-context, user-admin, audit-filters, background-jobs, auth and session services.

**Tasks Completed:** 22/22 tasks

### Auth Security Hardening — archived 2026-10-15

**Branch:** 010-auth-security-hardening
**Spec:** [specs/010-auth-security-hardening/spec.md](../../specs/010-auth-security-hardening/spec.md)

**What was added:**

- Account-entry abuse protection, trusted origins and verified SSO identity, admin input validation and complete auth/admin audit coverage.
- Source-linked anonymous audit actors and sliding-window/full-cooldown model after implementation alignment.

**New Components:**

- Shared in-memory rate limiting and auth/admin audit integration.

**Tasks Completed:** 30/30 tasks
