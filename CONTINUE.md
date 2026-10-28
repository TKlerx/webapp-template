# Continue

## 2026-10-28 Security-Only Maintenance

- Isolated the security updates from commit `178b050` onto current main. The broader PostgreSQL/runtime/archival and Joern work remains on `codex/consolidate-runtime-and-analysis` in draft PR #44 and is outside this merge's scope.
- Updated Next.js/eslint-config-next 16.4.3, Better Auth 1.7.13, Zod 4.6.7, Vitest/coverage 4.1.12, Vite 8.3.5 and Go 1.26.10, with patched transitive dependency overrides and a regenerated lockfile. Both production and full pnpm audits report zero known vulnerabilities.
- Better Auth 1.7 requires credential accountId to equal User.id. Aligned credential creation, login, password changes, mock SSO and test fixtures. Added the preserving data migration to main's existing migration histories; password hashes and external-provider identities remain unchanged. Deploy migrations with the application upgrade.
- CI's floating Python 3.x selected 3.15, which the locked psycopg binary does not support. Pinned Python 3.12 and provisioned PostgreSQL before the new migration regression. No database architecture change is included here.
- Local application tests: 225 passed across 62 files. Typecheck and production/full dependency audits pass. CI for the isolated branch is the remaining merge gate; the source branch's broader validation results do not establish this branch's CI status.
- Joern's first Linux CI job passed on PR #44. Its originating chat is "Investigate missing Dependabot PRs" (`01a13ca3-4694-7c31-9e87-e2e14a6bcd2e`); its rule and CI changes were made on October 15.

<!-- continuity:fingerprint=327ecf5abf4b15c8d7507401e047d857bc073b95464288446f2fbf696325d2fc -->

## Current Snapshot

- Updated: 2026-10-28 (Europe/Berlin)
- Branch: `codex/security-maintenance-20261028`

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
