#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

step() {
  printf '\n=== %s ===\n' "$1"
}

step "Build shared app image"
docker compose -f "$COMPOSE_FILE" build app

step "Start PostgreSQL"
docker compose -f "$COMPOSE_FILE" up -d postgres

step "Prisma pre-deploy verification"
docker compose -f "$COMPOSE_FILE" run --rm --entrypoint sh migrate -lc "node scripts/prisma-predeploy-check.js"

step "Prisma migrate deploy"
docker compose -f "$COMPOSE_FILE" run --rm --entrypoint sh migrate -lc "npx prisma migrate deploy --config prisma.config.postgres.ts"

step "Start app from shared image"
docker compose -f "$COMPOSE_FILE" up -d app

printf '\nDeploy completed successfully.\n'
