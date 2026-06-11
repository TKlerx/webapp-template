# Continue

<!-- continuity:fingerprint=c60c207709f1635bb984a3f99c674da37d6907d780c2b1e2321a129e907e6d15 -->

## Current Snapshot

- Updated: 2026-06-11 14:46:32
- Branch: `main`

## Recent Non-Continuity Commits

- 6c81729 feat: add azure deployment smoke verification (#3)
- 3d52264 fix: move state queue logging to dedicated resource
- 25306fd chore: refresh specs overview
- dd226de test: update opentofu action pin assertion
- 9b92cb5 ci: update opentofu setup action

## Git Status

- M .env.docker.example
- M .env.example
- M .github/workflows/deploy-azure.yml
- M Dockerfile.app
- M Dockerfile.worker
- M README.md
- M docker-compose.yml
- M infra/azure/main.tf
- M infra/azure/modules/runtime/app.tf
- M infra/azure/modules/runtime/job.tf
- M infra/azure/modules/runtime/variables.tf
- M infra/azure/modules/runtime/worker.tf
- M infra/azure/variables.tf
- M specs/018-opentofu-azure-infra/quickstart.md
- M src/components/ui/AppVersionBadge.tsx
- M src/lib/app-version.ts
- M tests/unit/security/deploy-workflow.test.ts
- ?? src/app/api/version/
- ?? tests/unit/app-version.test.ts
- ?? tests/unit/version-route.test.ts

## Active Specs

- None

## Next Recommended Actions

1. Review, commit, and push the runtime build metadata changes.
2. Optionally open a PR and confirm GitHub Actions validation.
3. Use `APP_ENVIRONMENT`, `APP_VERSION`, `APP_REVISION`, `APP_BUILD_ID`, and `APP_BUILT_AT` for dev/staging traceability instead of generated version files.
