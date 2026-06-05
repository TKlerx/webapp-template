# Continue

<!-- continuity:fingerprint=b04657532610c437ed262aefe1bac0b4b602ad268bab77a09301722cdc225271 -->

## Current Snapshot

- Updated: 2026-06-06 01:19:29
- Branch: `018-opentofu-azure-infra`

## Recent Non-Continuity Commits

- 0b1b390 @ docs(018): apply analyze remediation
- 8cb2c85 @ docs(018): generate implementation tasks
- 56721f7 @ docs(018): plan OpenTofu Azure infrastructure
- 42be50c @ fix(017): make E2E credential literals env-overridable
- 14939e2 test: stabilize e2e postgres startup

## Git Status

- M .github/workflows/cli-release.yml
- M .github/workflows/validate.yml
- M .gitignore
- M ACTIVE_SPECS.md
- M AGENTS.md
- M CLAUDE.md
- M README.md
- M docker-compose.yml
- M docs/runtime-credentials.md
- M docs/security/actions.md
- M docs/security/followups.md
- M docs/theme-design.md
- M eslint.config.mjs
- M package.json
- M pnpm-workspace.yaml
- M prisma/seed-utils.ts
- M public/openapi.yaml
- M scripts/docker-compose.mjs
- M scripts/ensure-e2e-db.mjs
- M scripts/prisma-predeploy-check.js
- M scripts/prisma-run-lib.js
- M scripts/prisma-run.js
- M scripts/seed-initial-admin.mjs
- M scripts/testdata/runtime-credentials/app-has-migration-url.md
- M scripts/testdata/runtime-credentials/app-has-worker-graph-secret.md
- M scripts/testdata/runtime-credentials/expired-exception.md
- M scripts/testdata/runtime-credentials/missing-owner.md
- M scripts/testdata/runtime-credentials/shared-graph-exception.md
- M scripts/testdata/runtime-credentials/shared-without-exception.md
- M scripts/testdata/runtime-credentials/valid.md
- M specs/016-runtime-credential-separation/checklists/requirements.md
- M specs/016-runtime-credential-separation/clarify.md
- M specs/016-runtime-credential-separation/contracts/runtime-credential-contract.md
- M specs/016-runtime-credential-separation/data-model.md
- M specs/016-runtime-credential-separation/plan.md
- M specs/016-runtime-credential-separation/quickstart.md
- M specs/016-runtime-credential-separation/research.md
- M specs/016-runtime-credential-separation/spec.md
- M specs/016-runtime-credential-separation/tasks.md
- M specs/017-deepsec-remediation/checklists/requirements.md
- M specs/017-deepsec-remediation/clarify.md
- M specs/017-deepsec-remediation/contracts/security-remediation-contract.md
- M specs/017-deepsec-remediation/data-model.md
- M specs/017-deepsec-remediation/phase-1-findings.md
- M specs/017-deepsec-remediation/phase-2-findings.md
- M specs/017-deepsec-remediation/plan.md
- M specs/017-deepsec-remediation/quickstart.md
- M specs/017-deepsec-remediation/remediation-evidence.md
- M specs/017-deepsec-remediation/research.md
- M specs/017-deepsec-remediation/spec.md
- M specs/017-deepsec-remediation/tasks.md
- M specs/018-opentofu-azure-infra/contracts/deploy-workflow-contract.md
- M specs/018-opentofu-azure-infra/contracts/outputs-contract.md
- M specs/018-opentofu-azure-infra/contracts/variables-contract.md
- M specs/018-opentofu-azure-infra/data-model.md
- M specs/018-opentofu-azure-infra/plan.md
- M specs/018-opentofu-azure-infra/tasks.md
- M specs/OVERVIEW.md
- M specs/base/runtime-and-ops.md
- M src/app/(dashboard)/background-jobs/page.tsx
- M src/app/api/audit/export/route.ts
- M src/app/api/auth/change-password/route.ts
- M src/app/api/auth/login/route.ts
- M src/app/api/auth/sso/azure/route.ts
- M src/app/api/cli-auth/approve/route.ts
- M src/app/api/cli-auth/authorize/route.ts
- M src/app/api/cli-auth/token/route.ts
- M src/app/api/health/route.ts
- M src/app/api/integrations/teams/consent/callback/route.ts
- M src/app/api/integrations/teams/consent/start/route.ts
- M src/app/api/integrations/teams/subscriptions/[id]/route.ts
- M src/app/api/users/[id]/approve/route.ts
- M src/app/api/users/[id]/deactivate/route.ts
- M src/app/api/users/[id]/reactivate/route.ts
- M src/app/api/users/[id]/role/route.ts
- M src/app/cli-login/page.tsx
- M src/components/audit/AuditExportButton.tsx
- M src/components/auth/UserManagementTable.tsx
- M src/components/docs/swagger-ui.tsx
- M src/i18n/messages/de.json
- M src/i18n/messages/en.json
- M src/i18n/messages/es.json
- M src/i18n/messages/fr.json
- M src/i18n/messages/pt.json
- M src/lib/audit-export.ts
- M src/lib/better-auth.ts
- M src/lib/database-url.ts
- M src/lib/logger.ts
- M src/lib/monitoring.ts
- M src/lib/rate-limit.ts
- M src/lib/user-management.ts
- M src/proxy.ts
- M src/services/api/audit-filters.ts
- M src/services/api/background-jobs.ts
- M src/services/api/cli-auth.ts
- M src/services/api/tokens.ts
- M src/services/api/user-admin.ts
- M src/services/notifications/inbound.ts
- M src/services/teams/admin.ts
- M src/services/teams/consent.ts
- M src/services/teams/service.ts
- M tests/e2e/auth/cli-sso-flow.spec.ts
- M tests/e2e/helpers/auth.ts
- M tests/e2e/users/user-management.spec.ts
- M tests/integration/cli-auth.test.ts
- M tests/integration/notification-inbound.test.ts
- M tests/integration/teams-api.test.ts
- M tests/integration/token-api.test.ts
- M tests/unit/audit-trail.test.ts
- M tests/unit/auth/change-password-route.test.ts
- M tests/unit/auth/last-admin.test.ts
- M tests/unit/auth/login-route.test.ts
- M tests/unit/background-jobs-page.test.tsx
- M tests/unit/background-jobs-route.test.ts
- M tests/unit/db-config.test.ts
- M tests/unit/health-route.test.ts
- M tests/unit/logger.test.ts
- M tests/unit/monitoring.test.ts
- M tests/unit/prisma/seed-utils.test.ts
- M tests/unit/rate-limit.test.ts
- M tests/unit/scripts/prisma-run-lib.test.ts
- M tests/unit/security/api-docs-assets.test.ts
- M tests/unit/security/redaction-fixtures.test.ts
- M tests/unit/security/release-workflow.test.ts
- M tests/unit/security/validate-workflow.test.ts
- M tests/unit/services/api/audit-filters.test.ts
- M tests/unit/teams-admin.test.ts
- M tests/unit/teams-consent-start-route.test.ts
- M tests/unit/teams-consent.test.ts
- M tests/unit/teams-service.test.ts
- M tests/unit/token-service.test.ts
- M validate.ps1
- ?? .terraformignore
- ?? infra/
- ?? specs/018-opentofu-azure-infra/clarify.md

## Active Specs

- 016-runtime-credential-separation
- 017-deepsec-remediation
- 018-opentofu-azure-infra
- base

## Next Recommended Actions

1. 018-opentofu-azure-infra: T013 [P] [US1] Create `scripts/infra-plan-check.mjs`: run `tofu plan -out=tfplan` then `tofu show -json tfplan`, assert the plan includes app, worker, migration Job, PostgreSQL, Key Vault, Log Analytics/App Insights, and identities (shared ACR verified via bootstrap), exit non-zero on any missing type (SC-002)
2. 018-opentofu-azure-infra: T014 [P] [US1] Create `modules/data`: PostgreSQL Flexible Server (VNet-only, `public_network_access=false`), application database, distinct app/worker/migration roles, burstable SKU default, `prevent_destroy` (data-model Database; FR-007, FR-021, FR-013)
3. 018-opentofu-azure-infra: T015 [P] [US1] Grant the environment's runtime MI `AcrPull` on the shared bootstrap ACR and wire the app/worker image references (login server from bootstrap output) into the runtime module (data-model Registry; FR-010, FR-021)
4. 018-opentofu-azure-infra: T016 [P] [US1] Create `modules/secrets`: Key Vault (VNet-only) with RBAC for runtime MI (read) and deploy identity (write) (data-model Secret; FR-008)
5. 018-opentofu-azure-infra: T017 [P] [US1] Create `modules/observability`: Log Analytics workspace + Application Insights, `prevent_destroy` (data-model Observability; FR-012)
