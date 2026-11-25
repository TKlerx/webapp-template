# Pick up the draft

Check out `codex/mantine-migration-plan`, then verify that Spec Kit finds feature
023 and its tasks from the repository root.

```sh
pwsh -NoProfile -File .specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireSpec -RequireTasks -IncludeTasks
```

Run `$speckit-implement` in Codex on this branch. Update
`ACTIVE_SPECS.md` and continuity when implementation starts, then start with
T001. Keep checkpoint changes in this draft and check off tasks only after
their validation passes.

## Local validation

Use the repository’s pinned pnpm version, PowerShell, and Chromium from
Playwright. The Playwright configuration builds and starts the production app
under `/app-starter` by default. Provision the local Playwright database with
Docker, or set `TEST_DATABASE_URL` to an existing disposable PostgreSQL database
whose name ends in `_test`. The suite applies test migrations and seeds that
database.

```sh
pnpm exec playwright test tests/e2e/auth/theme-persistence.spec.ts tests/e2e/locale-switcher.spec.ts
pnpm exec playwright test tests/e2e/notifications/admin-notifications.spec.ts tests/e2e/notifications/event-notifications.spec.ts
pnpm exec vitest run tests/integration/notification-admin-api.test.ts
pnpm test:e2e
```

The first command should pass both opposing app and OS colors, keyboard theme
changes, and persistence. The notification tests should retain independent
pending controls, combined filters, localized failure feedback and safe retry.
Use the focused test paths in [tasks.md](tasks.md) for the rest of the ports.
Run the full browser suite after shared styles or auth change. Capture Validate
and Joern at the final PR head before marking it ready to merge.
