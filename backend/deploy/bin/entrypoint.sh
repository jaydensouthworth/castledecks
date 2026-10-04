#!/bin/sh
set -eu
# No tracing: credential values must never enter logs.
if [ "${ENABLE_ACCOUNTS:-false}" != true ]; then
  echo 'accounts disabled: explicit ENABLE_ACCOUNTS=true required' >&2
  exit 78
fi
[ -n "${PUBLIC_ORIGIN:-}" ] || { echo 'PUBLIC_ORIGIN required' >&2; exit 78; }
[ "${ENABLE_PRIVATE_ROOMS:-false}" = false ] || { echo 'private rooms are outside this deployment package' >&2; exit 78; }
[ -n "${DELETION_JOURNAL_PATH:-}" ] && [ -f "$DELETION_JOURNAL_PATH" ] && [ -n "${RECOVERY_POLICY_FILE:-}" ] && [ -r "$RECOVERY_POLICY_FILE" ] || { echo 'existing deletion journal and explicit recovery policy required' >&2; exit 78; }
if [ -n "${GOOGLE_CLIENT_ID:-}" ] || [ -n "${GOOGLE_CLIENT_SECRET:-}" ]; then
  echo 'use mounted credential files, not direct credential environment values' >&2; exit 78
fi
[ -n "${GOOGLE_CLIENT_ID_FILE:-}" ] && [ -n "${GOOGLE_CLIENT_SECRET_FILE:-}" ] || { echo 'both credential file paths required' >&2; exit 78; }
[ -f "$GOOGLE_CLIENT_ID_FILE" ] && [ -r "$GOOGLE_CLIENT_ID_FILE" ] && [ -f "$GOOGLE_CLIENT_SECRET_FILE" ] && [ -r "$GOOGLE_CLIENT_SECRET_FILE" ] || { echo 'credential files unavailable' >&2; exit 78; }
GOOGLE_CLIENT_ID=$(cat "$GOOGLE_CLIENT_ID_FILE")
GOOGLE_CLIENT_SECRET=$(cat "$GOOGLE_CLIENT_SECRET_FILE")
[ -n "$GOOGLE_CLIENT_ID" ] && [ -n "$GOOGLE_CLIENT_SECRET" ] || { echo 'credential files empty' >&2; exit 78; }
export GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET
exec /app/server
