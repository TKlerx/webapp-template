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

Do not commit state, local variable files, or secrets.
