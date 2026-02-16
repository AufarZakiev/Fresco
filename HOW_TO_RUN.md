# How to Run Fresco

## Prerequisites

1. **Node.js** >= 20
2. **pnpm** — install via `npm install -g pnpm`
3. **Rust** — install via [rustup](https://rustup.rs/): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
4. **BOINC client** — either build from source or install the [official BOINC release](https://boinc.berkeley.edu/download.php)

On Windows you also need the [WebView2 runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (comes preinstalled on Windows 11).

## Step 1: Start the BOINC Client (without the old manager)

The BOINC client (`boinc` / `boinc_client`) is the background daemon. The old wxWidgets manager (`boincmgr`) is a separate executable. You only need the client running.

### Windows

If BOINC is installed in the default location:

```bash
# Run the client directly (no old manager)
"C:\Program Files\BOINC\boinc.exe"
```

Or if it's running as a Windows service (default installation), it's already running — you don't need to start it manually. Check with:

```bash
sc query "BOINC"
```

The client stores its data (including `gui_rpc_auth.cfg`) in:
```
C:\ProgramData\BOINC
```

### Linux

```bash
# If installed from packages:
sudo systemctl start boinc-client

# Or run directly:
boinc --dir /var/lib/boinc-client
```

### macOS

```bash
# If installed from the official .dmg:
/Library/Application\ Support/BOINC\ Data/boinc_client

# Or via Homebrew:
brew services start boinc-client
```

## Step 2: Run the New UI in Development Mode

```bash
cd manager/

# Install dependencies (first time only)
pnpm install

# Start the Tauri dev server (hot reload for Vue + Rust)
pnpm tauri dev
```

This opens the new manager window. It will:
1. Show a connection screen where you enter the BOINC data directory path
2. Read `gui_rpc_auth.cfg` from that directory for authentication
3. Connect to the BOINC client on `localhost:31416`
4. Display active tasks

### Default data directory paths

| Platform | Default path |
|----------|-------------|
| Windows  | `C:\ProgramData\BOINC` |
| Linux    | `/var/lib/boinc-client` |
| macOS    | `/Library/Application Support/BOINC Data` |

## Step 3: Run Tests

```bash
# Frontend (Vue) tests — Vitest
pnpm test

# Rust tests
cd src-tauri && cargo test

# Lint
pnpm lint
```

## Notes

- The new UI and old manager (`boincmgr`) can run simultaneously — the BOINC client supports multiple GUI RPC connections
- You do NOT need to stop the old manager to use the new one
- If you only want the client running without any GUI, just start the `boinc` / `boinc_client` executable directly
- The client listens on TCP port 31416 by default (configurable via `--gui_rpc_port`)

## Building for Production

```bash
cd manager/
pnpm tauri build
```

The built executable will be in `src-tauri/target/release/`.
