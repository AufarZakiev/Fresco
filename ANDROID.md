# Android Build Feasibility

## Summary

Fresco can be built for Android as a **remote-only manager** using Tauri v2's mobile support. The app would connect to BOINC clients running on other machines over the network. Local computation on the phone is not possible.

## What works out of the box

- **Entire RPC layer** — Tokio TCP sockets work on Android, so all ~50 BOINC RPC commands work unchanged
- **Vue frontend** — runs in Android's WebView
- **tauri-plugin-notification** — has Android support
- **tauri-plugin-opener** — has Android support
- Mobile entry point is already declared (`#[cfg_attr(mobile, tauri::mobile_entry_point)]` in lib.rs)
- Android icon resources already exist in `src-tauri/icons/android/`

## What needs `#[cfg(not(mobile))]` guards

| Feature | Reason |
|---------|--------|
| `tray::setup_tray()` | No system tray on Android |
| `tauri_plugin_cli` | No CLI args on mobile |
| `tauri_plugin_single_instance` | Android handles this natively |
| `on_window_event` (hide on close) | Android has its own lifecycle |
| `start_boinc_client` | Can't launch local BOINC (see below) |
| `launch_graphics` / `launch_remote_desktop` | Uses `std::process::Command`, unavailable on Android |
| `window.hide/show/unminimize` | Desktop window management concepts |

## Frontend changes needed

- `defaultDataDir()` in `App.vue` — skip auto-connect on Android, go straight to remote connection dialog
- Hide desktop-only UI (Start BOINC, graphics launcher, remote desktop buttons)
- Responsive CSS for mobile screens (dialogs, sidebar, etc.)

## Why local BOINC connection is not possible

The official BOINC Android app **does not** listen on TCP port 31416 like the desktop client. It uses two different mechanisms:

1. **Unix Domain Socket** (default): The BOINC client is started with `--gui_rpc_unix_domain` and communicates via an abstract Linux socket named `edu_berkeley_boinc_client_socket`. This is Android's `LocalSocket` API, not TCP. Fresco's Rust RPC layer uses `TcpStream` and cannot connect to these.

2. **Remote TCP mode**: Only available when BOINC is started with `--allow_remote_gui_rpc`, which the Android app does not do by default.

Additional blockers:

- **App sandboxing**: Each Android app has a private data directory. Fresco cannot read BOINC's `gui_rpc_auth.cfg` or access its Unix socket due to Android's permission model.
- **Private binaries**: The BOINC client binary is extracted from the BOINC APK's assets into its private directory (`applicationInfo.dataDir + "/client/boinc"`). Fresco cannot execute another app's private files.

## What Fresco on Android would NOT have (vs native BOINC Android app)

- No embedded BOINC client — no local computation
- No boot receiver — can't auto-start on phone boot
- No foreground service — can't keep computations running in background
- No battery/power-aware scheduling

## Intended use case

You're away from your PC. You open Fresco on your phone, connect to your home BOINC client over the network, check tasks and statistics, adjust preferences. The RPC protocol already supports remote connections — this is what `SelectComputerDialog` does on desktop.

## Reference: How the native BOINC Android app works

The official BOINC app (`android/BOINC/`) is a full Kotlin/Android app that:

- Bundles the BOINC client as a native binary (compiled for armv6, arm, arm64, x86, x86_64)
- Runs it via `Runtime.getRuntime().exec()` as a background process
- Connects via `LocalSocket` (Unix Domain Socket) for IPC
- Includes a `Monitor` service (separate `:remote` process) that manages the client lifecycle
- Has `BootReceiver` for auto-start, `PowerConnectedReceiver` for battery awareness
- Provides project attach, preferences, tasks, notices, and status UI
