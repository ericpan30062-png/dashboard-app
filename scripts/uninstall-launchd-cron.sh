#!/bin/bash
# Reverses scripts/install-launchd-cron.sh: unloads and removes both agents.
set -euo pipefail

DEST_DIR="$HOME/Library/LaunchAgents"
UID_NUM=$(id -u)

for label in com.dashboard-app.cron.exam-plans com.dashboard-app.cron.procrastination-nudge; do
  launchctl bootout "gui/$UID_NUM/$label" 2>/dev/null || true
  rm -f "$DEST_DIR/$label.plist"
  echo "Removed: $label"
done
