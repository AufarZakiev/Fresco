#!/bin/bash
set -e

# Kill any running Fresco instances so the copy succeeds
# and so single_instance doesn't redirect to the old process
taskkill.exe //F //IM Fresco-dev.exe 2>/dev/null || true
sleep 1

# Clear WebView2 cache so the new JS bundle is used
WEBVIEW_DIR="$LOCALAPPDATA/com.github.aufarzakiev.fresco/EBWebView/Default"
rm -rf "$WEBVIEW_DIR/Cache" "$WEBVIEW_DIR/Code Cache" "$WEBVIEW_DIR/Service Worker" 2>/dev/null || true

# Build with an ancient timestamp so the app always sees an update available
export FRESCO_BUILD_TIME="2000-01-01T00:00:00Z"

echo "Building dev release (build_time=$FRESCO_BUILD_TIME)..."
pnpm tauri build

# Copy to Downloads
DEST="$HOME/Downloads/Fresco-dev.exe"
rm -f "$HOME/Downloads/Fresco-dev.update" "$HOME/Downloads/Fresco-dev.old"
cp src-tauri/target/release/Fresco.exe "$DEST"
echo "Copied to $DEST"
