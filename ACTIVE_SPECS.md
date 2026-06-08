# Active Specs

Review this file before starting implementation work.
List every started but unfinished spec here. Remove entries only
when the spec is fully finished.

## Open Specs

- 018 OpenTofu Azure Infrastructure
  - Status: Live throwaway staging apply completed in Azure; migration job succeeded.
  - Next required work: Inspect or tear down throwaway Azure resource groups `wattest-bootstrap-rg`, `wattest-staging-rg`, `wattest-staging-aca-infra-rg`, and partial failed `wattest-dev-rg`. The live app 404 was fixed by rebuilding the app image with `BASE_PATH=/app-starter`.

## Maintenance Rules

- Add a spec to this file as soon as implementation work starts.
- Record the current status and the next required work.
- Warn and get explicit confirmation before starting a newer spec
  while an older one listed here is still unfinished.
- Remove a spec only when it is fully finished.
