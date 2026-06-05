# Quickstart: Deploy this template to Azure with OpenTofu

Operator guide for provisioning and deploying an environment. Covers the bootstrap ordering required by FR-014.

> Local development and Docker Compose are unaffected by any of this and need **no** Azure credentials (FR-018). This guide is only for hosted Azure deployment.

## Prerequisites

- OpenTofu >= 1.8, Azure CLI, an Azure subscription, and `Owner`/`Contributor` + `User Access Administrator` to create role assignments.
- The app and worker container images buildable from `Dockerfile.app` and `Dockerfile.worker`.

## Step 0 — Bootstrap (once per subscription)

Creates the OpenTofu state Storage Account, the GitHub OIDC federated identity, and the **single shared Azure Container Registry** used by all environments. This must run before the main config because the main config stores its state in that account (clarify Q1) and pulls images from the shared ACR.

```bash
cd infra/azure/bootstrap
tofu init
tofu apply   # creates: state RG + Storage Account + container, Entra app registration + federated credential, base role assignments, shared ACR
```

Record the outputs (state account name, container, app/client id, ACR login server) — they configure `backend.tf`, the GitHub OIDC login, and image push/pull.

## Step 1 — Publish images to the shared registry (FR-014 ordering)

The shared ACR (from Step 0) must contain the images before any environment's runtimes can pull them.

- Push the app and worker images:

```bash
az acr login --name <acr-name>
docker build -f Dockerfile.app   -t <acr-login-server>/app:<tag> .
docker build -f Dockerfile.worker -t <acr-login-server>/worker:<tag> .
docker push <acr-login-server>/app:<tag>
docker push <acr-login-server>/worker:<tag>
```

## Step 2 — Provision an environment

```bash
cd infra/azure
tofu init   # uses azurerm backend from bootstrap outputs
tofu plan  -var-file=environments/dev.tfvars   # review (SC-001: < 15 min)
tofu apply -var-file=environments/dev.tfvars
```

Provisions: VNet + subnet + private endpoints, PostgreSQL Flexible Server (VNet-only), Key Vault, Log Analytics + App Insights, Container Apps Environment (workload-profiles / Consumption), app + worker Container Apps, and the migration Job. (The shared ACR comes from bootstrap; this env is granted `AcrPull`.)

## Step 3 — Set secrets in Key Vault

Populate required secrets (the app/worker/migration database URLs, `BETTERAUTH_SECRET`, and any enabled mail/Teams secrets). Nothing secret goes into source control (FR-008). Mail/Teams secrets are only required when `enable_mail` / `enable_teams` are true.

## Step 4 — Deploy (app, worker, migration)

Trigger the GitHub Actions `deploy-azure.yml` workflow (or run the equivalent steps manually). Required order (see deploy-workflow-contract.md):

1. Validate inputs + image tag presence.
2. `tofu apply` to set the new image tags.
3. Run the migration **Job** and wait.
4. On success → promote app + worker revisions. On failure → no promotion, failure surfaced (FR-005/FR-006).

## Step 5 — Observe

From the outputs, open the Log Analytics workspace / Application Insights to see app logs, worker logs, migration Job results, and revision health (US4, SC-006).

## Outputs you get (FR-011)

`app_endpoint`, `registry_login_server`, `database_host`, `key_vault_uri`, `log_analytics_workspace_id`, `app_insights_connection_string` (sensitive), `deployment_identity_client_id`, plus the Container App / Job names used for promotion. See outputs-contract.md.

## Multiple environments

Repeat Step 2 with `environments/staging.tfvars` / `prod.tfvars`. Each gets its own resource group, names, secrets, database, and endpoints (FR-002 / SC-007). Production `.tfvars` typically sizes up `postgres_sku` and replica limits.

## Teardown (careful — FR-013)

Persistent data resources (database, Key Vault, Log Analytics) have `prevent_destroy`. Removing them requires setting `allow_destroy_persistent = true` explicitly and is opt-in, so a routine `apply` never drops data.

## Custom domain (later, FR-016)

MVP serves on the default Container Apps FQDN with platform TLS. To use a custom domain, set `custom_domain` and add the managed-certificate + domain binding (documented as a follow-up; not required for MVP — clarify Q5).
