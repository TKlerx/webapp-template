# Implementation Plan: Mantine UI Migration

- **Branch** `codex/mantine-migration-plan`
- **Spec** [spec.md](spec.md)
- **Delivery** One draft pull request with small, independently tested checkpoints.

## Technical context

The app uses Next.js 16 App Router, React 19, TypeScript 5.9, Mantine Core,
Tailwind CSS 4, and next-intl. PostgreSQL, Prisma and the current session and
role guards remain the storage and access boundaries. Use the existing package
versions, Playwright and Vitest. Keep route styles layered and route-scoped.
The [roadmap](../../docs/mantine-migration-plan.md) records the baseline
findings and technical choices.

## Implementation sequence

1. **Shared theme.** Define Tailwind’s `dark` variant and native CSS
   `color-scheme` from the existing app theme selector in `src/app/globals.css`.
   Preserve server-rendered theme attributes, provider synchronization, and
   body typography. Verify a computed utility on a component that survives
   later ports.
2. **Notification reliability.** In
   `src/components/notifications/NotificationAdminPanel.tsx`, guard duplicate
   saves per event before sending the request. Update only the confirmed row
   and release only that row’s lock. Preserve the latest-request guard on log
   reads. Verify transport and HTTP failure recovery before porting controls.
3. **Notification UI.** Use labeled Mantine native selects, checkboxes,
   status badges, retry controls, and a semantic table with internal scroll.
   Load styles from the server-rendered Notifications route and preserve its
   platform-admin guard and existing response data.
4. **Remaining workflows.** Follow the ordered tasks for Audit Trail, Users,
   Jobs, Ops Health, tokens, auth, and Teams. Keep the token list before dialogs,
   the Azure anchor before local auth forms, and Teams browser fixtures before
   Teams control changes. Check each checkpoint on the same branch before
   moving to the next.

## Constitution check

- Validate the shared theme checkpoint first. Keep behavior fixes and component
  swaps in independently reviewable commits on the one PR the user requested.
- Preserve existing roles, APIs, schema, theme tokens, data handling, and
  translated messages. Keep implementations close to their current callers.
- Verify narrow, intermediate and desktop widths, both themes and a
  non-English locale. Build with a non-root base path and disposable PostgreSQL
  for browser tests.
- Spec 014 remains open. After the sequencing gap was raised, the user
  requested this draft handoff for future implementation. Record the current
  checkpoint in continuity and add 023 to `ACTIVE_SPECS.md` when implementation
  starts. Leave Spec 014’s delivery and scope tasks in its own plan.

## Project structure

- `src/app/globals.css`, `src/app/layout.tsx`, and
  `src/components/providers/ThemeProvider.tsx` define the shared theme boundary.
- `src/app/(dashboard)/` contains server-rendered shells. Feature UI remains
  under `src/components/` and translated strings under `src/i18n/messages/`.
- `tests/e2e/` holds production browser regressions. `tests/integration/`
  protects API behavior and persisted data contracts.

## Verification and handoff

Use [tasks.md](tasks.md) for the executable checklist and [quickstart.md](quickstart.md)
for the pickup command and local validation. The draft contains the plan and
unchecked tasks. Implementation, browser checks, and final PR validation are
tracked by those tasks.
