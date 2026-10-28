# Continue

## 2026-10-29 Focused Joern Gate

- Split the static-analysis sources and controls from draft PR #44 onto current main. No runtime, PostgreSQL conversion, dependency or archival changes are included. Security maintenance was already merged through PR #45 (`f877d61`).
- Added the pinned Joern 4.0.650/Java 25 CI job with controls, fresh application extraction and uploaded evidence. Main must require both `validate` and `Joern security analysis` before this PR merges.
- Fixed the extraction gate: only the nine reviewed JavaScript/TypeScript omissions are allowed; additional omissions fail. The real-process regression failed before the fix and passes after it, covering both known omissions and a newly omitted route. Python still requires complete extraction.
- Kept analysis-only examples/references outside application compilation, lint, Semgrep and Docker build contexts; generated analysis artifacts remain ignored. Existing application security checks stay enabled.
- Local verification: 225 application tests across 62 files, typecheck, ESLint, formatting and the real-process gate self-check pass. Run the focused PR's complete CI and merge only after both jobs pass. Keep PR #44 draft for the separate runtime/PostgreSQL review.

## 2026-10-28 Security-Only Maintenance

- Isolated the security updates from commit `178b050` onto current main. The broader PostgreSQL/runtime/archival and Joern work remains on `codex/consolidate-runtime-and-analysis` in draft PR #44 and is outside this merge's scope.
- Updated Next.js/eslint-config-next 16.4.3, Better Auth 1.7.13, Zod 4.6.7, Vitest/coverage 4.1.12, Vite 8.3.5 and Go 1.26.10, with patched transitive dependency overrides and a regenerated lockfile. Both production and full pnpm audits report zero known vulnerabilities.
- Better Auth 1.7 requires credential accountId to equal User.id. Aligned credential creation, login, password changes, mock SSO and test fixtures. Added the preserving data migration to main's existing migration histories; password hashes and external-provider identities remain unchanged. Deploy migrations with the application upgrade.
- CI's floating Python 3.x selected 3.15, which the locked psycopg binary does not support. Pinned Python 3.12 and provisioned PostgreSQL before the new migration regression. No database architecture change is included here.
- Local application tests: 225 passed across 62 files. Typecheck and production/full dependency audits pass. CI for the isolated branch is the remaining merge gate; the source branch's broader validation results do not establish this branch's CI status.
- Joern's first Linux CI job passed on PR #44. Its originating chat is "Investigate missing Dependabot PRs" (`01a13ca3-4694-7c31-9e87-e2e14a6bcd2e`); its rule and CI changes were made on October 15.

<!-- continuity:fingerprint=327ecf5abf4b15c8d7507401e047d857bc073b95464288446f2fbf696325d2fc -->

## Current Snapshot

- Updated: 2026-10-29 (Europe/Berlin)
- Branch: `codex/joern-security-gate`

## Recent Non-Continuity Commits

- ad5dccd Complete ops health spec convergence (#40)
- 5da384d Upgrade Spec Kit integration and add converge (#39)
- 98f0893 Validate boundaries and block committed secrets (#38)
- 8ddc35e fix: apply security overrides (#37)
- e2fea0b fix: patch fast-uri and stabilize spec overview validation (#36)

## Git Status

- Security dependency updates, credential compatibility/migrations, regression tests, CI compatibility and continuity notes are prepared for the security-only PR. Use `git status --short` for the current checkout state.

## Active Specs

- No active spec folders detected.

## Next Recommended Actions

1. Fix any failures in the isolated security PR and merge only after CI passes, as requested by the user.
2. Review the older Joern/runtime work separately in draft PR #44 and its originating chat; do not merge that broader branch under the security-only authorization.

## 2026-10-04 security dependencies

- Updated affected application and scanner dependencies; removed obsolete overrides where native ranges suffice.
- Application frozen lockfile verification passes. Scanner audit is clean, but its existing Vercel packages fail pnpm trust-downgrade verification; policy remains enabled.
- Application audit retains the unpatched braces 3.0.3 advisory. Full application validation awaits PR CI.
