#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCH_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$PROJECT_DIR/.logs"

SYNC_LABEL="${SYNC_LABEL:-com.jayoc.engband.sync}"
SERVER_LABEL="${SERVER_LABEL:-com.jayoc.engband.server}"
SYNC_INTERVAL_SECONDS="${SYNC_INTERVAL_SECONDS:-1800}"
PORT="${PORT:-4173}"

SYNC_PLIST="$LAUNCH_DIR/${SYNC_LABEL}.plist"
SERVER_PLIST="$LAUNCH_DIR/${SERVER_LABEL}.plist"

mkdir -p "$LAUNCH_DIR" "$LOG_DIR"

cat > "$SYNC_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${SYNC_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>-lc</string>
      <string>export PATH='/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'; cd '${PROJECT_DIR}' &amp;&amp; npm run sync</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StartInterval</key>
    <integer>${SYNC_INTERVAL_SECONDS}</integer>
    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/sync.out.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/sync.err.log</string>
  </dict>
</plist>
PLIST

cat > "$SERVER_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${SERVER_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>-lc</string>
      <string>export PATH='/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'; cd '${PROJECT_DIR}' &amp;&amp; PORT='${PORT}' node src/server.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/server.out.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/server.err.log</string>
  </dict>
</plist>
PLIST

launchctl unload "$SYNC_PLIST" >/dev/null 2>&1 || true
launchctl unload "$SERVER_PLIST" >/dev/null 2>&1 || true

launchctl load -w "$SYNC_PLIST"
launchctl load -w "$SERVER_PLIST"

echo "Installed launchd jobs:"
echo "- $SYNC_LABEL (every ${SYNC_INTERVAL_SECONDS}s)"
echo "- $SERVER_LABEL (always on, port ${PORT})"
