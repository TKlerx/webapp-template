#!/usr/bin/env sh
set -eu

CONTINUE_FILE="CONTINUE.md"
CONTINUE_LOG_FILE="CONTINUE_LOG.md"

if [ ! -f "$CONTINUE_FILE" ]; then
  echo "Missing $CONTINUE_FILE. Create it before committing." >&2
  exit 1
fi

if [ ! -f "$CONTINUE_LOG_FILE" ]; then
  echo "Missing $CONTINUE_LOG_FILE. Create it before committing." >&2
  exit 1
fi

STAGED_FILES="$(git diff --cached --name-only --diff-filter=ACMR)"

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

NON_CONTINUITY_STAGED="$(printf '%s\n' "$STAGED_FILES" | grep -v -E '^(CONTINUE\.md|CONTINUE_LOG\.md)$' || true)"

if [ -z "$NON_CONTINUITY_STAGED" ]; then
  exit 0
fi

if ! printf '%s\n' "$STAGED_FILES" | grep -qx "$CONTINUE_FILE"; then
  echo "$CONTINUE_FILE must be staged when other changes are committed." >&2
  exit 1
fi

if ! printf '%s\n' "$STAGED_FILES" | grep -qx "$CONTINUE_LOG_FILE"; then
  echo "$CONTINUE_LOG_FILE must be staged when other changes are committed." >&2
  exit 1
fi
