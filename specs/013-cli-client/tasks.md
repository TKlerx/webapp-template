# Tasks: Cross-Platform CLI Client

**Input**: Design documents from `/specs/013-cli-client/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/command-schema.md, quickstart.md
**Required Context**: Review `/CONTINUE.md` before task execution and update `CONTINUE.md` plus `CONTINUE_LOG.md` when project state materially changes.

**Dependency**: Spec 012 (OpenAPI & PATs) must be implemented before this CLI can be tested against the server.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Initialize Go project, install dependencies, create project scaffold

- [ ] T001 Create `cli/` directory and initialize Go module with `go mod init` in `cli/go.mod`
- [ ] T002 Add cobra, go-pretty, browser, term, and testify dependencies to `cli/go.mod` by running `go get github.com/spf13/cobra github.com/jedib0t/go-pretty/v6 github.com/pkg/browser golang.org/x/term github.com/stretchr/testify`
- [ ] T003 Create directory structure: `cli/cmd/`, `cli/internal/config/`, `cli/internal/client/`, `cli/internal/auth/`, `cli/internal/output/`, `cli/internal/update/`
- [ ] T004 Create `cli/main.go` entry point that calls `cmd.Execute()`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Root command, config management, HTTP client, and output formatters that all commands depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create root cobra command in `cli/cmd/root.go` — define `gvi` root command with global persistent flags: `--format` (`-f`, string, default `table`), `--verbose` (`-v`, bool), `--help` (`-h`). Set up pre-run hook for version check. Set version string from build-time ldflags.
- [ ] T006 Implement config manager in `cli/internal/config/config.go` — read/write JSON config at `~/.config/gvi/config.json` (Linux/macOS) or `%APPDATA%\gvi\config.json` (Windows). Fields: `server_url`, `token`. Support `GVI_SERVER_URL` and `GVI_TOKEN` environment variable overrides (env vars take precedence). Set file permissions to 0600 on creation. Functions: `Load() (*Config, error)`, `Save(config *Config) error`, `ConfigDir() string`, `Clear() error`.
- [ ] T007 Implement HTTP client in `cli/internal/client/client.go` — create `Client` struct initialized from config. Set `Authorization: Bearer <token>` header on all requests. Prepend server URL (including base path) to all API paths. Handle HTTP errors (401→exit code 2, 403→exit code 4, connection error→exit code 3, other→exit code 1). Support `--verbose` flag to log request method/URL/status and response body to stderr. Functions: `NewClient(config *Config) *Client`, `Get(path string) (*Response, error)`, `Post(path string, body interface{}) (*Response, error)`, `Delete(path string) (*Response, error)`.
- [ ] T008 [P] Implement output formatters in `cli/internal/output/format.go` — format selection from `--format` flag. Auto-detect non-interactive (piped) output via `golang.org/x/term` and switch from table to JSON automatically. All diagnostic output to stderr, data output to stdout.
- [ ] T009 [P] Implement table formatter in `cli/internal/output/table.go` — use go-pretty to render aligned, colored tables. Disable colors when non-interactive. Function: `RenderTable(headers []string, rows [][]string)`.
- [ ] T010 [P] Implement JSON formatter in `cli/internal/output/json.go` — pretty-print JSON to stdout with `encoding/json`. Function: `RenderJSON(data interface{})`.
- [ ] T011 [P] Implement CSV formatter in `cli/internal/output/csv.go` — write CSV to stdout with `encoding/csv`. Function: `RenderCSV(headers []string, rows [][]string)`.
- [ ] T011a Create unit tests in `cli/tests/config_test.go` — test Load/Save/Clear, env var overrides (GVI_SERVER_URL, GVI_TOKEN take precedence), config dir detection per platform, file permissions 0600.
- [ ] T011b Create unit tests in `cli/tests/client_test.go` — test Bearer header injection, base path prepending, HTTP error→exit code mapping (401→2, 403→4, connection→3), verbose logging to stderr.
- [ ] T011c Create unit tests in `cli/tests/output_test.go` — test table/JSON/CSV formatters produce correct output, non-interactive detection switches table→JSON.

**Checkpoint**: Project compiles, `gvi --help` works, config reads/writes, HTTP client sends authenticated requests, output formatters work

---

## Phase 3: User Story 1 - Browser Login and Run First Command (Priority: P1) 🎯 MVP

**Goal**: Users can authenticate via browser login or PAT, and run their first command (`gvi users list`)

**Independent Test**: Run `gvi login --server <url>`, complete browser login, run `gvi users list`, verify output

**⚠️ Pre-check**: Verify actual server API paths for user management (approve, deactivate, reactivate, role) against the running server or spec 012's OpenAPI spec before implementing T017-T019. Adjust paths if they differ.

### Implementation for User Story 1

- [ ] T012 [US1] Implement browser login flow in `cli/internal/auth/browser.go` — start temporary HTTP server on random available localhost port, construct authorize URL (`/api/cli-auth/authorize?callback_url=http://localhost:PORT/callback&state=RANDOM`), open browser with `github.com/pkg/browser`, wait for callback (max 120s timeout), extract code and state from callback query params, validate state matches, exchange code for token via `POST /api/cli-auth/token`, return token and user info. Handle: browser can't open (print URL to stderr), timeout (suggest PAT auth), cancel (clean shutdown).
- [ ] T013 [US1] Create `gvi login` command in `cli/cmd/login.go` — `--server` flag (required on first use, saved to config). Call browser login flow. On success: save server_url and token to config, print user name and role. On failure: print error with suggestion.
- [ ] T014 [US1] Create `gvi logout` command in `cli/cmd/logout.go` — remove token from config, confirm action. Exit 0.
- [ ] T015 [US1] Create `gvi configure` command in `cli/cmd/configure.go` — `--server` (required) and `--token` (required) flags. Save to config. Validate by calling `/api/health`. Print user name and role on success.
- [ ] T016 [US1] Create `gvi users list` command in `cli/cmd/users.go` — `--status` flag (optional, filter by ACTIVE/PENDING_APPROVAL/INACTIVE). Call `GET /api/users?status=<status>`. Render table with columns: ID, Name, Email, Role, Status. Support all output formats.
- [ ] T017 [US1] Create `gvi users approve` subcommand in `cli/cmd/users.go` — positional arg `<user-id>`. Call `POST /api/users/<id>/approve`. Print confirmation message.
- [ ] T018 [US1] Create `gvi users deactivate` and `gvi users reactivate` subcommands in `cli/cmd/users.go` — positional arg `<user-id>`. Call `POST /api/users/<id>/deactivate` or `POST /api/users/<id>/reactivate`. Print confirmation.
- [ ] T019 [US1] Create `gvi users role` subcommand in `cli/cmd/users_role.go` — positional arg `<user-id>`, `--role` flag (required). Call `PUT /api/users/<id>/role` with role body. Print confirmation.
- [ ] T019a [US1] Create tests in `cli/tests/login_test.go` — test browser login flow: localhost server starts, state parameter generated/validated, code exchange, token saved to config. Test timeout (120s), headless fallback (print URL), invalid state rejection.
- [ ] T019b [US1] Create tests in `cli/tests/users_test.go` — test users list (table output, --status filter, JSON output), approve (success, 404), deactivate/reactivate, role change. Mock HTTP responses.

**Checkpoint**: `gvi login` opens browser, authenticates, stores token. `gvi configure` sets PAT. `gvi users list/approve/deactivate/reactivate/role` all work.

---

## Phase 4: User Story 2 - Manage Users via CLI (Priority: P1)

**Goal**: Full user management via CLI (already covered by US1 implementation)

**Note**: User Story 2 (Manage Users via CLI) is fully implemented by T016-T019 in Phase 3. All user management commands are part of the `gvi users` command group. No additional tasks needed.

**Checkpoint**: All user management commands work as specified in Phase 3.

---

## Phase 5: User Story 3 - Shell Autocompletion (Priority: P2)

**Goal**: Tab completion for commands, subcommands, flags, and dynamic server-side values

**Independent Test**: Install completions, type `gvi us<Tab>` → completes to `gvi users`, type `gvi users approve <Tab>` → shows pending user IDs

### Implementation for User Story 3

- [ ] T020 [US3] Add static shell completion registration to all commands in `cli/cmd/users.go`, `cli/cmd/users_role.go`, `cli/cmd/audit.go`, `cli/cmd/jobs.go` — register `ValidArgs` for subcommands and `RegisterFlagCompletionFunc` for flag values (e.g., `--status` → ACTIVE/PENDING_APPROVAL/INACTIVE, `--role` → PLATFORM_ADMIN/SCOPE_ADMIN/SCOPE_USER, `--format` → table/json/csv)
- [ ] T021 [US3] Add dynamic completion for user IDs in `cli/cmd/users.go` — set `ValidArgsFunction` on approve/deactivate/reactivate/role subcommands to query `GET /api/users` and return matching user IDs. Filter by appropriate status (e.g., approve shows only PENDING_APPROVAL users).
- [ ] T022 [US3] Add dynamic completion for `--role` flag in `cli/cmd/users_role.go` — return PLATFORM_ADMIN, SCOPE_ADMIN, SCOPE_USER

**Checkpoint**: Tab completion works for all commands, subcommands, flags, and dynamically fetches user IDs from server

---

## Phase 6: User Story 4 - Export and Query Audit Logs (Priority: P2)

**Goal**: Query and export audit trail via CLI with filtering and format options

**Independent Test**: Run `gvi audit list`, verify entries shown. Run `gvi audit export --format csv > audit.csv`, verify valid CSV.

### Implementation for User Story 4

- [ ] T023 [US4] Create `gvi audit list` command in `cli/cmd/audit.go` — flags: `--action`, `--from` (ISO 8601 date), `--to` (ISO 8601 date), `--actor` (user ID). Call `GET /api/audit` with query params. Render table with columns: ID, Action, Entity, Actor, Date. Support all output formats.
- [ ] T024 [US4] Create `gvi audit export` subcommand in `cli/cmd/audit.go` — flags: `--from`, `--to`, `--format` (override global, default JSON when piped). Call `GET /api/audit` with query params (same endpoint as `audit list`). Output to stdout for piping. Difference from `audit list`: defaults to JSON format when piped, omits interactive table chrome.
- [ ] T025 [P] [US4] Add dynamic completion for `--action` flag in `cli/cmd/audit.go` — return available AuditAction values. Add dynamic completion for `--actor` flag to return user IDs.
- [ ] T025a [US4] Create tests in `cli/tests/audit_test.go` — test audit list (with --action, --from, --to, --actor filters), audit export (JSON and CSV output to stdout). Mock HTTP responses.

**Checkpoint**: `gvi audit list` shows entries with filters, `gvi audit export --format csv > file.csv` produces valid CSV

---

## Phase 7: User Story 5 - Manage Background Jobs (Priority: P2)

**Goal**: Create and list background jobs via CLI

**Independent Test**: Run `gvi jobs create --type test --payload '{}'`, verify job created. Run `gvi jobs list`, verify it appears.

### Implementation for User Story 5

- [ ] T026 [US5] Create `gvi jobs list` command in `cli/cmd/jobs.go` — call `GET /api/background-jobs`. Render table with columns: ID, Type, Status, Created. Support all output formats.
- [ ] T027 [US5] Create `gvi jobs create` subcommand in `cli/cmd/jobs.go` — flags: `--type` (required), `--payload` (required, JSON string). Call `POST /api/background-jobs` with body. Print job ID and status on success.
- [ ] T027a [US5] Add tests to `cli/tests/jobs_test.go` — test jobs list (table output), jobs create (--type, --payload). Mock HTTP responses.

**Checkpoint**: `gvi jobs list` shows jobs, `gvi jobs create` creates new jobs

---

## Phase 8: User Story 6 - Install Shell Completions (Priority: P3)

**Goal**: Generate and install shell completion scripts for bash, zsh, PowerShell, fish

**Independent Test**: Run `gvi completion bash`, verify valid bash completion script output. Run `gvi completion install`, verify script installed.

### Implementation for User Story 6

- [ ] T028 [US6] Create `gvi completion` command in `cli/cmd/completion.go` — subcommands: `bash`, `zsh`, `powershell`, `fish` that output the respective completion script to stdout using cobra's built-in `GenBashCompletionV2`, `GenZshCompletion`, `GenPowerShellCompletionWithDesc`, `GenFishCompletion`.
- [ ] T029 [US6] Create `gvi completion install` subcommand in `cli/cmd/completion.go` — auto-detect current shell, install completion script to appropriate location (bash: `~/.bash_completion.d/gvi`, zsh: `~/.zsh/completion/_gvi`, PowerShell: profile directory, fish: `~/.config/fish/completions/gvi.fish`). Print manual instructions if auto-install not possible.

**Checkpoint**: `gvi completion bash|zsh|powershell|fish` outputs valid scripts, `gvi completion install` installs for the current shell

---

## Phase 9: User Story 7 - Check System Health (Priority: P3)

**Goal**: Check server health status and display CLI/server version

**Independent Test**: Run `gvi health`, verify status shown. Run `gvi version`, verify CLI and server version displayed.

### Implementation for User Story 7

- [ ] T030 [US7] Create `gvi health` command in `cli/cmd/health.go` — call `GET /api/health`. Render status, database connectivity, server version. Exit code 0 (healthy), 3 (unreachable), 1 (unhealthy). Support all output formats.
- [ ] T031 [US7] Create `gvi version` command in `cli/cmd/version.go` — display CLI version (from build-time ldflags), server URL (from config), server version (from health endpoint if configured). If not configured, show only CLI version.

**Checkpoint**: `gvi health` shows server status, `gvi version` shows CLI and server versions

---

## Phase 10: Version Check & Distribution

**Purpose**: Update notifications and cross-platform release setup

- [ ] T032 Implement version check in `cli/internal/update/check.go` — on each command invocation, check GitHub Releases API (`GET /repos/{owner}/{repo}/releases/latest`) in a background goroutine. Cache result in `~/.config/gvi/version-check.json` for 24 hours. Print one-line notification to stderr if newer version available. Never block command execution. Suppress in non-interactive mode.
- [ ] T033 Wire version check into root command pre-run hook in `cli/cmd/root.go` — call update check as goroutine, print notification in post-run if update available
- [ ] T034 Create GoReleaser config at `cli/.goreleaser.yaml` — build for 6 targets (linux/amd64, linux/arm64, darwin/amd64, darwin/arm64, windows/amd64, windows/arm64), set binary name to `gvi`, inject version via ldflags, create tar.gz (Linux/macOS) and zip (Windows) archives, generate checksums
- [ ] T035 [P] Create GitHub Actions release workflow at `.github/workflows/cli-release.yml` — trigger on tag push (`cli-v*`), run GoReleaser to build and publish to GitHub Releases

**Checkpoint**: `gvi` prints update notification when newer version exists, GoReleaser builds all 6 platform binaries

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, help text, final validation

- [ ] T036 Add `--help` usage examples to every command in `cli/cmd/*.go` — include realistic examples in cobra `Example` field (e.g., `gvi users list --status ACTIVE --format json`)
- [ ] T037 Add `X-API-Key` header support in `cli/internal/client/client.go` — add `GVI_AUTH_HEADER` env var (values: `bearer` or `api-key`, default `bearer`) to select which header the client uses. No CLI flag needed — Bearer is the default and X-API-Key is for special integration scenarios only.
- [ ] T038 Verify all commands handle base path correctly — test with server URL like `https://example.com/app`, ensure API paths are `https://example.com/app/api/users` not `https://example.com/api/users`
- [ ] T039 Verify exit codes are correct for all error scenarios — auth error (2), connection error (3), permission error (4), general error (1), success (0)
- [ ] T040 Run `go vet ./...` and `go test ./...` in `cli/` and fix any issues
- [ ] T041 Update `CONTINUE.md` and `CONTINUE_LOG.md` with CLI feature completion status
- [ ] T041a Update `ACTIVE_SPECS.md` — add spec 013 entry at start of implementation; remove entry when all tasks are complete per constitution VI

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1
- **User Stories (Phase 3-9)**: All depend on Phase 2 (root command, config, HTTP client, formatters)
  - US1 (Phase 3): Core — login + users commands
  - US2 (Phase 4): No additional tasks (covered by US1)
  - US3 (Phase 5): Depends on US1 (adds completions to existing commands)
  - US4 (Phase 6): Independent of US1 (audit commands)
  - US5 (Phase 7): Independent of US1 (jobs commands)
  - US6 (Phase 8): Independent (completion scripts)
  - US7 (Phase 9): Independent (health/version)
- **Distribution (Phase 10)**: Can start after Phase 2 (GoReleaser config doesn't need commands)
- **Polish (Phase 11)**: Depends on all user stories

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no story dependencies
- **US2 (P1)**: Covered by US1 — no additional work
- **US3 (P2)**: After US1 — adds completions to commands created in US1
- **US4 (P2)**: After Phase 2 — fully independent
- **US5 (P2)**: After Phase 2 — fully independent
- **US6 (P3)**: After Phase 2 — fully independent
- **US7 (P3)**: After Phase 2 — fully independent

### Parallel Opportunities

- T008-T011: All output formatters can be built in parallel
- T023-T025: Audit commands and completions in parallel
- T026-T027: Jobs commands in parallel
- T028-T029: Completion commands in parallel
- T030-T031: Health and version in parallel
- T034-T035: GoReleaser config and GitHub Actions in parallel
- US4, US5, US6, US7 can all be built in parallel after Phase 2

---

## Parallel Example: User Story 1

```text
# After Phase 2, launch in parallel:
T012 [P] Browser login flow (internal/auth/browser.go)
T013-T015 are sequential (login → logout → configure depend on auth flow)

# Then users commands in parallel:
T016 [P] users list
T017 [P] users approve
T018 [P] users deactivate/reactivate
T019 [P] users role
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Go project scaffold)
2. Complete Phase 2: Foundational (root command, config, HTTP client, formatters)
3. Complete Phase 3: US1 — browser login + PAT configure + users commands
4. **STOP and VALIDATE**: `gvi login`, then `gvi users list` against running server
5. Build with `go build` and test on current platform

### Incremental Delivery

1. Setup + Foundational → `gvi --help` works
2. US1 → Login and user management (MVP!)
3. US3 → Shell completions make everything faster
4. US4 → Audit queries and exports
5. US5 → Background job management
6. US6 → Completion install for new users
7. US7 → Health checks and version info
8. Distribution → GoReleaser for all platforms
9. Polish → Help text, error handling, validation

---

## Notes

- CLI is a Go project in `cli/` subdirectory, separate from the Next.js web app
- Server must have spec 012 implemented (PAT auth + CLI login flow) for testing
- Binary name `gvi` is set via GoReleaser and ldflags — changeable later
- Config never stores usernames or passwords, only server URL and token
- Environment variables `GVI_SERVER_URL` and `GVI_TOKEN` override config file
- Non-interactive detection auto-switches table→JSON for piped output
- Update check is non-blocking (goroutine) with 24h cache
