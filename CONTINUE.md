# Continue

<!-- continuity:fingerprint=07fc5dc68b950f492c72e8b2061a0f69bb949da31c6eed2acee9f652ecea637f -->

## Current Snapshot

- Updated: 2026-06-05 21:35:53
- Branch: `018-opentofu-azure-infra`

## Recent Non-Continuity Commits

- 56721f7 @ docs(018): plan OpenTofu Azure infrastructure
- 42be50c @ fix(017): make E2E credential literals env-overridable
- 14939e2 test: stabilize e2e postgres startup
- d5f7f0b test: isolate e2e postgres database
- 5fd2528 test: isolate e2e postgres schema

## Git Status

- M ACTIVE_SPECS.md
-  M specs/OVERVIEW.md
- ?? specs/018-opentofu-azure-infra/tasks.md

## Active Specs

- 018-opentofu-azure-infra

## Next Recommended Actions

1. 018-opentofu-azure-infra: T001 Create `infra/azure/` structure: root files placeholder, `bootstrap/`, `environments/`, and `modules/{network,data,registry,secrets,observability,runtime}/` directories
2. 018-opentofu-azure-infra: T002 [P] Create `infra/azure/providers.tf` pinning `required_version >= 1.8`, `hashicorp/azurerm ~> 4.x`, `hashicorp/azuread`, `hashicorp/random`
3. 018-opentofu-azure-infra: T003 [P] Create `infra/azure/variables.tf` implementing the input contract in `specs/018-opentofu-azure-infra/contracts/variables-contract.md` (required + optional vars + `validation` blocks for `environment` and image tags)
4. 018-opentofu-azure-infra: T004 [P] Create `infra/azure/locals.tf` with naming (`<project>-<environment>`), standard tags (`environment`, `project`, `managed-by=opentofu`), and a deterministic `name_suffix` via `random_string` for globally-unique names (Azure length-limit edge case)
5. 018-opentofu-azure-infra: T005 [P] Create `infra/azure/README.md` pointing to `quickstart.md` and the contracts
