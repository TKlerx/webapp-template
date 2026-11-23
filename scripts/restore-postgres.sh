#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-webapp-template}"
export COMPOSE_PROJECT_NAME
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
BACKUP_FILE="${BACKUP_FILE:-${1:-}}"
RESTORE_CONFIRM="${RESTORE_CONFIRM:-}"
SKIP_PRE_RESTORE_BACKUP="${SKIP_PRE_RESTORE_BACKUP:-false}"
RESTORE_RESTART_SERVICES="${RESTORE_RESTART_SERVICES:-true}"

step() {
  printf '\n=== %s ===\n' "$1"
}

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

if [ -z "$BACKUP_FILE" ]; then
  fail "Usage: BACKUP_FILE=./backups/postgres/business-app-starter-<timestamp>.dump sh ./scripts/restore-postgres.sh"
fi

if [ ! -f "$BACKUP_FILE" ]; then
  fail "Backup file not found: $BACKUP_FILE"
fi

if [ ! -s "$BACKUP_FILE" ]; then
  fail "Backup file is empty: $BACKUP_FILE"
fi

step "Restore target"
printf 'COMPOSE_PROJECT_NAME=%s\n' "$COMPOSE_PROJECT_NAME"
printf 'POSTGRES_SERVICE=%s\n' "$POSTGRES_SERVICE"
printf 'POSTGRES_DB=%s\n' "${POSTGRES_DB:-from container environment}"
printf 'POSTGRES_USER=%s\n' "${POSTGRES_USER:-from container environment}"
printf 'BACKUP_FILE=%s\n' "$BACKUP_FILE"

step "Verify backup archive"
entries="$(node ./scripts/docker-compose.mjs --allow-missing-env -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
  pg_restore -l < "$BACKUP_FILE")"
archive_entries="$(printf '%s\n' "$entries" | grep -c . || true)"
table_data_entries="$(printf '%s\n' "$entries" | grep -c 'TABLE DATA' || true)"

printf 'Archive entries: %s\n' "$archive_entries"
printf 'Table data entries: %s\n' "$table_data_entries"

if [ "${archive_entries:-0}" -eq 0 ] || [ "${table_data_entries:-0}" -eq 0 ]; then
  fail "Backup archive contains no restorable table data entries: $BACKUP_FILE"
fi

if [ "$RESTORE_CONFIRM" != "restore" ]; then
  printf '\nThis will overwrite database "%s" in Compose project "%s".\n' "${POSTGRES_DB:-configured in the container}" "$COMPOSE_PROJECT_NAME"
  printf 'Set RESTORE_CONFIRM=restore to confirm this destructive restore.\n'
  exit 1
fi

exec 3< "$BACKUP_FILE"

if [ "$SKIP_PRE_RESTORE_BACKUP" != "true" ]; then
  step "Create safety backup before restore"
  BACKUP_PRUNE=false sh ./scripts/backup-postgres.sh
else
  step "Skip pre-restore safety backup"
fi

step "Stop runtime services"
node ./scripts/docker-compose.mjs --allow-missing-env -f "$COMPOSE_FILE" stop app worker

step "Restore PostgreSQL dump"
node ./scripts/docker-compose.mjs --allow-missing-env -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
  sh -c 'exec pg_restore --single-transaction --clean --if-exists --no-owner -U "${1:-$POSTGRES_USER}" -d "${2:-$POSTGRES_DB}"' \
  sh "${POSTGRES_USER:-}" "${POSTGRES_DB:-}" <&3
exec 3<&-

step "Prisma pre-deploy verification"
node ./scripts/docker-compose.mjs --allow-missing-env -f "$COMPOSE_FILE" run --rm --entrypoint sh migrate -lc "node scripts/prisma-predeploy-check.js"

step "Prisma migrate deploy"
node ./scripts/docker-compose.mjs --allow-missing-env -f "$COMPOSE_FILE" run --rm --entrypoint ./node_modules/.bin/prisma migrate migrate deploy --config prisma.config.ts

step "Seed initial admin if needed"
node ./scripts/docker-compose.mjs --allow-missing-env -f "$COMPOSE_FILE" run --rm --entrypoint sh migrate -lc "node scripts/seed-initial-admin.mjs"

if [ "$RESTORE_RESTART_SERVICES" = "true" ]; then
  step "Restart app + worker"
  node ./scripts/docker-compose.mjs --allow-missing-env -f "$COMPOSE_FILE" up -d app worker
fi

printf '\nRestore completed successfully.\n'
