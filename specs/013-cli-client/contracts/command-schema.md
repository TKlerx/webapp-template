# Command Schema: GVI CLI

**Date**: 2026-04-09

## Global Flags

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--format` | `-f` | string | `table` | Output format: `table`, `json`, `csv` |
| `--verbose` | `-v` | bool | false | Show request/response details |
| `--help` | `-h` | bool | false | Show help for any command |

## Commands

### gvi login

Authenticate via browser login flow.

```
gvi login --server <url>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--server` | Yes (first time) | Server URL; saved to config for subsequent logins |

**Behavior**: Opens browser to server login page. Starts localhost callback server. Waits up to 120s. On success, stores token and server URL in config. Prints user name and role.

**Exit codes**: 0 (success), 2 (auth failed/timeout), 3 (server unreachable)

---

### gvi logout

Remove stored credentials.

```
gvi logout
```

**Behavior**: Deletes token from config file. Confirms action.

---

### gvi configure

Manually set server URL and PAT.

```
gvi configure --server <url> --token <pat>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--server` | Yes | Server URL (including base path if applicable) |
| `--token` | Yes | Personal access token |

**Behavior**: Stores server URL and token in config. Validates by calling health endpoint. Prints user name and role on success.

---

### gvi version

Show CLI and server version.

```
gvi version
```

**Output**: CLI version, server URL, server version (from health endpoint). If not configured, shows only CLI version.

---

### gvi health

Check server health.

```
gvi health
```

**Output**: Server status, database status, server version.

**Exit codes**: 0 (healthy), 3 (unreachable), 1 (unhealthy)

---

### gvi users list

List users.

```
gvi users list [--status <status>]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--status` | No | Filter by status: `ACTIVE`, `PENDING_APPROVAL`, `INACTIVE` |

**Output columns**: ID, Name, Email, Role, Status

**Dynamic completion**: `--status` completes to available status values.

---

### gvi users approve

Approve a pending user.

```
gvi users approve <user-id>
```

**Dynamic completion**: `<user-id>` completes to pending user IDs (fetched from API with `?status=PENDING_APPROVAL`).

---

### gvi users deactivate

Deactivate a user.

```
gvi users deactivate <user-id>
```

**Dynamic completion**: `<user-id>` completes to active user IDs.

---

### gvi users reactivate

Reactivate a user.

```
gvi users reactivate <user-id>
```

**Dynamic completion**: `<user-id>` completes to inactive user IDs.

---

### gvi users role

Change a user's role.

```
gvi users role <user-id> --role <role>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--role` | Yes | New role: `PLATFORM_ADMIN`, `SCOPE_ADMIN`, `SCOPE_USER` |

**Dynamic completion**: `<user-id>` completes to all user IDs. `--role` completes to available roles.

---

### gvi audit list

List recent audit entries.

```
gvi audit list [--action <action>] [--from <date>] [--to <date>] [--actor <user-id>]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--action` | No | Filter by audit action |
| `--from` | No | Start date (ISO 8601) |
| `--to` | No | End date (ISO 8601) |
| `--actor` | No | Filter by actor user ID |

**Output columns**: ID, Action, Entity, Actor, Date

---

### gvi audit export

Export audit data.

```
gvi audit export [--from <date>] [--to <date>] [--format <format>]
```

**Behavior**: Outputs all audit entries matching filters to stdout. Default format: JSON when piped, table when interactive.

---

### gvi jobs list

List background jobs.

```
gvi jobs list
```

**Output columns**: ID, Type, Status, Created

---

### gvi jobs create

Create a background job.

```
gvi jobs create --type <job-type> --payload <json>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--type` | Yes | Job type string |
| `--payload` | Yes | JSON payload string |

---

### gvi completion

Generate or install shell completion scripts.

```
gvi completion bash|zsh|powershell|fish
gvi completion install
```

**Subcommands**:
- `bash`, `zsh`, `powershell`, `fish`: Output completion script to stdout
- `install`: Auto-detect shell and install completion script

## Non-Interactive Detection

When stdout is not a terminal (piped or redirected):
- Table format switches to JSON automatically
- Colors and progress indicators are disabled
- Update notifications are suppressed
- All diagnostic output goes to stderr
