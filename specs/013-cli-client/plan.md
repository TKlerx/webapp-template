# Implementation Plan: Cross-Platform CLI Client

**Branch**: `013-cli-client` | **Date**: 2026-04-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-cli-client/spec.md`

**Required First Step**: Read `/CONTINUE.md` before planning or implementation so the current handoff context, open risks, and recommended next actions are carried forward.

## Summary

Build a cross-platform CLI client (`gvi`) in Go that provides command-line access to all API endpoints. Supports browser-based login (localhost callback flow) and PAT authentication. Features shell autocompletion (bash/zsh/PowerShell/fish) with dynamic server-side value completion, multiple output formats (table/JSON/CSV), and distribution via GitHub Releases as single binaries per platform.

## Technical Context

**Language/Version**: Go 1.22+
**Primary Dependencies**: cobra (CLI framework), go-pretty (table output), browser (open URLs)
**Storage**: Local JSON config file (`~/.config/gvi/config.json` / `%APPDATA%\gvi\config.json`)
**Testing**: Go standard `testing` package + testify for assertions
**Target Platform**: Windows (amd64, arm64), Linux (amd64, arm64), macOS (amd64, arm64)
**Project Type**: CLI application (standalone, separate repo or subdirectory)
**Performance Goals**: Static completion < 200ms, dynamic completion < 2s, startup < 100ms
**Constraints**: Single binary per platform, no runtime dependencies, config file permissions 0600
**Scale/Scope**: ~10 commands, ~20 subcommands, talks to a single server

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | PASS | Cobra is the standard Go CLI framework — no custom abstractions |
| II. Test Coverage | PASS | Tests for every command, auth flow, and output formatter |
| III. Duplication Control | PASS | Shared HTTP client, output formatter, and auth resolver |
| IV. Incremental Delivery | PASS | P1 (auth + users) → P2 (completions, audit, jobs) → P3 (health, install) |
| V. Spec Sequencing | PASS | 012 planned first; 013 requires 012's server-side API |
| VI. Continuity | PASS | CONTINUE.md will be updated |
| VII. Azure OpenAI | N/A | No AI features |
| VIII. Web Standards | N/A | CLI, not web — but respects server's base path |
| IX. Internationalization | N/A | CLI output is English-only (standard for developer tools) |
| X. Responsive Design | N/A | CLI, not web |

## Project Structure

### Documentation (this feature)

```text
specs/013-cli-client/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── command-schema.md
└── tasks.md             # Phase 2 output (from /speckit.tasks)
```

### Source Code

```text
cli/
├── main.go                    # Entry point
├── go.mod
├── go.sum
├── cmd/
│   ├── root.go                # Root command, global flags (--format, --verbose)
│   ├── login.go               # gvi login --server <url>
│   ├── logout.go              # gvi logout
│   ├── configure.go           # gvi configure --server <url> --token <pat>
│   ├── version.go             # gvi version
│   ├── completion.go          # gvi completion bash|zsh|powershell|fish|install
│   ├── health.go              # gvi health
│   ├── users.go               # gvi users list|approve|deactivate|reactivate
│   ├── users_role.go          # gvi users role <id> --role <role>
│   ├── audit.go               # gvi audit list|export
│   └── jobs.go                # gvi jobs list|create
├── internal/
│   ├── config/
│   │   └── config.go          # Config file read/write (~/.config/gvi/config.json)
│   ├── client/
│   │   └── client.go          # HTTP client (auth headers, base path, error handling)
│   ├── auth/
│   │   └── browser.go         # Browser login flow (localhost callback server)
│   ├── output/
│   │   ├── table.go           # Table formatter
│   │   ├── json.go            # JSON formatter
│   │   ├── csv.go             # CSV formatter
│   │   └── format.go          # Format selection logic, non-interactive detection
│   └── update/
│       └── check.go           # GitHub Releases version check
├── .goreleaser.yaml           # GoReleaser config for cross-platform builds
└── tests/
    ├── login_test.go
    ├── users_test.go
    ├── audit_test.go
    ├── config_test.go
    ├── client_test.go
    └── output_test.go
```

**Structure Decision**: The CLI is a separate Go module in a `cli/` subdirectory of the main repo. This keeps it co-located with the web app for development convenience while being independently buildable. GoReleaser handles cross-compilation and GitHub Releases publishing.
