# Active Specs

Review this file before starting implementation work.
List every started but unfinished spec here. Remove entries only
when the spec is fully finished.

## Open Specs

- 018 OpenTofu Azure Infrastructure
  - Status: Implementation complete except live throwaway Azure apply evidence.
  - Next required work: Run `specs/018-opentofu-azure-infra/quickstart.md` against an approved throwaway Azure environment once bootstrap backend outputs, pushed image tags, and teardown approval are available. Non-destructive evidence is recorded in `specs/018-opentofu-azure-infra/quickstart-evidence.md`.

## Maintenance Rules

- Add a spec to this file as soon as implementation work starts.
- Record the current status and the next required work.
- Warn and get explicit confirmation before starting a newer spec
  while an older one listed here is still unfinished.
- Remove a spec only when it is fully finished.
