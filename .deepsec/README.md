# deepsec

This directory holds the [deepsec](https://www.npmjs.com/package/deepsec)
config for the parent repo. Checked into git so teammates inherit
project context (auth shape, threat model, custom matchers); generated
scan output is gitignored.

Currently configured project: `webapp-template` (target: `..`).

## Dependency security

CI installs this workspace with its frozen lockfile, audits every severity, and
checks that the DeepSec CLI starts. The parent application audit does not cover
this separate workspace. Dependabot also monitors this directory.

DeepSec 2.3.10 still requests Sandbox 1.x, which pins vulnerable Zod 3. The scoped
Sandbox 2.9.2 override uses Zod 4; keep the CLI and sandbox validation checks when
updating it. Existing undici, Hono and qs overrides point to patched releases.
Exact release-age exceptions cover only those security patches.

Vercel OIDC 3.8.1, CLI Config 0.2.1 and CLI Exec 1.0.0 are the latest compatible
releases with registry publishing attestations. Newer releases currently fail
`trustPolicy: no-downgrade`; the trust policy remains enabled. Zod is updated
independently so those trust pins do not retain a vulnerable schema library.

Tracked findings and manifests are historical scan snapshots, not a current
open-alert list. The old E2E-network-exposure finding is addressed by binding
the test server to loopback and generating fallback signing/mock-SSO secrets
per run. Current validation evidence is recorded in the parent `CONTINUE.md`.

## Setup

1. `pnpm install` — installs deepsec.
2. Add an AI Gateway / Anthropic / OpenAI token to `.env.local`. If
   you already have `claude` or `codex` CLI logged in on this
   machine, you can skip the token for non-sandbox runs (`process` /
   `revalidate` / `triage`); deepsec auto-detects and reuses the
   subscription. See
   `node_modules/deepsec/dist/docs/vercel-setup.md` after install.
3. Open the parent repo in your coding agent (Claude Code, Cursor, …)
   and have it follow `data/webapp-template/SETUP.md` to fill in
   `data/webapp-template/INFO.md`.

## Daily commands

```bash
pnpm deepsec scan
pnpm deepsec process     --concurrency 5
pnpm deepsec revalidate  --concurrency 5                  # cuts FP rate
pnpm deepsec export      --format md-dir --out ./findings
```

`--project-id` is auto-resolved while there's only one project in
`deepsec.config.ts`. Once you've added a second project, pass
`--project-id webapp-template` (or whichever id you want) explicitly.

`scan` is free (regex only). `process` is the AI stage (≈$0.30/file
on Opus by default). Run state goes to `data/webapp-template/`.

## Adding another project

To scan another codebase from this same `.deepsec/`:

```bash
pnpm deepsec init-project ../some-other-package   # path relative to .deepsec/
```

Appends an entry to `deepsec.config.ts` and writes
`data/<id>/{INFO.md,SETUP.md,project.json}`. Open the new SETUP.md
in your agent to fill in INFO.md.

## Layout

```
deepsec.config.ts        Project list (one entry per scanned repo)
data/webapp-template/
  INFO.md                Repo context — checked into git, hand-curated
  SETUP.md               Agent setup prompt — checked in, deletable
  project.json           Generated (gitignored)
  files/                 One JSON per scanned source file (gitignored)
  runs/                  Run metadata (gitignored)
  reports/               Generated markdown reports (gitignored)
AGENTS.md                Pointer for coding agents
.env.local               Tokens (gitignored)
```

## Docs

After `pnpm install`:

- Skill: `node_modules/deepsec/SKILL.md`
- Full docs: `node_modules/deepsec/dist/docs/{getting-started,configuration,models,writing-matchers,plugins,architecture,data-layout,vercel-setup,faq}.md`

Or browse on
[GitHub](https://github.com/vercel/deepsec/tree/main/docs).
