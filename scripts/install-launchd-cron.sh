#!/bin/bash
# Installs both daily cron jobs (exam-plans, procrastination-nudge) as
# per-user launchd agents, scheduled for 8am. See scripts/uninstall-launchd-cron.sh
# to remove them, and README.md's "Local scheduling" section for details.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_DIR="$SCRIPT_DIR/launchd"
DEST_DIR="$HOME/Library/LaunchAgents"
UID_NUM=$(id -u)

mkdir -p "$DEST_DIR"

for plist in "$PLIST_DIR"/com.dashboard-app.cron.*.plist; do
  label=$(basename "$plist" .plist)
  dest="$DEST_DIR/$label.plist"

  cp "$plist" "$dest"

  launchctl bootout "gui/$UID_NUM/$label" 2>/dev/null || true
  launchctl bootstrap "gui/$UID_NUM" "$dest"

  echo "Installed and loaded: $label"
done

echo
echo "Check status with: launchctl list | grep dashboard-app"
echo "Logs land in: $HOME/Library/Logs/dashboard-app-cron/"
