#!/bin/bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-jayoc@192.168.1.100}"
REMOTE_DIR="${REMOTE_DIR:-/Users/jayoc/aidev1/topstar_eng}"

ssh "$REMOTE_HOST" "export PATH='/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'; cd '$REMOTE_DIR' && npm run sync"
