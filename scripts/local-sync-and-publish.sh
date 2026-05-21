#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
STATE_DIR="${REPO_DIR}/.state"
LOG_DIR="${REPO_DIR}/.logs"
LOCK_DIR="${STATE_DIR}/local-sync.lock"

mkdir -p "${STATE_DIR}" "${LOG_DIR}"
exec >> "${LOG_DIR}/local-sync.log" 2>&1

echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] local sync started"

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  echo "local sync already running; exiting"
  exit 0
fi

cleanup() {
  rmdir "${LOCK_DIR}" 2>/dev/null || true
}
trap cleanup EXIT

cd "${REPO_DIR}"

if [ ! -f ".env" ]; then
  echo ".env is missing; cannot collect Naver Cafe homework"
  exit 1
fi

if [ ! -s ".state/naver-storage-state.json" ]; then
  echo ".state/naver-storage-state.json is missing; run npm run login before unattended sync"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  npm ci
fi

git config user.name >/dev/null 2>&1 || git config user.name "topstar-local-sync"
git config user.email >/dev/null 2>&1 || git config user.email "topstar-local-sync@users.noreply.github.com"

git fetch origin main
git pull --ff-only origin main

npm run sync -- --scheduled

if git diff --quiet -- docs; then
  echo "no docs changes to publish"
  exit 0
fi

if ! node scripts/should-publish-docs.js; then
  echo "discarding docs changes that do not affect published homework content"
  git restore -- docs
  exit 0
fi

npm run validate

git add docs
git commit -m "Update homework data [local-sync]"
git push origin main

echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] local sync published"
