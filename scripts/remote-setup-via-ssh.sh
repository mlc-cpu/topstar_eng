#!/bin/bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-jayoc@192.168.1.100}"
REMOTE_DIR="${REMOTE_DIR:-/Users/jayoc/aidev1/topstar_eng}"
SYNC_INTERVAL_SECONDS="${SYNC_INTERVAL_SECONDS:-3600}"
PORT="${PORT:-4173}"

ssh "$REMOTE_HOST" "export PATH='/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'; cd '$REMOTE_DIR' && npm ci && npx playwright install chromium && chmod +x scripts/*.sh && SYNC_INTERVAL_SECONDS='$SYNC_INTERVAL_SECONDS' PORT='$PORT' ./scripts/install-launchd.sh"

echo
echo "Remote setup complete on $REMOTE_HOST"
echo "Open http://192.168.1.100:${PORT} from your tablet"
