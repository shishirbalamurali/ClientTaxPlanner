#!/usr/bin/env bash
# Captures the README screenshots from a running production build.
#
#   npm run build
#   npx next start -p 3100 &
#   ./scripts/capture-screenshots.sh
#
# Requires Google Chrome. Override the binary with CHROME_BIN if it lives
# elsewhere, and the origin with BASE_URL.
set -euo pipefail

CHROME_BIN="${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
BASE_URL="${BASE_URL:-http://localhost:3100}"
CLIENT="${CLIENT:-whitfield-2025}"
OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/docs/screenshots"

if [[ ! -x "$CHROME_BIN" ]]; then
  echo "Chrome not found at $CHROME_BIN. Set CHROME_BIN." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

# Chrome occasionally declines to exit after writing the file, so each run gets
# its own profile and a hard kill after 45 seconds.
shot() {
  local slug="$1" name="$2" height="$3" client="${4:-$CLIENT}" hash="${5:-}"
  local profile pid
  profile="$(mktemp -d)"

  "$CHROME_BIN" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --no-first-run --no-default-browser-check --disable-extensions \
    --disable-background-networking --disable-sync \
    --user-data-dir="$profile" --virtual-time-budget=6000 \
    --window-size="1600,${height}" \
    --screenshot="${OUT_DIR}/${name}.png" \
    "${BASE_URL}/clients/${client}/${slug}${hash}" >/dev/null 2>&1 &
  pid=$!

  ( sleep 45; kill -9 "$pid" 2>/dev/null ) &
  local watchdog=$!
  wait "$pid" 2>/dev/null || true
  kill "$watchdog" 2>/dev/null || true

  rm -rf "$profile"
  if [[ -f "${OUT_DIR}/${name}.png" ]]; then
    echo "  ${name}.png"
  else
    echo "  ${name}.png FAILED" >&2
  fi
}

echo "Capturing to ${OUT_DIR}"
shot dashboard        01-dashboard         1500
shot profile          02-client-profile    2000
shot individual-tax   03-individual-tax    2100
shot wealth-transfer  04-wealth-transfer   1600
shot trusts           05-trusts            1700 oyelaran-2025
shot foreign-accounts 06-foreign-accounts  1800 lindqvist-2025
shot scenarios        07-scenario-analysis 2000
shot research         08-research-library  1800
shot summary          09-executive-summary 2000
shot dashboard        10-flag-trace         2500 lindqvist-2025 '#finding-FBAR-AGGREGATE'

# The workspace lives outside /clients/<id>/, so it needs its own capture.
profile="$(mktemp -d)"
"$CHROME_BIN" --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --no-first-run --no-default-browser-check --disable-extensions \
  --user-data-dir="$profile" --virtual-time-budget=6000 --window-size=1600,1500 \
  --screenshot="${OUT_DIR}/11-load-record.png" "${BASE_URL}/load" >/dev/null 2>&1 || true
rm -rf "$profile"
echo "  11-load-record.png"
