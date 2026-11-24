# Feature Specification: Mantine UI Migration

- **Branch** `codex/mantine-migration-plan`
- **Created** 2026-11-25
- **Status** Tasked
- **Source** [Template review and migration roadmap](../../docs/mantine-migration-plan.md)

## User scenarios and acceptance

| Story | Priority | User outcome                                                             | Independent acceptance                                                                                                                                                          |
| ----- | -------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US1   | P1       | The saved theme controls the application and native controls.            | In both opposing browser/app color-scheme combinations, initial HTML, computed dark utilities, and native controls follow the app. The keyboard toggle and reload preserve it.  |
| US2   | P1       | Administrators can save separate notification settings independently.    | When two saves finish in reverse order, each control unlocks on its own result. A rejected save retains the confirmed value and supports retry.                                 |
| US3   | P1       | Administrators can filter and read the Mantine notification log.         | Named filters compose, older responses cannot overwrite newer results, and retry keeps both filters. Keyboard use works and the log scrolls inside its panel on a narrow phone. |
| US4   | P2       | Audit readers can page, retry, and export with stable focus.             | Previous, Next, and Retry work across disappearing controls and keep the active filters. CSV and PDF reflect later-page filter context.                                         |
| US5   | P2       | User administrators can update independent rows.                         | Two held requests lock only their own rows. Completion or failure of one leaves the other row’s pending state intact.                                                           |
| US6   | P2       | Job operators can read statuses at desktop and mobile widths.            | Existing role restrictions and server-rendered content hold. The mobile cards and empty state remain usable.                                                                    |
| US7   | P2       | Operators can read degraded health and copy diagnostics.                 | Unavailable and degraded fixtures present the expected state and copying works for authorized users.                                                                            |
| US8   | P2       | Token users can use localized web downloads and list controls.           | A non-English locale translates web labels. Literal commands, checksums, responsive layout, and personal and administrator scope are preserved.                                 |
| US9   | P2       | Token users can create, reveal, renew, and revoke safely.                | The lifecycle retains expiry choices, one-time reveal, clipboard handling, confirmation, and predictable focus.                                                                 |
| US10  | P2       | Azure sign-in has a single keyboard stop.                                | The anchor opens the existing callback flow with the configured base path and validated return destination.                                                                     |
| US11  | P2       | Local auth forms keep native form behavior.                              | Enter submission, autocomplete, error recovery and focus work on login and both password-change paths.                                                                          |
| US12  | P3       | Teams administrators have repeatable browser coverage.                   | Provider-free tests cover configuration, consent status, outbound targets, and inbound subscriptions.                                                                           |
| US13  | P3       | Teams administrators can operate migrated settings and consent controls. | Authorized settings and consent status retain loading, failure, and retry behavior.                                                                                             |
| US14  | P3       | Teams administrators can manage migrated outbound controls.              | Held and out-of-order requests affect only the active target and stale responses do not replace current results.                                                                |
| US15  | P3       | Teams administrators can manage migrated inbound subscriptions.          | Loading, empty, failure, and retry states work with the existing subscription and permission contracts.                                                                         |

## Requirements

- **FR-001** Use the saved app theme for both component libraries and native widgets. Keep the existing SSR defaults, persistence, and shared tokens.
- **FR-002** Keep independently actionable settings and rows independently writable. Deduplicate activation while an action is pending, announce localized failures, and retain confirmed values.
- **FR-003** Preserve existing filters, paging, export scope, retry, and newest-response behavior. Distinguish loading, empty, and failure states.
- **FR-004** Keep server-rendered shells, authorization, endpoint payloads, and stored state compatible. Retain native forms, semantic tables, keyboard access, accessible names, focus visibility and return, and localization.
- **FR-005** Use Mantine for the controls named in scope and load feature styles at the route boundary. Use shared app tokens and Tailwind responsive layout. Retain the existing account menu, assistant, and toast provider.
- **FR-006** Preserve token handling and Azure and Teams contract behavior. Browser validation uses disposable PostgreSQL and provider-free Teams fixtures.
- **FR-007** Keep Spec 014’s remaining notification delivery, recipient, scheduler, and scoped-access requirements in that spec.

## Success criteria

- **SC-001** Both opposing theme combinations pass computed-style and post-reload assertions on a production build.
- **SC-002** Reverse-order notification and Users saves, rejected notification saves, and stale log responses pass their regression tests.
- **SC-003** Every port passes its workflow’s role, keyboard, responsive, locale, and failure checks in [tasks.md](tasks.md). The final head passes Validate and Joern before merge.
