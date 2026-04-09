# Clarify: Cross-Platform CLI Client

**Feature**: `013-cli-client`  
**Date**: 2026-04-09

## Resolved Decisions

- Binary name: `gvi` (changeable later as build-time setting)
- Distribution: GitHub Releases with pre-built binaries per platform (6 targets), package managers later
- Config storage: `~/.config/gvi/config.json` (Linux/macOS), `%APPDATA%\gvi\config.json` (Windows), JSON, stores only server URL and token
- Update mechanism: Non-blocking version check on launch, one-line notification, no auto-update, 24h cache
- Environment variables: `GVI_SERVER_URL` and `GVI_TOKEN` (override config file)
- Auth method: Browser login as default (US1), PAT via `configure --token` as fallback for non-interactive use
- Language: Go 1.22+ for single-binary cross-platform support
- CLI framework: cobra (standard Go CLI framework)
- Output: go-pretty for tables, stdlib for JSON/CSV, non-interactive auto-switches table→JSON
