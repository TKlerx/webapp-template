# Active Specs

Review this file before starting implementation work.
List every started but unfinished spec here. Remove entries only
when the spec is fully finished.

## Open Specs

- 018 OpenTofu Azure Infrastructure
  - Status: Live throwaway staging apply completed in Azure; migration job succeeded.
  - Next required work: Inspect or tear down throwaway Azure resource groups `wattest-bootstrap-rg`, `wattest-staging-rg`, and partial failed `wattest-dev-rg`. Follow up on the live app HTTP 404 observed from the reused prebuilt app image.

## Maintenance Rules

- Add a spec to this file as soon as implementation work starts.
- Record the current status and the next required work.
- Warn and get explicit confirmation before starting a newer spec
  while an older one listed here is still unfinished.
- Remove a spec only when it is fully finished.
