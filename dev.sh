#!/usr/bin/env bash
# Start the BOINC client and the Tauri manager together for development.
# Usage: bash dev.sh
#
# The script:
#   1. Starts boinc.exe (if not already running) pointed at the system data dir
#   2. Waits for the RPC port (31416) to become available
#   3. Launches "pnpm tauri dev"
#   4. On exit (Ctrl-C), stops the BOINC client it started

set -euo pipefail

BOINC_EXE="/c/Program Files/BOINC/boinc.exe"
BOINC_DATA="C:\\ProgramData\\BOINC"
BOINC_PORT=31416
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Ensure cargo is in PATH
export PATH="$HOME/.cargo/bin:$PATH"

BOINC_PID=""

cleanup() {
  echo ""
  echo "Shutting down..."
  if [ -n "$BOINC_PID" ]; then
    echo "Stopping BOINC client (PID $BOINC_PID)..."
    kill "$BOINC_PID" 2>/dev/null || true
    wait "$BOINC_PID" 2>/dev/null || true
  fi
  echo "Done."
}

trap cleanup EXIT

# --- Start BOINC client if not running ---
if tasklist //FI "IMAGENAME eq boinc.exe" 2>/dev/null | grep -q "boinc.exe"; then
  echo "BOINC client is already running, skipping startup."
else
  echo "Starting BOINC client..."
  "$BOINC_EXE" --dir "$BOINC_DATA" --redirectio --daemon &
  BOINC_PID=$!
  echo "BOINC client started (PID $BOINC_PID)"

  # Wait for RPC port to be ready (up to 15 seconds)
  echo -n "Waiting for RPC port $BOINC_PORT"
  for i in $(seq 1 30); do
    if bash -c "echo >/dev/tcp/127.0.0.1/$BOINC_PORT" 2>/dev/null; then
      echo " ready!"
      break
    fi
    echo -n "."
    sleep 0.5
  done
fi

# --- Start the Tauri manager ---
echo "Starting Tauri manager..."
cd "$SCRIPT_DIR"
pnpm tauri dev
