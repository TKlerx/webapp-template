# Quickstart Evidence: OpenTofu Azure Infrastructure

Date: 2026-06-08

This file records the final non-destructive validation pass for `018-opentofu-azure-infra`.

## Bootstrap Ordering

The quickstart ordering is confirmed:

1. Bootstrap creates remote state, GitHub OIDC identity, runtime identities, and shared ACR.
2. Images are published to the shared ACR.
3. The selected environment is planned/applied with explicit image tags.
4. Secrets are populated in Key Vault.
5. Deployment validates tags, reconciles infrastructure, runs migrations, and only then promotes app and worker revisions.

This matches FR-014 and the deploy workflow contract: bootstrap before environment state, image availability before runtime promotion, and migration before app/worker promotion.

## Non-Destructive Checks

The following checks were run locally without creating Azure resources:

- `tofu -chdir=infra/azure fmt -check -recursive`: passed
- `tofu -chdir=infra/azure init -backend=false -input=false`: passed
- `tofu -chdir=infra/azure validate`: passed
- `tofu -chdir=infra/azure/bootstrap init -backend=false -input=false`: passed
- `tofu -chdir=infra/azure/bootstrap validate`: passed with an AzureRM storage-account deprecation warning only
- `node scripts/infra-plan-check.mjs`: passed
- `node scripts/infra-secret-exposure-check.mjs`: passed
- `node scripts/infra-observability-check.mjs`: passed
- `node scripts/infra-env-isolation.mjs`: passed

The measured `infra-plan-check` wall-clock for the placeholder dev plan was 26.3 seconds, under SC-001's 15 minute target.

## Local Runtime Checks

Local development and Docker Compose were validated without Azure credentials:

- `pnpm run dev`: startup passed after the local dev bootstrap regenerated the SQLite Prisma client.
- `docker compose config`: passed with temporary clean-room env files containing the required Postgres/auth settings and no Azure AD, Graph, or mail credentials.

The local dev script now regenerates the SQLite Prisma client for `file:` database URLs. This keeps `pnpm run dev` working after a previous Docker or CI-oriented PostgreSQL Prisma generation.

## Live Throwaway Apply

Live Azure resource creation was not executed in this pass because `infra/azure/backend.tf` still contains placeholder backend values and no approved throwaway bootstrap output set, image tags, or teardown window was supplied. Running the bootstrap/apply flow would create persistent Azure resources, including resources with `prevent_destroy` guards.

To complete the live apply evidence, provide or create:

- Approved throwaway `project` and `environment` values.
- Bootstrap outputs for state, deployment identity, runtime identities, and shared ACR.
- Pushed app and worker image tags in the shared ACR.
- Explicit teardown approval for persistent resources.
