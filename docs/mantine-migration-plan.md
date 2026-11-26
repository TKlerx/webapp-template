# Template review and Mantine migration plan

Reviewed `main` at `28de90e` on 2026-11-24. This pass covered the frontend routes,
shared UI, theme and localization, auth and admin workflow boundaries, and test
and CI coverage. It also checked the migration plan against the PostgreSQL and
runtime constraints in the project specs.

## Findings

| Priority | Finding                                                      | Evidence and proposed fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P2       | Saved dark mode can make controls unreadable                 | In Chromium with the OS scheme set to light, I switched the app to dark. Both root theme attributes were dark, but the notification filters rendered light text (`rgb(231, 238, 247)`) on white. Changing only the OS scheme to dark fixed the same control. The production Tailwind CSS emits `dark:` rules under `prefers-color-scheme`; the selector in the legacy config has no effect on that build. Align the Tailwind v4 dark variant with the saved app theme and test opposing app and OS settings. [CSS entry point](../src/app/globals.css#L1) · [Legacy config](../tailwind.config.ts#L3) · [Example control](../src/components/notifications/NotificationAdminPanel.tsx#L219) |
| P2       | Overlapping admin actions unlock a row that is still saving  | In Chromium, I held requests for two notification settings, then repeated the exercise with two user rows. Starting the second request re-enabled the first row while its request was still pending. Both UIs track one pending key for independently actionable rows. Track pending actions by row or event type, guard repeated activation of the same row, and release only the finished operation. [Notifications](../src/components/notifications/NotificationAdminPanel.tsx#L108) · [Users](../src/components/auth/UserManagementTable.tsx#L36)                                                                                                                                      |
| P3       | Notification settings can fail without feedback              | Aborting a settings request produced an unhandled `Failed to fetch` in Chromium and no save-failure feedback. The handler covers HTTP failures, while its `finally` clears the pending state even when the fetch rejects. Show the localized failure message on transport errors and leave the displayed setting consistent with the last confirmed state. [Settings handler](../src/components/notifications/NotificationAdminPanel.tsx#L108)                                                                                                                                                                                                                                             |
| P3       | Azure sign-in has nested interactive elements                | Chromium exposes a button inside the Azure sign-in link. Render one anchor styled as a button and retain the existing base path and redirect parameters. Verify a single keyboard stop and activation into the SSO flow. [Login control](../src/components/auth/LoginForm.tsx#L83)                                                                                                                                                                                                                                                                                                                                                                                                         |
| P3       | The web CLI download panel is still English in other locales | A German session rendered the English **CLI downloads** heading. The project's English-only exception applies to the standalone Go CLI. Localize the web panel's explanatory text, loading, error, empty, retry, and checksum labels. Keep literal commands and filenames intact. [Download panel](../src/components/tokens/cli-downloads.tsx#L53) · [Internationalization policy](../.specify/memory/constitution.md#ix-internationalization)                                                                                                                                                                                                                                             |

The Teams browser spec is a skipped placeholder. Its route and worker tests cover
business logic, but they do not exercise the admin controls, focus, and recovery
from a browser. Add coverage without live Microsoft Graph before porting the
panel. [Browser spec](../tests/e2e/teams-integration.spec.ts) ·
[Route tests](../tests/integration/teams-api.test.ts)

This review also corrected working documentation that described the old green
palette, directed every Mantine style import to the app stylesheet, and implied
local development could run without PostgreSQL.
[Theme guide](theme-design.md) · [README](../README.md#ui-components) ·
[Architecture baseline](../specs/base/architecture.md#important-constraints)

## Port order

| Order | Scope                                                                                                                                                                                                                                                                                                                                                                               | Acceptance for the checkpoint                                                                                                                                                                                                                                                                            |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | **Theme and shared styling.** Fix the Tailwind dark selector first. Use the existing provider and tokens for both libraries. Keep standard focus, disabled, loading, and error styling consistent across the next ports. Introduce a shared variant only where two real consumers benefit.                                                                                          | Verify rendered styles with app dark and OS light, then app light and OS dark. Check both initial HTML theme attributes, theme persistence, focus visibility, and opaque menus. Keep feature styles scoped and preserve the existing body typography.                                                    |
| 1     | **Notification administration.** First port the two filters, settings toggles, retry/status UI, and log to Mantine. Use `Table.ScrollContainer` and `Table` for the existing log. Prefer a native select styled by Mantine if it preserves the required keyboard behavior with less code. Fix pending state and transport errors in a focused change before or alongside this port. | Keep independent pending states. Cover a rejected request, two overlapping saves that finish out of order, combined filters, stale responses, and retry. Check that filters are distinctly labeled and the log scrolls inside its panel on mobile.                                                       |
| 2     | **Finish the Audit Trail and stabilize Users.** Audit Trail already uses Mantine DataTable, filters, numbered pagination, and exports. Port the remaining **Previous**, **Next**, and **Retry** buttons. Fix the Users pending-row issue in its own change. Keep the existing Users table, create-user dialog, and Role combobox.                                                   | Retain focus when a page grows, when a number disappears, and when the pager disappears. Verify same-page retry, filter resets, and CSV/PDF exports from later pages. For Users, hold two requests and verify that each row stays locked only for its own request.                                       |
| 3     | **Background Jobs and Ops Health.** Use Mantine for repeated status badges, summaries, loading/error presentation, and relevant actions. Keep the page shells and data reads on the server. Retain Background Jobs' mobile card view.                                                                                                                                               | Check admin and non-admin access, empty jobs, degraded or unavailable health, and diagnostic copying. Compare the client bundle if a component change moves rendering across the server/client boundary.                                                                                                 |
| 4     | **Token settings, in two checkpoints.** Migrate the CLI download controls, web copy, token filters, and list first. Port the create, reveal, renew, and revoke dialogs separately after the existing lifecycle tests pass on the first increment.                                                                                                                                   | Verify personal and administrator scope, mobile table behavior, localization, expiry options, clipboard handling, and one-time secret display. Test consent to destructive actions and focus when handing off from the create dialog to the reveal dialog. Keep API payloads and secret handling intact. |
| 5     | **Local authentication forms.** Fix the Azure sign-in markup first. Then port sign-in and change-password fields and feedback, retaining native form submission and autocomplete semantics.                                                                                                                                                                                         | Exercise successful and failed local login, forced and voluntary password changes, Azure callback, revoked sessions, and CLI browser login under the configured base path. Check password-manager fields, Enter submission, hydration, and focus after an error.                                         |
| 6     | **Teams configuration after browser coverage.** Add provider-free tests for the existing configuration, consent-status UI, targets, and subscriptions. Then port controls in separate slices for settings, outbound targets, and inbound subscriptions.                                                                                                                             | Validate each slice against the current routes, including stale responses, transport failures, retries, and action locking. Keep Graph consent, permissions, and worker delivery behavior unchanged during a UI port.                                                                                    |

## Implementation design for the first three checkpoints

### A user’s saved theme controls the whole page

Use Tailwind v4’s CSS-defined `dark` variant in `src/app/globals.css` to match
`[data-theme="dark"]` and its descendants. Tie the root CSS `color-scheme` to the
same selector so native form controls and scrollbars follow the app preference.
Preserve CSS layer order, body typography, and Mantine’s forced color scheme.
The root layout already emits both theme attributes on the server. The existing
provider and toggle continue to synchronize them and handle persistence.
Verify whether the legacy Tailwind config has a consumer before removing its
obsolete theme setting. [Tailwind dark-mode reference](https://tailwindcss.com/docs/dark-mode#using-a-data-attribute) ·
[Mantine color scheme reference](https://mantine.dev/theming/color-schemes/#force-color-scheme)

### An administrator can save notification settings independently

Deliver the save fix on the existing controls before switching their styling.
Key pending state by event type and guard same-key requests synchronously,
before calling `fetch`. Keep controls for other event types available. Apply
successful responses through a functional state update for the matching event
type. On rejection, HTTP error, or a missing config, retain the last confirmed
value, announce the localized failure, and release that event’s pending lock.
Keep the existing toast provider and notification endpoints.

### An administrator can filter and read the log on a narrow screen

Use visibly labeled Mantine `NativeSelect` controls for the event and status
filters. Use a Mantine checkbox with a stable event-specific accessible name,
badges for status, a retry button and a semantic `Table` with
`Table.ScrollContainer type="native"`. Keep the existing columns, summaries,
status names, and shared tokens. Load the necessary layered CSS at the
Notifications route boundary. Preserve the server-rendered page and its
platform-admin guard. [Mantine NativeSelect](https://mantine.dev/core/native-select/) ·
[Mantine table and scroll container](https://mantine.dev/core/table/#scroll-container)

The data contract stays in the current services. `GET /api/notifications`
combines optional `eventType` and `status` filters and returns the newest 50
matching rows at most. `PATCH /api/notifications/settings/[eventType]` accepts
`{ enabled }` and returns the confirmed `{ config }`. Keep the existing
latest-request guard for log reads, include both active filters when retrying,
and keep loading, failure and empty results distinguishable. PostgreSQL models,
permissions, and delivery behavior stay as documented in the existing specs.

## Components worth keeping

- **Account menu and language submenu.** Keep Radix until a Mantine
  implementation demonstrates arrow-key navigation, nested Escape behavior,
  focus return, touch access, locale switching, and sign-out. Use the existing
  Mantine theme toggle within this shell.
- **Assistant.** Keep the AI Elements conversation and existing sheet while they
  support long transcripts, streaming, voice, and drafts. Consider a bounded
  control-only port after testing focus, scrolling, and interruption.
- **Semantic layout and passive views.** Keep landmarks, labels, links, native
  forms, simple cards, and responsive layout where they already do the job.
  Keep Swagger's renderer. Choose Mantine Table for ordinary lists and retain
  Mantine DataTable for Audit Trail's existing features.
- **Toast provider.** Keep the shared API for now. Changing notification delivery
  across all callers is a separate concern from migrating a feature's controls.

## Checkpoint verification

- Compare the old and new behavior before changing a route. Use the production
  build and a dedicated PostgreSQL test database under a non-root base path.
- Cover a narrow phone, tablet, and desktop. Verify both app themes, including
  disagreement with the OS, and one non-English locale with long labels.
- Test keyboard-only operation, accessible names, visible focus, popup
  dismissal, return focus, and pending and error recovery. Check mutation
  controls with held and failed requests where applicable.
- Run focused Playwright cases for the changed workflow and its neighboring
  entry points. For shared theme, auth, or shell changes, run the full browser
  suite. Require both GitHub Validate and Joern on the final PR head before merge.
- Keep route styles scoped. Preserve server-rendered shells, authorization,
  API and data contracts, and downstream compatibility across each checkpoint.

## Baseline verification

The production build, all 375 Vitest tests, and all 37 Python worker tests
passed. Playwright passed 37 Chromium cases against disposable PostgreSQL.
The Teams placeholder and optional live Azure audio case were skipped.
Browser probes reproduced the findings above using local fixtures.

## Planning status

[Spec 023](../specs/023-mantine-migration/spec.md),
[implementation tasks](../specs/023-mantine-migration/tasks.md), and the
[pickup guide](../specs/023-mantine-migration/quickstart.md) cover the full
roadmap in one draft pull request. Use checkpoints to keep review and
validation focused. Spec 014 remains open in [Active Specs](../ACTIVE_SPECS.md).
Its delivery, recipient, scheduler, and scoped-access work stays in its
[completion review](../specs/014-shared-mailbox-notifications/completion-review.md).
