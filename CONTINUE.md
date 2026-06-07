# Continue

<!-- continuity:fingerprint=106acd6e43fd70c850178fe2ce162e6c72edbb2e4fdc9dab1480ba10b6440dff -->

## Current Snapshot

- Updated: 2026-06-08 00:22:20
- Branch: `018-opentofu-azure-infra`

## Recent Non-Continuity Commits

- 56ff722 feat(018): add Azure observability checks
- 23dbb9b feat(018): enforce Azure runtime secret exposure
- fd54d10 feat(018): add Azure deploy workflow
- 6065722 feat(018): add Azure runtime modules
- 83148ed feat(018): scaffold Azure OpenTofu foundation

## Git Status

- M .github/workflows/cli-release.yml
-  M ACTIVE_SPECS.md
-  M AGENTS.md
-  M CLAUDE.md
-  M README.md
-  M docker-compose.yml
-  M docs/runtime-credentials.md
-  M docs/security/actions.md
-  M docs/security/followups.md
-  M docs/theme-design.md
-  M eslint.config.mjs
-  M infra/azure/README.md
-  M infra/azure/environments/dev.tfvars
-  M infra/azure/locals.tf
-  M infra/azure/main.tf
-  M infra/azure/variables.tf
-  M package.json
-  M pnpm-workspace.yaml
-  M prisma/seed-utils.ts
-  M public/openapi.yaml
-  M scripts/docker-compose.mjs
-  M scripts/infra-plan-lib.mjs
-  M scripts/prisma-predeploy-check.js
-  M scripts/prisma-run-lib.js
-  M scripts/prisma-run.js
-  M scripts/seed-initial-admin.mjs
-  M scripts/testdata/runtime-credentials/app-has-migration-url.md
-  M scripts/testdata/runtime-credentials/app-has-worker-graph-secret.md
-  M scripts/testdata/runtime-credentials/expired-exception.md
-  M scripts/testdata/runtime-credentials/missing-owner.md
-  M scripts/testdata/runtime-credentials/shared-graph-exception.md
-  M scripts/testdata/runtime-credentials/shared-without-exception.md
-  M scripts/testdata/runtime-credentials/valid.md
-  M specs/016-runtime-credential-separation/checklists/requirements.md
-  M specs/016-runtime-credential-separation/clarify.md
-  M specs/016-runtime-credential-separation/contracts/runtime-credential-contract.md
-  M specs/016-runtime-credential-separation/data-model.md
-  M specs/016-runtime-credential-separation/plan.md
-  M specs/016-runtime-credential-separation/quickstart.md
-  M specs/016-runtime-credential-separation/research.md
-  M specs/016-runtime-credential-separation/spec.md
-  M specs/016-runtime-credential-separation/tasks.md
-  M specs/017-deepsec-remediation/checklists/requirements.md
-  M specs/017-deepsec-remediation/clarify.md
-  M specs/017-deepsec-remediation/contracts/security-remediation-contract.md
-  M specs/017-deepsec-remediation/data-model.md
-  M specs/017-deepsec-remediation/phase-1-findings.md
-  M specs/017-deepsec-remediation/phase-2-findings.md
-  M specs/017-deepsec-remediation/plan.md
-  M specs/017-deepsec-remediation/quickstart.md
-  M specs/017-deepsec-remediation/research.md
-  M specs/017-deepsec-remediation/spec.md
-  M specs/017-deepsec-remediation/tasks.md
-  M specs/018-opentofu-azure-infra/contracts/variables-contract.md
-  M specs/018-opentofu-azure-infra/data-model.md
-  M specs/018-opentofu-azure-infra/quickstart.md
-  M specs/018-opentofu-azure-infra/tasks.md
-  M specs/base/runtime-and-ops.md
-  M src/app/(dashboard)/background-jobs/page.tsx
-  M src/app/api/audit/export/route.ts
-  M src/app/api/auth/change-password/route.ts
-  M src/app/api/auth/login/route.ts
-  M src/app/api/auth/sso/azure/route.ts
-  M src/app/api/cli-auth/approve/route.ts
-  M src/app/api/cli-auth/authorize/route.ts
-  M src/app/api/cli-auth/token/route.ts
-  M src/app/api/health/route.ts
-  M src/app/api/integrations/teams/consent/callback/route.ts
-  M src/app/api/integrations/teams/consent/start/route.ts
-  M src/app/api/integrations/teams/subscriptions/[id]/route.ts
-  M src/app/api/users/[id]/approve/route.ts
-  M src/app/api/users/[id]/deactivate/route.ts
-  M src/app/api/users/[id]/reactivate/route.ts
-  M src/app/api/users/[id]/role/route.ts
-  M src/app/cli-login/page.tsx
-  M src/components/audit/AuditExportButton.tsx
-  M src/components/auth/UserManagementTable.tsx
-  M src/components/docs/swagger-ui.tsx
-  M src/i18n/messages/de.json
-  M src/i18n/messages/en.json
-  M src/i18n/messages/es.json
-  M src/i18n/messages/fr.json
-  M src/i18n/messages/pt.json
-  M src/lib/audit-export.ts
-  M src/lib/better-auth.ts
-  M src/lib/database-url.ts
-  M src/lib/logger.ts
-  M src/lib/monitoring.ts
-  M src/lib/rate-limit.ts
-  M src/lib/user-management.ts
-  M src/proxy.ts
-  M src/services/api/audit-filters.ts
-  M src/services/api/background-jobs.ts
-  M src/services/api/cli-auth.ts
-  M src/services/api/tokens.ts
-  M src/services/api/user-admin.ts
-  M src/services/notifications/inbound.ts
-  M src/services/teams/admin.ts
-  M src/services/teams/consent.ts
-  M src/services/teams/service.ts
-  M tests/e2e/auth/cli-sso-flow.spec.ts
-  M tests/e2e/helpers/auth.ts
-  M tests/e2e/users/user-management.spec.ts
-  M tests/integration/cli-auth.test.ts
-  M tests/integration/notification-inbound.test.ts
-  M tests/integration/teams-api.test.ts
-  M tests/integration/token-api.test.ts
-  M tests/unit/audit-trail.test.ts
-  M tests/unit/auth/change-password-route.test.ts
-  M tests/unit/auth/last-admin.test.ts
-  M tests/unit/auth/login-route.test.ts
-  M tests/unit/background-jobs-page.test.tsx
-  M tests/unit/background-jobs-route.test.ts
-  M tests/unit/db-config.test.ts
-  M tests/unit/health-route.test.ts
-  M tests/unit/logger.test.ts
-  M tests/unit/monitoring.test.ts
-  M tests/unit/prisma/seed-utils.test.ts
-  M tests/unit/rate-limit.test.ts
-  M tests/unit/scripts/prisma-run-lib.test.ts
-  M tests/unit/security/api-docs-assets.test.ts
-  M tests/unit/security/redaction-fixtures.test.ts
-  M tests/unit/security/release-workflow.test.ts
-  M tests/unit/security/validate-workflow.test.ts
-  M tests/unit/services/api/audit-filters.test.ts
-  M tests/unit/teams-admin.test.ts
-  M tests/unit/teams-consent-start-route.test.ts
-  M tests/unit/teams-consent.test.ts
-  M tests/unit/teams-service.test.ts
-  M tests/unit/token-service.test.ts
- ?? infra/azure/environments/prod.tfvars
- ?? infra/azure/environments/staging.tfvars
- ?? scripts/infra-env-isolation.mjs

## Active Specs

- 016-runtime-credential-separation
- 017-deepsec-remediation
- 018-opentofu-azure-infra
- base

## Next Recommended Actions

1. 018-opentofu-azure-infra: T044 [P] Finalize `infra/azure/README.md` linking contracts, variables, outputs, and quickstart
2. 018-opentofu-azure-infra: T045 [P] Update `CONTINUE.md`, `CONTINUE_LOG.md`, and `ACTIVE_SPECS.md` to reflect implementation progress/completion
3. 018-opentofu-azure-infra: T046 Run `quickstart.md` end-to-end against a throwaway environment and record evidence, including `tofu plan` wall-clock (SC-001 < 15 min) and confirmation that bootstrap ordering matches quickstart (FR-014)
4. 018-opentofu-azure-infra: T047 Confirm `pnpm run dev` and Docker Compose still work with no Azure credentials (FR-018, SC-008)
5. 018-opentofu-azure-infra: T048 Ensure `tofu fmt -check` + `tofu validate` pass for the full `infra/azure` tree in CI
