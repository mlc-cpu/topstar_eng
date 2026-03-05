#!/bin/bash
set -euo pipefail

SYNC_LABEL="${SYNC_LABEL:-com.jayoc.topstar_eng.sync}"
SERVER_LABEL="${SERVER_LABEL:-com.jayoc.topstar_eng.server}"
LAUNCH_DIR="$HOME/Library/LaunchAgents"

SYNC_PLIST="$LAUNCH_DIR/${SYNC_LABEL}.plist"
SERVER_PLIST="$LAUNCH_DIR/${SERVER_LABEL}.plist"

launchctl unload "$SYNC_PLIST" >/dev/null 2>&1 || true
launchctl unload "$SERVER_PLIST" >/dev/null 2>&1 || true

echo "Stopped launchd jobs (if loaded):"
echo "- $SYNC_LABEL"
echo "- $SERVER_LABEL"
