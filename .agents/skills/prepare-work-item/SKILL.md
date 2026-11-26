---
name: prepare-work-item
description: Prepare or refine a GitHub issue, GitLab issue, or Azure DevOps work item for a coding agent team, with bounded scope, observable acceptance criteria, evidence, and planning references. Use when drafting agent-ready work or assessing whether an existing item can be scheduled.
---

# Prepare a work item

Produce an issue a coding team can assess, specify, plan, implement, test and review without inventing consequential requirements. Missing spec.md, plan.md or tasks.md is normal: the team generates them after triage.

## Establish the destination and evidence

- Read the current item and relevant replies using the configured provider CLI: gh, glab, or az boards when that provider is available. Read relevant local code, repository instructions and existing planning artifacts. Do not implement the feature as part of issue preparation.
- Verify that the configured checkout exists and its selected fetch/push remote identifies the intended provider repository. A fork may use a remote other than origin. Use the explicitly selected repository for every provider operation; do not infer authorization for upstream from its presence in Git remotes.
- Check for an existing implementation or open PR/MR before scheduling duplicate work. Verify dependencies against current provider state; an old plan calling something pending is not current evidence.
- Separate observed facts from assumptions. Fixtures may establish local behavior without proving live production behavior. Keep credentials and sensitive customer/employee data out of issues.

## Write the minimum complete description

Preserve the reporter's intent and useful evidence. Use the following sections where relevant; omit empty or redundant sections.

```markdown
## Outcome
Who needs what behavior, and why?

## Current behavior and evidence
What happens now? For bugs, include reproducible steps, expected/actual results,
and sanitized evidence. Feature requests do not require a bug reproduction.

## Scope
Required behavior, affected surfaces, and explicit exclusions.

## Acceptance criteria
Observable outcomes, including relevant empty/error/filter cases.

## Verification
Relevant fixtures/tests and required repository gates. State any necessary
setup/access prerequisites and what still requires live verification.

## Planning references and dependencies
Existing artifact paths/links, related issues/PRs, and confirmed dependency state.

## Open decisions
Only questions that materially affect implementation or acceptance.
```

Acceptance criteria describe behavior, not merely files to edit or tests to run. Identify loaded-data versus global-data scope, preserve existing write/export/security boundaries, and distinguish required behavior from optional investigations. Do not silently turn an optional extension into a requirement.

Link useful existing Spec Kit artifacts and identify outdated assumptions. The controller-supplied feature directory owns the active artifacts: a reference to a different directory does not automatically bind or resume it. If no binding is supported, let the team produce task-scoped artifacts using the references. Do not prescribe branch switching or replace accepted spec/plan content.

If unresolved questions prevent a coherent plan, record those questions and leave the item unqueued. Infer routine implementation choices from the code; do not demand that the reporter design the solution. If tasks overlap or depend on another delivery, describe that relationship. Executable scheduling dependencies must also be configured in the controller; issue prose alone does not enforce them.

## Publish and schedule

- Editing an issue or applying its scheduling label needs user authorization for that action. An explicit instruction to prepare and make a specific item agent-ready authorizes those edits and the configured label; do not ask for the same permission again.
- Save the exact revised description to a UTF-8 file and pass it through the CLI's file argument (or structured API). Keep issue text out of interpolated shell code. Preserve unrelated labels and metadata.
- Re-read the item before updating to detect intervening edits; reconcile any changes instead of overwriting them. Verify the saved description before applying the scheduling label.
- Use the project's configured label, normally agent-ready, only when outcome, scope and acceptance are clear enough for triage. The label starts scheduling; it is not proof that tests, review or merge gates passed.
- Verify the resulting provider label and, when available, the board import/status. If a write has an uncertain outcome, read back before retrying. Do not duplicate issues or publish readiness claims that were not verified.

Report the item link, the bounded scope and whether it was prepared, labeled or imported. Preserve the team's own triage, clarification, validation and merge gates.
