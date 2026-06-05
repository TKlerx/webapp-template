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

Do not commit state, local variable files, or secrets.
