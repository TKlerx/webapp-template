# Research: Mantine UI Migration

The [roadmap](../../docs/mantine-migration-plan.md) records the baseline findings
and browser observations. The decisions below define the implementation
checkpoints.

## One theme source

The layout and ThemeProvider already apply the saved theme to the app and
Mantine. Tailwind’s production dark utilities can still follow the OS. Match
the existing app attribute in the Tailwind variant and native
`color-scheme`. An additional theme provider or OS observer would create a
second source of theme state. Verify both opposing app and OS combinations.

## Fix pending actions before porting controls

Guard requests by their event or row identity and release only the completed
request’s lock. A global pending flag would unnecessarily prevent independent
edits. Keep existing endpoint contracts and check reverse-order completion,
same-item deduplication, and failed-save recovery.

## Keep migrations at feature boundaries

Audit Trail and Users already use Mantine. Follow their route-level CSS
pattern for feature-specific styles and keep server-rendered shells. Use
native semantics and existing specialized components where they already meet
the contract. A single component replacement across all routes would make
focus, layout, and authorization regressions harder to isolate.

## Verification

Use the existing production Playwright configuration and API integration
tests. The browser suite verifies rendered behavior and keyboard interaction,
while integration tests check persisted behavior and API access rules.
Provider-free Teams fixtures cover the UI contract without external accounts.
