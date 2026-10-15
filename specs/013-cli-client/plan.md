# Implementation Plan: Cross-Platform CLI Client

**Branch**: `013-cli-client` | **Date**: 2026-04-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-cli-client/spec.md`

**Required First Step**: Read `/CONTINUE.md` before planning or implementation so the current handoff context, open risks, and recommended next actions are carried forward.

## Summary

Build a cross-platform CLI client (`starterctl`) in Go that provides command-line access to all API endpoints. Supports browser-based login (localhost callback flow) and PAT authentication. Features shell autocompletion (bash/zsh/PowerShell/fish) with dynamic server-side value completion, multiple output formats (table/JSON/CSV), and distribution via GitHub Releases as single binaries per platform.

## Technical Context

**Language/Version**: Go 1.22+
**Primary Dependencies**: cobra (CLI framework), go-pretty (table output), browser (open URLs)
**Storage**: Local JSON config file (`~/.config/starterctl/config.json` / `%APPDATA%\starterctl\config.json`)
**Testing**: Go standard `testing` package + testify for assertions
**Target Platform**: Windows (amd64, arm64), Linux (amd64, arm64), macOS (amd64, arm64)
**Project Type**: CLI application (standalone, separate repo or subdirectory)
**Performance Goals**: Static completion < 200ms, dynamic completion < 2s, startup < 100ms
**Constraints**: Single binary per platform, no runtime dependencies, config file permissions 0600
**Scale/Scope**: ~10 commands, ~20 subcommands, talks to a single server

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                | Status | Notes                                                                                                                         |
| ------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| I. Simplicity First      | PASS   | Cobra is the standard Go CLI framework â€” no custom abstractions                                                             |
| II. Test Coverage        | PASS   | Tests for every command, auth flow, and output formatter                                                                      |
| III. Duplication Control | PASS   | Shared HTTP client, output formatter, and auth resolver                                                                       |
| IV. Incremental Delivery | PASS   | P1 (auth + users) â†’ P2 (completions, audit, jobs) â†’ P3 (health, install)                                                  |
| V. Spec Sequencing       | PASS   | 012 planned first; 013 requires 012's server-side API                                                                         |
| VI. Continuity           | PASS   | CONTINUE.md will be updated                                                                                                   |
| VII. Azure OpenAI        | N/A    | No AI features                                                                                                                |
| VIII. Web Standards      | N/A    | CLI, not web â€” but respects server's base path                                                                              |
| IX. Internationalization | PASS   | User-approved English-only companion CLI exception in constitution 3.0.0 (2026-10-15); web UI localization remains unchanged. |
| X. Responsive Design     | N/A    | CLI, not web                                                                                                                  |

## Project Structure

### Documentation (this feature)

```text
specs/013-cli-client/
â”œâ”€â”€ plan.md              # This file
â”œâ”€â”€ research.md          # Phase 0 output
â”œâ”€â”€ data-model.md        # Phase 1 output
â”œâ”€â”€ quickstart.md        # Phase 1 output
â”œâ”€â”€ contracts/           # Phase 1 output
â”‚   â””â”€â”€ command-schema.md
â””â”€â”€ tasks.md             # Phase 2 output (from /speckit.tasks)
```

### Source Code

```text
cli/
â”œâ”€â”€ main.go                    # Entry point
â”œâ”€â”€ go.mod
â”œâ”€â”€ go.sum
â”œâ”€â”€ cmd/
â”‚   â”œâ”€â”€ root.go                # Root command, global flags (--format, --verbose)
â”‚   â”œâ”€â”€ login.go               # starterctl login --server <url>
â”‚   â”œâ”€â”€ logout.go              # starterctl logout
â”‚   â”œâ”€â”€ configure.go           # starterctl configure --server <url> --token <pat>
â”‚   â”œâ”€â”€ version.go             # starterctl version
â”‚   â”œâ”€â”€ completion.go          # starterctl completion bash|zsh|powershell|fish|install
â”‚   â”œâ”€â”€ health.go              # starterctl health
â”‚   â”œâ”€â”€ users.go               # starterctl users list|approve|deactivate|reactivate
â”‚   â”œâ”€â”€ users_role.go          # starterctl users role <id> --role <role>
â”‚   â”œâ”€â”€ audit.go               # starterctl audit list|export
â”‚   â””â”€â”€ jobs.go                # starterctl jobs list|create
â”œâ”€â”€ internal/
â”‚   â”œâ”€â”€ config/
â”‚   â”‚   â””â”€â”€ config.go          # Config file read/write (~/.config/starterctl/config.json)
â”‚   â”œâ”€â”€ client/
â”‚   â”‚   â””â”€â”€ client.go          # HTTP client (auth headers, base path, error handling)
â”‚   â”œâ”€â”€ auth/
â”‚   â”‚   â””â”€â”€ browser.go         # Browser login flow (localhost callback server)
â”‚   â”œâ”€â”€ output/
â”‚   â”‚   â”œâ”€â”€ table.go           # Table formatter
â”‚   â”‚   â”œâ”€â”€ json.go            # JSON formatter
â”‚   â”‚   â”œâ”€â”€ csv.go             # CSV formatter
â”‚   â”‚   â””â”€â”€ format.go          # Format selection logic, non-interactive detection
â”‚   â””â”€â”€ update/
â”‚       â””â”€â”€ check.go           # GitHub Releases version check
â”œâ”€â”€ .goreleaser.yaml           # GoReleaser config for cross-platform builds
â””â”€â”€ tests/
    â”œâ”€â”€ login_test.go
    â”œâ”€â”€ users_test.go
    â”œâ”€â”€ audit_test.go
    â”œâ”€â”€ config_test.go
    â”œâ”€â”€ client_test.go
    â””â”€â”€ output_test.go
```

**Structure Decision**: The CLI is a separate Go module in a `cli/` subdirectory of the main repo. This keeps it co-located with the web app for development convenience while being independently buildable. GoReleaser handles cross-compilation and GitHub Releases publishing.
