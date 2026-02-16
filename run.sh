#!/usr/bin/env bash
# Launches the BOINC client (if not already running) and then the new Tauri manager.
# When the manager window is closed, the BOINC client is stopped too
# (only if this script started it).
#
# Usage: bash run.sh

set -e

BOINC_EXE="/c/Program Files/BOINC/boinc.exe"
BOINC_DATA="C:\\ProgramData\\BOINC"
BOINC_PORT=31416
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WE_STARTED_BOINC=false

# Check if BOINC client is already listening on its RPC port
is_boinc_running() {
    (echo > /dev/tcp/127.0.0.1/$BOINC_PORT) 2>/dev/null
}

cleanup() {
    if $WE_STARTED_BOINC; then
        echo ""
        echo "[..] Stopping BOINC client (PID $BOINC_PID)..."
        taskkill //PID "$BOINC_PID" //F >/dev/null 2>&1 || true
        echo "[ok] BOINC client stopped"
    fi
}

trap cleanup EXIT

echo "=== BOINC Manager (Tauri) launcher ==="

# 1. Start BOINC client if needed
if is_boinc_running; then
    echo "[ok] BOINC client already running on port $BOINC_PORT"
else
    echo "[..] Starting BOINC client..."
    "$BOINC_EXE" --dir "$BOINC_DATA" --redirectio --detach_console &
    BOINC_PID=$!
    WE_STARTED_BOINC=true
    echo "     PID: $BOINC_PID"

    # Wait for RPC port to become available (up to 15 seconds)
    for i in $(seq 1 15); do
        if is_boinc_running; then
            echo "[ok] BOINC client ready (took ${i}s)"
            break
        fi
        sleep 1
    done

    if ! is_boinc_running; then
        echo "[!!] BOINC client did not start in time. Check $BOINC_DATA/stderrdae.txt"
        exit 1
    fi
fi

# 2. Launch the Tauri manager (no exec — so the trap fires on exit)
echo "[..] Starting Tauri manager..."
export PATH="$HOME/.cargo/bin:$PATH"
cd "$SCRIPT_DIR"
pnpm tauri dev || true
