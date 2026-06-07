# Azure OpenTofu Infrastructure

This directory contains the OpenTofu configuration for spec `018-opentofu-azure-infra`.

Start with the operator guide in [`../../specs/018-opentofu-azure-infra/quickstart.md`](../../specs/018-opentofu-azure-infra/quickstart.md).

Contracts:

- [`variables-contract.md`](../../specs/018-opentofu-azure-infra/contracts/variables-contract.md)
- [`outputs-contract.md`](../../specs/018-opentofu-azure-infra/contracts/outputs-contract.md)
- [`deploy-workflow-contract.md`](../../specs/018-opentofu-azure-infra/contracts/deploy-workflow-contract.md)

Current structure:

- `bootstrap/`: one-time state, identity, and shared registry setup
- `environments/`: per-environment inputs
- `modules/`: reusable Azure resource groups for network, data, registry, secrets, observability, and runtime

Validation:

- `tofu -chdir=infra/azure fmt -check -recursive`
- `tofu -chdir=infra/azure validate`
- `node scripts/infra-plan-check.mjs`

The plan check uses `infra/azure/environments/dev.tfvars` with placeholder bootstrap outputs and `-refresh=false`; it proves the environment graph includes the app, worker, migration job, PostgreSQL, Key Vault, private endpoints, observability, and role assignments without applying resources.

Database access:

- PostgreSQL is provisioned as VNet-only with public network access disabled and `prevent_destroy`.
- The data module emits distinct app, worker, and migration database URLs so runtime bindings stay separated.
- The migration Container Apps Job receives the admin URL only for `scripts/postgres-provision-roles.mjs`, which creates or updates the app, worker, and migration roles before Prisma migrations run.

Deployment workflow:

- `.github/workflows/deploy-azure.yml` uses GitHub OIDC (`id-token: write`) and Azure login without a client secret.
- Configure each GitHub Environment (`dev`, `staging`, `prod`) with variables for `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, bootstrap state outputs, shared ACR outputs, deployment identity ids, runtime identity ids, `PROJECT`, and `AZURE_LOCATION`.
- The workflow validates requested ACR tags, reconciles OpenTofu infrastructure, runs the migration Container Apps Job with the migration image, and only then updates the app and worker images.

Do not commit state, local variable files, or secrets.
