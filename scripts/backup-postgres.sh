#!/usr/bin/env sh
set -eu
umask 077

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-webapp-template}"
export COMPOSE_PROJECT_NAME
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
BACKUP_KEEP_COUNT="${BACKUP_KEEP_COUNT:-5}"
KEEP_DAYS="${KEEP_DAYS:-90}"
BACKUP_NAME_PREFIX="${BACKUP_NAME_PREFIX:-business-app-starter}"

timestamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
backup_base="${BACKUP_DIR}/${BACKUP_NAME_PREFIX}-${timestamp}"

step() {
  printf '\n=== %s ===\n' "$1"
}

step "Prepare backup directory"
mkdir -p "$BACKUP_DIR"
temp_dir="$(mktemp -d "${BACKUP_DIR}/.postgres-backup.XXXXXXXX")"
trap 'rm -rf -- "$temp_dir"' EXIT
trap 'exit 1' HUP INT TERM
temp_file="$temp_dir/archive"

step "Create PostgreSQL dump"
node ./scripts/docker-compose.mjs --allow-missing-env -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
  sh -c 'exec pg_dump -U "${1:-$POSTGRES_USER}" -d "${2:-$POSTGRES_DB}" -F c' \
  sh "${POSTGRES_USER:-}" "${POSTGRES_DB:-}" > "$temp_file"

step "Verify backup archive"
if [ ! -s "$temp_file" ]; then
  printf 'Backup archive is empty.\n' >&2
  exit 1
fi

node ./scripts/docker-compose.mjs --allow-missing-env -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
  pg_restore -l < "$temp_file" > "$temp_dir/entries"
archive_entries="$(wc -l < "$temp_dir/entries" | tr -d ' ')"
table_data_entries="$(grep -c 'TABLE DATA' "$temp_dir/entries" || true)"

printf 'Archive entries: %s\n' "$archive_entries"
printf 'Table data entries: %s\n' "$table_data_entries"

if [ "${archive_entries:-0}" -eq 0 ] || [ "${table_data_entries:-0}" -eq 0 ]; then
  printf 'Backup archive contains no restorable table data entries.\n' >&2
  exit 1
fi

backup_file="$backup_base.dump"
suffix=0
while ! ln -T -- "$temp_file" "$backup_file" 2>"$temp_dir/publish-error"; do
  if [ ! -e "$backup_file" ] && [ ! -L "$backup_file" ]; then
    cat "$temp_dir/publish-error" >&2
    exit 1
  fi
  suffix=$((suffix + 1))
  backup_file="$backup_base-$suffix.dump"
done

if [ "${BACKUP_PRUNE:-true}" = "true" ]; then
  step "Prune old dumps by age"
  for archive in "$BACKUP_DIR"/"$BACKUP_NAME_PREFIX"-*.dump; do
    [ -f "$archive" ] && [ "$archive" != "$backup_file" ] || continue
    find "$archive" -type f -mtime +"$KEEP_DAYS" -print -delete
  done

  step "Prune old dumps by count"
  if [ "$BACKUP_KEEP_COUNT" -gt 0 ]; then
    retained=1
    ls -1td "$BACKUP_DIR"/"$BACKUP_NAME_PREFIX"-*.dump 2>/dev/null \
      | while IFS= read -r old_backup; do
          [ -f "$old_backup" ] && [ "$old_backup" != "$backup_file" ] || continue
          if [ "$retained" -lt "$BACKUP_KEEP_COUNT" ]; then
            retained=$((retained + 1))
          else
            printf 'Removing old backup: %s\n' "$old_backup"
            rm -f -- "$old_backup"
          fi
        done
  fi
fi

step "Backup completed"
ls -lh "$backup_file"
