#!/bin/bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-jayoc@192.168.1.100}"
REMOTE_DIR="${REMOTE_DIR:-/Users/jayoc/aidev1/topstar_eng}"

ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && chmod +x scripts/*.sh >/dev/null 2>&1 || true; ./scripts/status-launchd.sh"
