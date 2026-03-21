#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

step() {
  printf '\n=== %s ===\n' "$1"
}

step "Build migrate image"
docker compose -f "$COMPOSE_FILE" build migrate

step "Prisma pre-deploy verification"
docker compose -f "$COMPOSE_FILE" run --rm --entrypoint sh migrate -lc "node scripts/prisma-predeploy-check.js"

step "Prisma migrate deploy"
docker compose -f "$COMPOSE_FILE" run --rm --entrypoint sh migrate -lc "npx prisma migrate deploy"

step "Rebuild and restart app"
docker compose -f "$COMPOSE_FILE" up -d --build app

printf '\nDeploy completed successfully.\n'
