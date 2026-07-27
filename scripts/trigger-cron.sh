#!/bin/bash
# Hits one of this app's GET /api/cron/<job> endpoints against the local dev
# server, using the CRON_SECRET from .env. Invoked by the launchd jobs in
# scripts/launchd/ (see README's "Local scheduling" section) — only fires
# whatever the dev server happens to be doing at the time, so it's a no-op
# (logged, not an error) if `npm run dev` isn't running.
set -euo pipefail

JOB="$1"
PROJECT_DIR="/Users/ericpan/Agent2"
ENV_FILE="$PROJECT_DIR/.env"
LOG_DIR="$HOME/Library/Logs/dashboard-app-cron"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$JOB.log"

CRON_SECRET=$(grep -E '^CRON_SECRET=' "$ENV_FILE" | head -1 | cut -d '=' -f2-)

if [ -z "$CRON_SECRET" ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] CRON_SECRET not set in $ENV_FILE — skipping $JOB" >> "$LOG_FILE"
  exit 0
fi

RESPONSE=$(curl -s -w '\n%{http_code}' --max-time 300 \
  -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/$JOB" 2>&1) || RESPONSE="curl failed: $RESPONSE"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $JOB -> $RESPONSE" >> "$LOG_FILE"
