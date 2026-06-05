# Contract: OpenTofu Input Variables (per-environment)

The main configuration (`infra/azure/`) accepts these inputs, normally supplied via `environments/<env>.tfvars`. This is the operator-facing customization surface (FR-016).

## Required

| Variable | Type | Constraint | Maps to |
| --- | --- | --- | --- |
| `project` | string | lowercase, `^[a-z][a-z0-9-]{1,12}$` | naming/tags |
| `environment` | string | one of `dev`, `staging`, `prod` | FR-002 isolation |
| `location` | string | valid Azure region | all resources |
| `app_image_tag` | string | non-empty | app Container App + migration Job (FR-004) |
| `worker_image_tag` | string | non-empty | worker Container App (FR-004) |

## Optional (with defaults)

| Variable | Type | Default | Maps to |
| --- | --- | --- | --- |
| `migration_image_tag` | string | `= app_image_tag` | migration Job image (app image reused) |
| `base_path` | string | `/app-starter` | app `BASE_PATH` (Constitution VIII) |
| `custom_domain` | string | `""` (use default FQDN) | FR-016 / clarify Q5 — empty = default Container Apps FQDN |
| `postgres_sku` | string | `B1ms` (burstable) | DB sizing (FR-016) |
| `postgres_storage_gb` | number | `32` | DB sizing |
| `app_min_replicas` | number | `0` (scale-to-zero) | cost |
| `app_max_replicas` | number | `2` | scale limit (FR-016) |
| `worker_min_replicas` | number | `1` (always warm) | worker poller |
| `enable_mail` | bool | `false` | optional integration secrets (edge case) |
| `enable_teams` | bool | `false` | optional integration secrets (edge case) |
| `allow_destroy_persistent` | bool | `false` | FR-013 destructive opt-in |
| `tags` | map(string) | `{}` | merged into standard tags |

## Validation rules (FR-017)

- `environment` ∈ {dev, staging, prod}; otherwise plan errors.
- `app_image_tag` / `worker_image_tag` must be non-empty; CI additionally verifies the tag exists in ACR before promotion.
- Derived globally-unique names (Storage, ACR, Key Vault) must satisfy Azure length limits after combining `project` + `environment` + suffix → a deterministic short `name_suffix` is generated.
- Integration secrets (mail/Teams) are only required when the corresponding `enable_*` flag is true — a downstream app that disables them is not forced to supply unused secrets.

## Backend (set by bootstrap, not a tfvar)

```hcl
# backend.tf (values from bootstrap outputs)
backend "azurerm" {
  resource_group_name  = "<bootstrap-rg>"
  storage_account_name = "<state-account>"
  container_name       = "tfstate"
  key                  = "app/<environment>.tfstate"
  use_oidc             = true
}
```
