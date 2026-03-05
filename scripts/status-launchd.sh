#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$PROJECT_DIR/.logs"
SYNC_LABEL="${SYNC_LABEL:-com.jayoc.topstar_eng.sync}"
SERVER_LABEL="${SERVER_LABEL:-com.jayoc.topstar_eng.server}"

echo "launchctl status (filtered):"
launchctl list | egrep "${SYNC_LABEL}|${SERVER_LABEL}" || true

echo
echo "Recent logs:"
for f in "$LOG_DIR"/sync.out.log "$LOG_DIR"/sync.err.log "$LOG_DIR"/server.out.log "$LOG_DIR"/server.err.log; do
  if [ -f "$f" ]; then
    echo "--- $f ---"
    tail -n 30 "$f" || true
  fi
done
