# Mantine migration tasks

See the [implementation plan](plan.md) and [migration roadmap](../../docs/mantine-migration-plan.md)
for design decisions and the component inventory. Work in the same draft
pull request. Validate each checkpoint before moving on.

## Checkpoint 1 · Saved theme and shared styling

**User outcome.** Controls remain legible and native browser widgets match the
saved app theme even when the operating system uses the opposite theme.

- [ ] T001 [US1] Extend `tests/e2e/auth/theme-persistence.spec.ts` with app-dark/OS-light and app-light/OS-dark cases. Assert both root attributes on the initial HTML, computed root `color-scheme`, and computed styling on a Tailwind `dark:` consumer that survives the notification port, such as the version badge in `src/components/ui/AppVersionBadge.tsx`. Assert that changing browser preference alone leaves the app appearance unchanged.
- [ ] T002 [US1] Define the Tailwind v4 dark variant and the matching native `color-scheme` in `src/app/globals.css`. Inspect the generated CSS and remove the dormant legacy theme setting in `tailwind.config.ts` if there is no consumer. Preserve the route and provider contracts in `src/app/layout.tsx` and `src/components/providers/ThemeProvider.tsx`.
- [ ] T003 [US1] Verify keyboard toggling, persistence across sign-out and sign-in, body line height, visible focus, and opaque menus in `tests/e2e/auth/theme-persistence.spec.ts` and `tests/e2e/locale-switcher.spec.ts`. Run the full production Chromium suite through `playwright.config.ts` before closing this shared change.

## Checkpoint 2 · Notification save reliability

**User outcome.** While one event type saves, an administrator can edit another.
A failed save preserves the confirmed selection and lets them retry.

- [ ] T004 [US2] In `tests/e2e/notifications/admin-notifications.spec.ts`, hold two PATCH responses and finish the second one first. Assert that only the finishing control unlocks, both confirmed values survive, and keyboard activation cannot enqueue a duplicate while a control is pending.
- [ ] T005 [US2] In `tests/e2e/notifications/admin-notifications.spec.ts`, cover a rejected PATCH and a successful retry. Assert localized failure feedback, the prior checked state, and reactivation of the control.
- [ ] T006 [US2] In `src/components/notifications/NotificationAdminPanel.tsx`, guard duplicate saves synchronously per event, expose pending membership per control, apply confirmed state per event, and handle transport, HTTP, and invalid-response failures. Clear only the completing request’s lock.
- [ ] T007 [US2] Run `tests/e2e/notifications/admin-notifications.spec.ts` and `tests/integration/notification-admin-api.test.ts` against disposable PostgreSQL. Retain one real successful PATCH in browser coverage.

## Checkpoint 3 · Notification administration controls and log

**User outcome.** An administrator can identify both filters, retry a failed
load with those filters intact, and read the log without scrolling the page
horizontally.

- [ ] T008 [US3] Adapt `tests/e2e/notifications/admin-notifications.spec.ts` to use named controls. Retain combined-filter and stale-result coverage, then add a failed combined query and same-filter retry. Verify initial load, empty results, and platform-admin access.
- [ ] T009 [US3] Convert the controls, pending and error feedback, status badges, and log in `src/components/notifications/NotificationAdminPanel.tsx`. Use route-scoped layered component styles from `src/app/(dashboard)/admin/notifications/page.tsx`. Reuse the localized strings in `src/i18n/messages/` and preserve the existing toast and API contracts.
- [ ] T010 [US3] In `tests/e2e/notifications/admin-notifications.spec.ts`, verify keyboard operation and visible focus, distinctly named filters and toggles, a long-label locale, and internal table scrolling at 320 px. Verify both app themes, an intermediate viewport, and desktop.
- [ ] T011 [US3] Run `tests/e2e/notifications/admin-notifications.spec.ts`, `tests/e2e/notifications/event-notifications.spec.ts`, and `tests/integration/notification-admin-api.test.ts`. Check that a non-admin cannot use the page or settings API.

## Remaining workflow checkpoints

Keep each workflow in a reviewable commit or commit group and record its
production-browser checks in the draft.

- [ ] T012 [US4] Finish the Audit Trail controls in `src/components/audit/AuditTrailViewer.tsx`. Port Previous, Next, and Retry with `tests/e2e/audit-trail.spec.ts` covering focus when controls disappear, same-page retry, filter reset, and later-page CSV/PDF exports.
- [ ] T013 [US5] Fix independent row locks in `src/components/auth/UserManagementTable.tsx`. In `tests/e2e/users/user-management.spec.ts`, finish two row requests in reverse order and assert that loading and failure affect only their own rows. Check the Users desktop layout PR before touching shared row behavior.
- [ ] T014 [US6] Port repeated badges and feedback in `src/app/(dashboard)/background-jobs/page.tsx`. Preserve its server render and mobile cards. Verify admin and non-admin behavior and empty results in `tests/e2e/background-jobs/admin-jobs-dashboard.spec.ts`.
- [ ] T015 [US7] Port Ops Health badges and status presentation in `src/components/ops/OpsHealthDashboard.tsx` and `src/components/ops/HealthStatusBadge.tsx`. Verify degraded and unavailable states, diagnostics copy and access in `tests/e2e/ops-health/admin-ops-health.spec.ts`. Compare client bundle output if moving a server/client boundary.
- [ ] T016 [US8] Port the download panel and token list/filter controls in `src/components/tokens/cli-downloads.tsx` and `src/components/tokens/token-list.tsx`. Localize the web download copy in `src/i18n/messages/`, retaining literal commands and filenames. Verify personal and administrator token scope, long labels, checksums and mobile layouts in `tests/e2e/token-management.spec.ts`.
- [ ] T017 [US9] After T016, port lifecycle dialogs in `src/components/tokens/create-token-dialog.tsx`, `src/components/tokens/token-value-display.tsx`, and `src/components/tokens/token-list.tsx`. Cover expiry, one-time reveal and clipboard, revoke confirmation, failure recovery, and focus between dialogs in `tests/e2e/token-management.spec.ts`.
- [ ] T018 [US10] Render one Azure sign-in anchor in `src/components/auth/LoginForm.tsx`. Verify one keyboard stop, base path, redirect target, and callback in `tests/e2e/auth/sso-login.spec.ts` and `tests/e2e/auth/cli-sso-flow.spec.ts`.
- [ ] T019 [US11] After T018, port local sign-in and password-change fields in `src/components/auth/LoginForm.tsx` and `src/components/auth/ChangePasswordForm.tsx`. Verify Enter submission, autocomplete, error focus, forced and voluntary password changes, and revoked sessions under `tests/e2e/auth/`.
- [ ] T020 [US12] Replace the placeholder in `tests/e2e/teams-integration.spec.ts` with provider-free coverage of configuration, consent status, outbound targets, and inbound subscriptions. Reuse contracts exercised by `tests/integration/teams-api.test.ts`.
- [ ] T021 [US13] After T020, port Teams settings and consent controls in `src/components/teams/TeamsIntegrationPanel.tsx`. Verify authorization, consent-state feedback, and failure/retry in `tests/e2e/teams-integration.spec.ts`.
- [ ] T022 [US14] After T021, port outbound targets in `src/components/teams/TeamsIntegrationPanel.tsx`. Verify held requests, locking, retries, and stale-result handling in `tests/e2e/teams-integration.spec.ts`.
- [ ] T023 [US15] After T022, port inbound subscriptions in `src/components/teams/TeamsIntegrationPanel.tsx`. Preserve Graph permissions and worker delivery. Verify loading, empty, failure and retry in `tests/e2e/teams-integration.spec.ts`.

## Final verification

- [ ] T024 Verify production build, TypeScript, Vitest, and the full browser suite from `package.json` and `playwright.config.ts`. Record results in `CONTINUE.md` and `CONTINUE_LOG.md`, including provider coverage limits. Verify Validate and Joern at the final head.

## Dependencies and verification

- T001 → T002 → T003 is the first shippable increment.
- T004 and T005 cover separate failure modes in the same test file. Coordinate
  edits there, then complete T006 and T007 as the second checkpoint.
- Complete T003 and T007 before releasing T008–T011. T008 can be drafted while
  theme work is running. Coordinate edits to shared browser fixtures.
- Audit Trail, Users, and job/health checkpoints can be prepared independently
  after the theme checkpoint. Keep the token, auth, and Teams chains in the
  order shown. Complete T024 after all implementation checkpoints.
- Use a production build under the configured base path and a disposable
  PostgreSQL database. Follow the [verification
  checklist](../../docs/mantine-migration-plan.md#checkpoint-verification), including Validate
  and Joern on the exact head. Shared styling and auth changes get a full
  browser run.
