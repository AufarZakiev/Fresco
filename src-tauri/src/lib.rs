mod rpc;
mod tray;
mod updater;

use rpc::{
    AccountOut, AcctMgrInfo, AcctMgrRpcReply, CcConfig, CcState, CcStatus, ConnectionState,
    DailyXferHistory, DiskUsage, FileTransfer, GlobalPreferences, HostInfo, Message,
    NewerVersionInfo, Notice, OldResult, Project, ProjectAttachReply, ProjectConfig,
    ProjectInitStatus, ProjectListEntry, ProjectStatistics, ProxyInfo, RpcClient, TaskResult,
    VersionInfo,
};
use std::sync::Arc;
use tauri::{Manager, State};
use tauri_plugin_cli::CliExt;
use tokio::sync::Mutex;

/// Windows process creation flag: run without a visible console window.
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const BOINC_TIMEOUT_EXISTING_SECS: u64 = 300;
const BOINC_TIMEOUT_FRESH_SECS: u64 = 180;
const BOINC_RPC_ADDR: &str = "127.0.0.1:31416";
const BOINC_CONNECT_POLL_MS: u64 = 500;
const BREW_INSTALL_TIMEOUT_SECS: u64 = 900;
const BOINC_DOWNLOAD_URL: &str = "https://boinc.berkeley.edu/download.php";

pub(crate) struct AppState {
    client: Arc<Mutex<Option<RpcClient>>>,
}

#[tauri::command]
async fn connect(
    state: State<'_, AppState>,
    host: String,
    port: u16,
    password: String,
) -> Result<(), String> {
    let client = RpcClient::new(&host, port);
    client.connect(&password).await?;
    let mut guard = state.client.lock().await;
    *guard = Some(client);
    Ok(())
}

#[tauri::command]
async fn connect_local(
    state: State<'_, AppState>,
    data_dir: String,
) -> Result<(), String> {
    let password = rpc::auth::read_password_from_file(&data_dir).unwrap_or_default();
    let client = RpcClient::localhost();
    client.connect(&password).await?;
    let mut guard = state.client.lock().await;
    *guard = Some(client);
    Ok(())
}

#[tauri::command]
async fn disconnect(state: State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.client.lock().await;
    if let Some(client) = guard.take() {
        client.disconnect().await;
    }
    Ok(())
}

#[tauri::command]
async fn get_connection_state(state: State<'_, AppState>) -> Result<ConnectionState, String> {
    let guard = state.client.lock().await;
    match guard.as_ref() {
        Some(client) => Ok(client.connection_state().await),
        None => Ok(ConnectionState::Disconnected),
    }
}

#[tauri::command]
async fn get_results(
    state: State<'_, AppState>,
    active_only: bool,
) -> Result<Vec<TaskResult>, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_results(active_only).await
}

#[tauri::command]
async fn get_project_status(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_project_status().await
}

#[tauri::command]
async fn get_cc_status(state: State<'_, AppState>) -> Result<CcStatus, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_cc_status().await
}

#[tauri::command]
async fn get_transfers(state: State<'_, AppState>) -> Result<Vec<FileTransfer>, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_file_transfers().await
}

// ── Task actions ─────────────────────────────────────────────────

#[tauri::command]
async fn suspend_task(
    state: State<'_, AppState>,
    project_url: String,
    name: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.suspend_result(&project_url, &name).await
}

#[tauri::command]
async fn resume_task(
    state: State<'_, AppState>,
    project_url: String,
    name: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.resume_result(&project_url, &name).await
}

#[tauri::command]
async fn abort_task(
    state: State<'_, AppState>,
    project_url: String,
    name: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.abort_result(&project_url, &name).await
}

// ── Project actions ──────────────────────────────────────────────

#[tauri::command]
async fn suspend_project(
    state: State<'_, AppState>,
    project_url: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.project_suspend(&project_url).await
}

#[tauri::command]
async fn resume_project(
    state: State<'_, AppState>,
    project_url: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.project_resume(&project_url).await
}

#[tauri::command]
async fn update_project(
    state: State<'_, AppState>,
    project_url: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.project_update(&project_url).await
}

#[tauri::command]
async fn no_new_tasks_project(
    state: State<'_, AppState>,
    project_url: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.project_nomorework(&project_url).await
}

#[tauri::command]
async fn allow_new_tasks_project(
    state: State<'_, AppState>,
    project_url: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.project_allowmorework(&project_url).await
}

#[tauri::command]
async fn reset_project(
    state: State<'_, AppState>,
    project_url: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.project_reset(&project_url).await
}

#[tauri::command]
async fn detach_project(
    state: State<'_, AppState>,
    project_url: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.project_detach(&project_url).await
}

// ── Mode controls ────────────────────────────────────────────────

#[tauri::command]
async fn set_run_mode(
    state: State<'_, AppState>,
    mode: i32,
    duration: f64,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.set_run_mode(mode, duration).await
}

#[tauri::command]
async fn set_gpu_mode(
    state: State<'_, AppState>,
    mode: i32,
    duration: f64,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.set_gpu_mode(mode, duration).await
}

#[tauri::command]
async fn set_network_mode(
    state: State<'_, AppState>,
    mode: i32,
    duration: f64,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.set_network_mode(mode, duration).await
}

// ── Transfer actions ─────────────────────────────────────────────

#[tauri::command]
async fn retry_transfer(
    state: State<'_, AppState>,
    project_url: String,
    filename: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.retry_file_transfer(&project_url, &filename).await
}

#[tauri::command]
async fn abort_transfer(
    state: State<'_, AppState>,
    project_url: String,
    filename: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.abort_file_transfer(&project_url, &filename).await
}

// ── Other ────────────────────────────────────────────────────────

#[tauri::command]
async fn run_benchmarks(state: State<'_, AppState>) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.run_benchmarks().await
}

#[tauri::command]
async fn retry_pending_transfers(state: State<'_, AppState>) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.network_available().await
}

#[tauri::command]
async fn shutdown_client(state: State<'_, AppState>) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.quit().await
}

// ── Statistics ──────────────────────────────────────────────────

#[tauri::command]
async fn get_statistics(
    state: State<'_, AppState>,
) -> Result<Vec<ProjectStatistics>, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_statistics().await
}

// ── Messages ────────────────────────────────────────────────────

#[tauri::command]
async fn get_messages(
    state: State<'_, AppState>,
    seqno: i32,
) -> Result<Vec<Message>, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_messages(seqno).await
}

// ── Notices ─────────────────────────────────────────────────────

#[tauri::command]
async fn get_notices(
    state: State<'_, AppState>,
    seqno: i32,
) -> Result<Vec<Notice>, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_notices(seqno).await
}

// ── Disk usage ──────────────────────────────────────────────────

#[tauri::command]
async fn get_disk_usage(state: State<'_, AppState>) -> Result<DiskUsage, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_disk_usage().await
}

// ── Preferences ─────────────────────────────────────────────────

#[tauri::command]
async fn get_preferences(
    state: State<'_, AppState>,
) -> Result<GlobalPreferences, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_global_prefs_override().await
}

#[tauri::command]
async fn set_preferences(
    state: State<'_, AppState>,
    prefs: GlobalPreferences,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.set_global_prefs_override(&prefs).await
}

// ── Host info ───────────────────────────────────────────────────

#[tauri::command]
async fn get_host_info(state: State<'_, AppState>) -> Result<HostInfo, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    let mut info = client.get_host_info().await?;

    // get_host_info often lacks coproc/WSL data; fall back to get_state
    if info.coprocs.is_empty() && info.wsl_distros.is_empty() {
        if let Ok(state) = client.get_state().await {
            if !state.host_info.coprocs.is_empty() {
                info.coprocs = state.host_info.coprocs;
            }
            if !state.host_info.wsl_distros.is_empty() {
                info.wsl_distros = state.host_info.wsl_distros;
            }
        }
    }

    // Override OS info with actual local OS when connected locally,
    // since BOINC may report the wrong OS (e.g. Docker container's OS)
    if client.is_local() {
        info.os_name = std::env::consts::OS.to_string();
        info.os_name = match info.os_name.as_str() {
            "windows" => "Microsoft Windows".to_string(),
            "macos" => "macOS".to_string(),
            "linux" => "Linux".to_string(),
            other => other.to_string(),
        };
        // Get OS version from the system
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            use std::process::Command;
            if let Ok(output) = Command::new("cmd")
                .args(["/C", "ver"])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
            {
                let ver = String::from_utf8_lossy(&output.stdout);
                let ver = ver.trim();
                // Extract just the version number from "Microsoft Windows [Version 10.0.26200.5516]"
                if let Some(start) = ver.find("Version ") {
                    let rest = &ver[start + 8..];
                    if let Some(end) = rest.find(']') {
                        info.os_version = rest[..end].to_string();
                    }
                } else if !ver.is_empty() {
                    info.os_version = ver.to_string();
                }
            }
        }
        #[cfg(target_os = "macos")]
        {
            use std::process::Command;
            if let Ok(output) = Command::new("sw_vers")
                .arg("-productVersion")
                .output()
            {
                let ver = String::from_utf8_lossy(&output.stdout);
                let ver = ver.trim();
                if !ver.is_empty() {
                    info.os_version = ver.to_string();
                }
            }
        }
        #[cfg(target_os = "linux")]
        {
            if let Ok(content) = std::fs::read_to_string("/etc/os-release") {
                for line in content.lines() {
                    if let Some(val) = line.strip_prefix("PRETTY_NAME=") {
                        info.os_version = val.trim_matches('"').to_string();
                        break;
                    }
                }
            }
        }
    }

    Ok(info)
}

// ── Project attach ──────────────────────────────────────────────

#[tauri::command]
async fn get_all_projects_list(
    state: State<'_, AppState>,
) -> Result<Vec<ProjectListEntry>, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_all_projects_list().await
}

#[tauri::command]
async fn lookup_account(
    state: State<'_, AppState>,
    url: String,
    email: String,
    password: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.lookup_account(&url, &email, &password).await
}

#[tauri::command]
async fn lookup_account_poll(
    state: State<'_, AppState>,
) -> Result<AccountOut, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.lookup_account_poll().await
}

#[tauri::command]
async fn project_attach(
    state: State<'_, AppState>,
    url: String,
    authenticator: String,
    name: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.project_attach(&url, &authenticator, &name).await
}

#[tauri::command]
async fn project_attach_poll(
    state: State<'_, AppState>,
) -> Result<ProjectAttachReply, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.project_attach_poll().await
}

// ── Project config (Phase 4) ────────────────────────────────────

#[tauri::command]
async fn get_project_config(
    state: State<'_, AppState>,
    url: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_project_config(&url).await
}

#[tauri::command]
async fn get_project_config_poll(
    state: State<'_, AppState>,
) -> Result<ProjectConfig, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_project_config_poll().await
}

#[tauri::command]
async fn create_account(
    state: State<'_, AppState>,
    url: String,
    email: String,
    passwd_hash: String,
    user_name: String,
    team_name: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client
        .create_account(&url, &email, &passwd_hash, &user_name, &team_name)
        .await
}

#[tauri::command]
async fn create_account_poll(
    state: State<'_, AppState>,
) -> Result<AccountOut, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.create_account_poll().await
}

#[tauri::command]
fn compute_passwd_hash(email: String, password: String) -> String {
    use md5::{Digest, Md5};
    let mut hasher = Md5::new();
    hasher.update(password.as_bytes());
    hasher.update(email.to_lowercase().as_bytes());
    hex::encode(hasher.finalize())
}

// ── Account manager (Phase 4) ──────────────────────────────────

#[tauri::command]
async fn acct_mgr_info(
    state: State<'_, AppState>,
) -> Result<AcctMgrInfo, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.acct_mgr_info().await
}

#[tauri::command]
async fn acct_mgr_rpc(
    state: State<'_, AppState>,
    url: String,
    name: String,
    password: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.acct_mgr_rpc(&url, &name, &password).await
}

#[tauri::command]
async fn acct_mgr_rpc_poll(
    state: State<'_, AppState>,
) -> Result<AcctMgrRpcReply, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.acct_mgr_rpc_poll().await
}

// ── Proxy settings (Phase 5) ────────────────────────────────────

#[tauri::command]
async fn get_proxy_settings(
    state: State<'_, AppState>,
) -> Result<ProxyInfo, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_proxy_settings().await
}

#[tauri::command]
async fn set_proxy_settings(
    state: State<'_, AppState>,
    proxy: ProxyInfo,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.set_proxy_settings(&proxy).await
}

// ── CC Config (Phase 5) ─────────────────────────────────────────

#[tauri::command]
async fn get_cc_config(
    state: State<'_, AppState>,
) -> Result<CcConfig, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_cc_config().await
}

#[tauri::command]
async fn set_cc_config(
    state: State<'_, AppState>,
    config: CcConfig,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.set_cc_config(&config).await
}

// ── Version check (Phase 6) ─────────────────────────────────────

#[tauri::command]
async fn get_newer_version(
    state: State<'_, AppState>,
) -> Result<NewerVersionInfo, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_newer_version().await
}

// ── Exchange versions ────────────────────────────────────────────

#[tauri::command]
async fn exchange_versions(
    state: State<'_, AppState>,
) -> Result<VersionInfo, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.exchange_versions().await
}

// ── Get state ───────────────────────────────────────────────────

#[tauri::command]
async fn get_state(
    state: State<'_, AppState>,
) -> Result<CcState, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_state().await
}

// ── Read commands ───────────────────────────────────────────────

#[tauri::command]
async fn read_global_prefs_override(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.read_global_prefs_override().await
}

#[tauri::command]
async fn read_cc_config(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.read_cc_config().await
}

#[tauri::command]
async fn get_global_prefs_working(
    state: State<'_, AppState>,
) -> Result<GlobalPreferences, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_global_prefs_working().await
}

#[tauri::command]
async fn get_global_prefs_file(
    state: State<'_, AppState>,
) -> Result<GlobalPreferences, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_global_prefs_file().await
}

// ── Language ────────────────────────────────────────────────────

#[tauri::command]
async fn set_language(
    state: State<'_, AppState>,
    lang: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.set_language(&lang).await
}

// ── Project init ────────────────────────────────────────────────

#[tauri::command]
async fn get_project_init_status(
    state: State<'_, AppState>,
) -> Result<ProjectInitStatus, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_project_init_status().await
}

#[tauri::command]
async fn project_attach_from_file(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.project_attach_from_file().await
}

// ── Old results ─────────────────────────────────────────────────

#[tauri::command]
async fn get_old_results(
    state: State<'_, AppState>,
) -> Result<Vec<OldResult>, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_old_results().await
}

// ── Message count ───────────────────────────────────────────────

#[tauri::command]
async fn get_message_count(
    state: State<'_, AppState>,
) -> Result<i32, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_message_count().await
}

// ── Daily transfer history ──────────────────────────────────────

#[tauri::command]
async fn get_daily_xfer_history(
    state: State<'_, AppState>,
) -> Result<DailyXferHistory, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected")?;
    client.get_daily_xfer_history().await
}

// ── BOINC client launcher ────────────────────────────────────────

fn is_boinc_running() -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let output = std::process::Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq boinc.exe", "/NH", "/FO", "CSV"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
        match output {
            Ok(o) => String::from_utf8_lossy(&o.stdout).contains("boinc.exe"),
            Err(_) => false,
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let output = std::process::Command::new("pgrep")
            .args(["-x", "boinc"])
            .output();
        matches!(output, Ok(o) if o.status.success())
    }
}

/// Resolve the BOINC client executable path.
///
/// When `client_dir` is empty, tries platform-specific candidate paths in order
/// and returns the first one that exists. On macOS this covers both the app
/// bundle install and the CLI-only install.
///
/// When `client_dir` is provided, normalizes it (file vs directory) and checks
/// that the resulting path exists.
fn resolve_boinc_exe(client_dir: &str) -> Result<String, String> {
    let bin_name = if cfg!(target_os = "windows") { "boinc.exe" } else { "boinc" };

    if client_dir.is_empty() {
        let candidates: Vec<String> = if cfg!(target_os = "windows") {
            vec![r"C:\Program Files\BOINC\boinc.exe".to_string()]
        } else if cfg!(target_os = "macos") {
            vec![
                "/Applications/BOINCManager.app/Contents/Resources/boinc".to_string(),
                "/Library/Application Support/BOINC Data/boinc".to_string(),
                "/opt/homebrew/bin/boinc".to_string(),
                "/usr/local/bin/boinc".to_string(),
            ]
        } else {
            vec!["/usr/bin/boinc".to_string()]
        };

        for candidate in &candidates {
            if std::path::Path::new(candidate).exists() {
                return Ok(candidate.clone());
            }
        }

        let tried = candidates.join(", ");
        return Err(format!("BOINC client not found (tried: {tried})"));
    }

    let p = std::path::Path::new(client_dir);
    let exe_path = if p.is_file() {
        client_dir.to_string()
    } else {
        p.join(bin_name).to_string_lossy().to_string()
    };

    if !std::path::Path::new(&exe_path).exists() {
        return Err(format!("BOINC client not found at {exe_path}"));
    }

    Ok(exe_path)
}

#[tauri::command]
fn detect_boinc_client_dir() -> Result<String, String> {
    let exe_path = resolve_boinc_exe("")?;
    let parent = std::path::Path::new(&exe_path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| exe_path.clone());
    Ok(parent)
}

#[derive(serde::Serialize)]
struct BoincInstallOptions {
    boinc_present: bool,
    platform: &'static str,
    package_managers: Vec<String>,
    official_download_url: &'static str,
}

fn current_platform() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

fn probe_package_managers() -> Vec<String> {
    if cfg!(target_os = "windows") {
        return Vec::new();
    }
    let candidates: &[&str] = if cfg!(target_os = "macos") {
        &["brew"]
    } else {
        // Linux: only PMs the frontend has a command mapping for. brew on
        // Linux exists but we don't render a brew-on-Linux install command,
        // so probing for it would mislead the UI.
        &["apt", "dnf", "pacman"]
    };
    let mut found = Vec::new();
    for pm in candidates {
        let mut cmd = std::process::Command::new(pm);
        cmd.arg("--version");
        cmd.stdout(std::process::Stdio::null());
        cmd.stderr(std::process::Stdio::null());
        if let Ok(status) = cmd.status() {
            if status.success() {
                found.push((*pm).to_string());
            }
        }
    }
    found
}

#[tauri::command]
fn detect_boinc_install_options() -> BoincInstallOptions {
    BoincInstallOptions {
        boinc_present: resolve_boinc_exe("").is_ok(),
        platform: current_platform(),
        package_managers: probe_package_managers(),
        official_download_url: BOINC_DOWNLOAD_URL,
    }
}

#[tauri::command]
async fn install_boinc_via_brew() -> Result<(), String> {
    if !cfg!(target_os = "macos") {
        return Err("macOS-only".to_string());
    }

    // `kill_on_drop(true)` ensures that if the wrapping `tokio::time::timeout`
    // fires we actually terminate `brew` instead of leaking a long-running
    // background install (which could race with a user retry).
    let child = tokio::process::Command::new("brew")
        .args(["install", "boinc"])
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to spawn brew: {e}"))?;

    let output = match tokio::time::timeout(
        std::time::Duration::from_secs(BREW_INSTALL_TIMEOUT_SECS),
        child.wait_with_output(),
    )
    .await
    {
        Err(_) => {
            return Err(format!(
                "brew install timed out after {}s",
                BREW_INSTALL_TIMEOUT_SECS
            ));
        }
        Ok(inner) => inner.map_err(|e| format!("Failed to run brew: {e}"))?,
    };

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let trimmed: String = stderr.chars().take(200).collect();
    Err(if trimmed.is_empty() {
        format!("brew install failed (exit {})", output.status)
    } else {
        trimmed
    })
}

#[tauri::command]
async fn start_boinc_client(data_dir: String, client_dir: String) -> Result<(), String> {
    let already_running = is_boinc_running();

    if !already_running {
        let exe_path = resolve_boinc_exe(&client_dir)?;

        let mut cmd = std::process::Command::new(&exe_path);
        cmd.arg("--dir")
            .arg(&data_dir)
            .arg("--redirectio");

        // On Windows, --daemon causes BOINC to skip GPU detection entirely,
        // so use CREATE_NO_WINDOW instead to hide the console.
        // On other platforms, --daemon is needed to detach from the terminal.
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        #[cfg(not(target_os = "windows"))]
        {
            cmd.arg("--daemon");
        }

        cmd.spawn()
            .map_err(|e| format!("Failed to start BOINC client: {e}"))?;
    }

    // BOINC startup is slow: GPU detection ~80s, Docker detection ~40s.
    // Wait longer if already running (may be further from finishing init).
    let timeout_secs = if already_running { BOINC_TIMEOUT_EXISTING_SECS } else { BOINC_TIMEOUT_FRESH_SECS };
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(timeout_secs);
    loop {
        if tokio::net::TcpStream::connect(BOINC_RPC_ADDR)
            .await
            .is_ok()
        {
            return Ok(());
        }
        if tokio::time::Instant::now() >= deadline {
            return Err(format!(
                "BOINC client not responding on {BOINC_RPC_ADDR} after {timeout_secs}s"
            ));
        }
        tokio::time::sleep(std::time::Duration::from_millis(BOINC_CONNECT_POLL_MS)).await;
    }
}

// ── Manager autostart detection ─────────────────────────────────

/// Describes a discovered autostart registration for the official BOINC Manager.
///
/// Returned by [`detect_boinc_manager_autostart`] and fed back into
/// [`disable_boinc_manager_autostart`] so the frontend doesn't need to know
/// platform details.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(tag = "kind", content = "data")]
enum ManagerAutostartInfo {
    /// macOS: explicit launchd plist (`~/Library/LaunchAgents/*.plist` or
    /// system-wide `/Library/LaunchAgents`, `/Library/LaunchDaemons`).
    MacLaunchAgent { plist_path: String },
    /// macOS: Manager.app is installed but no plist was found. On Sequoia+
    /// BOINC installers register Login Items via SMAppService, which is opaque
    /// and cannot be edited programmatically by third-party apps.
    MacLoginItem,
    /// Windows: `HKCU\...\Run\<value>` or `HKLM\...\Run\<value>`.
    WindowsRunKey { hive: String, value_name: String },
    /// Windows: `.lnk` shortcut in the user's Startup folder.
    WindowsStartupShortcut { lnk_path: String },
    /// Linux: XDG autostart `.desktop` file.
    LinuxAutostart { desktop_path: String, system_wide: bool },
}

/// Filenames that indicate a BOINC Manager launchd unit.
///
/// The official Berkeley installer uses `edu.berkeley.boinc.Manager.plist`;
/// historical/3rd-party packaging may use `BOINCManager` or similar.
#[cfg(any(target_os = "macos", test))]
fn is_manager_plist_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    if !lower.ends_with(".plist") {
        return false;
    }
    // We specifically do NOT match the client daemon ("edu.berkeley.boinc"
    // without ".Manager"). Disabling the daemon would stop computation.
    (lower.starts_with("edu.berkeley.boinc.manager")
        || lower.contains("boincmanager")
        || lower.contains("boinc.manager"))
        && !lower.ends_with(".fresco-disabled")
}

/// Filenames that indicate a BOINC Manager XDG autostart entry on Linux.
/// Compiled on every platform so the shared `disable_boinc_manager_autostart`
/// validator can reject bogus `LinuxAutostart` paths without needing OS-
/// specific glue.
fn is_manager_desktop_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    if !lower.ends_with(".desktop") {
        return false;
    }
    (lower.contains("boincmgr") || lower.contains("boinc-manager") || lower == "boinc.desktop")
        && !lower.ends_with(".fresco-disabled")
}

/// Scan a list of directories for the first file whose name satisfies `predicate`.
///
/// Returns the full path of the match, or `None` if nothing is found.
/// Missing directories are silently skipped (expected on machines where the
/// Manager isn't installed).
#[cfg(any(target_os = "macos", target_os = "linux", target_os = "windows", test))]
fn find_first_matching_file(dirs: &[std::path::PathBuf], predicate: fn(&str) -> bool) -> Option<std::path::PathBuf> {
    for dir in dirs {
        let Ok(entries) = std::fs::read_dir(dir) else { continue };
        for entry in entries.flatten() {
            let name = entry.file_name();
            let Some(name_str) = name.to_str() else { continue };
            if predicate(name_str) {
                return Some(entry.path());
            }
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn mac_launchagent_dirs() -> Vec<std::path::PathBuf> {
    // User-level entries come first because detection stops at the first
    // match, and disabling a per-user LaunchAgent doesn't require root.
    let mut dirs = Vec::new();
    if let Some(home) = std::env::var_os("HOME") {
        dirs.push(std::path::PathBuf::from(home).join("Library/LaunchAgents"));
    }
    dirs.push(std::path::PathBuf::from("/Library/LaunchAgents"));
    dirs.push(std::path::PathBuf::from("/Library/LaunchDaemons"));
    dirs
}

#[cfg(target_os = "linux")]
fn linux_autostart_dirs() -> Vec<(std::path::PathBuf, bool)> {
    // User-level entries are preferred over system-wide because we can
    // disable them without root. Detection stops at the first match,
    // so order matters.
    let mut dirs = Vec::new();
    if let Some(home) = std::env::var_os("HOME") {
        dirs.push((std::path::PathBuf::from(home).join(".config/autostart"), false));
    }
    dirs.push((std::path::PathBuf::from("/etc/xdg/autostart"), true));
    dirs
}

#[cfg(target_os = "macos")]
fn macos_major_version() -> Option<u32> {
    let output = std::process::Command::new("sw_vers")
        .arg("-productVersion")
        .output()
        .ok()?;
    let ver = String::from_utf8_lossy(&output.stdout);
    ver.trim().split('.').next()?.parse::<u32>().ok()
}

#[tauri::command]
fn detect_boinc_manager_autostart() -> Result<Option<ManagerAutostartInfo>, String> {
    #[cfg(target_os = "macos")]
    {
        let dirs = mac_launchagent_dirs();
        if let Some(path) = find_first_matching_file(&dirs, is_manager_plist_name) {
            return Ok(Some(ManagerAutostartInfo::MacLaunchAgent {
                plist_path: path.to_string_lossy().into_owned(),
            }));
        }
        // No plist found — fall back to detecting the app bundle, but only on
        // macOS 13+ where SMAppService Login Items replaced editable plists.
        // On older macOS a BOINC Manager install without a plist almost
        // certainly means autostart isn't configured; we don't want to prompt
        // the takeover dialog for users who never registered autostart.
        // Full SMAppService introspection needs native API (out of scope);
        // this gate avoids the common false positive.
        if macos_major_version().is_some_and(|v| v >= 13)
            && std::path::Path::new("/Applications/BOINCManager.app").exists()
        {
            return Ok(Some(ManagerAutostartInfo::MacLoginItem));
        }
        Ok(None)
    }
    #[cfg(target_os = "windows")]
    {
        windows_detect_manager_run_key().map(|opt| opt.or_else(windows_detect_startup_shortcut))
    }
    #[cfg(target_os = "linux")]
    {
        for (dir, system_wide) in linux_autostart_dirs() {
            if let Some(path) = find_first_matching_file(&[dir], is_manager_desktop_name) {
                return Ok(Some(ManagerAutostartInfo::LinuxAutostart {
                    desktop_path: path.to_string_lossy().into_owned(),
                    system_wide,
                }));
            }
        }
        Ok(None)
    }
}

#[cfg(target_os = "windows")]
fn windows_detect_manager_run_key() -> Result<Option<ManagerAutostartInfo>, String> {
    use winreg::enums::*;
    use winreg::types::FromRegValue;
    use winreg::RegKey;

    for (hive_name, hkey) in [("HKCU", HKEY_CURRENT_USER), ("HKLM", HKEY_LOCAL_MACHINE)] {
        let root = RegKey::predef(hkey);
        let Ok(run) = root.open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Run") else {
            continue;
        };
        for (value_name, value) in run.enum_values().flatten() {
            // Only REG_SZ / REG_EXPAND_SZ carry a launch command. Skip other
            // types instead of matching on the Debug-formatted representation,
            // which was unreliable for non-string registry types.
            if !matches!(value.vtype, REG_SZ | REG_EXPAND_SZ) {
                continue;
            }
            let Ok(data) = String::from_reg_value(&value) else {
                continue;
            };
            if data.to_ascii_lowercase().contains("boincmgr") {
                return Ok(Some(ManagerAutostartInfo::WindowsRunKey {
                    hive: hive_name.to_string(),
                    value_name,
                }));
            }
        }
    }
    Ok(None)
}

#[cfg(target_os = "windows")]
fn windows_detect_startup_shortcut() -> Option<ManagerAutostartInfo> {
    // Scan the per-user Startup folder for a .lnk whose name suggests BOINC
    // Manager. We don't parse the .lnk target — name-matching is enough for
    // the common installer layouts and keeps us dependency-free.
    let appdata = std::env::var_os("APPDATA")?;
    let startup = std::path::PathBuf::from(appdata)
        .join(r"Microsoft\Windows\Start Menu\Programs\Startup");
    let predicate = |name: &str| -> bool {
        let lower = name.to_ascii_lowercase();
        lower.ends_with(".lnk")
            && (lower.contains("boincmgr") || lower.contains("boinc manager"))
            && !lower.ends_with(".fresco-disabled")
    };
    find_first_matching_file(&[startup], predicate)
        .map(|path| ManagerAutostartInfo::WindowsStartupShortcut {
            lnk_path: path.to_string_lossy().into_owned(),
        })
}

/// Validate that a filesystem path is a plausible BOINC Manager autostart
/// entry before we mutate it. Guards against an XSS-compromised frontend
/// passing an arbitrary user-writable path into
/// `disable_boinc_manager_autostart`.
///
/// `expected_dirs` is the list of directories where the matching kind of
/// autostart entry can legitimately live; the path's immediate parent
/// must equal one of them. `filename_ok` is the same name matcher that
/// `detect_boinc_manager_autostart` used to find the file in the first place.
///
/// In `cfg(test)` the directory check is skipped so unit tests can operate
/// on `tempfile::tempdir()` without needing root-writable mock paths; the
/// filename matcher still runs.
#[cfg(any(target_os = "macos", target_os = "linux", target_os = "windows", test))]
fn validate_autostart_path(
    path: &std::path::Path,
    expected_dirs: &[std::path::PathBuf],
    filename_ok: impl Fn(&str) -> bool,
) -> Result<(), String> {
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "autostart path has no filename".to_string())?;
    if !filename_ok(filename) {
        return Err(format!(
            "{filename} does not match a BOINC Manager autostart entry"
        ));
    }
    #[cfg(not(test))]
    {
        let parent = path
            .parent()
            .ok_or_else(|| "autostart path has no parent directory".to_string())?;
        if !expected_dirs.iter().any(|d| d == parent) {
            return Err(format!(
                "{} is not in an expected autostart directory",
                path.display()
            ));
        }
    }
    #[cfg(test)]
    {
        let _ = expected_dirs;
    }
    Ok(())
}

/// Rename `path` to `path + ".fresco-disabled"`, replacing any existing
/// disabled file from a previous run.
#[cfg(any(target_os = "macos", target_os = "linux", target_os = "windows", test))]
fn rename_with_disabled_suffix(path: &std::path::Path) -> std::io::Result<std::path::PathBuf> {
    let mut new_name = path.file_name().unwrap_or_default().to_os_string();
    new_name.push(".fresco-disabled");
    let dest = path.with_file_name(new_name);
    if dest.exists() {
        std::fs::remove_file(&dest)?;
    }
    std::fs::rename(path, &dest)?;
    Ok(dest)
}

#[tauri::command]
fn disable_boinc_manager_autostart(info: ManagerAutostartInfo) -> Result<(), String> {
    match info {
        ManagerAutostartInfo::MacLaunchAgent { plist_path } => {
            #[cfg(target_os = "macos")]
            {
                let path = std::path::Path::new(&plist_path);
                validate_autostart_path(path, &mac_launchagent_dirs(), is_manager_plist_name)?;
                // Best-effort unload — ignore errors because the agent may not
                // be currently loaded (e.g. the user just installed Manager
                // and hasn't rebooted yet).
                let _ = std::process::Command::new("launchctl")
                    .args(["unload", &plist_path])
                    .output();
                rename_with_disabled_suffix(path)
                    .map_err(|e| format!("Failed to rename {plist_path}: {e}"))?;
                Ok(())
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = plist_path;
                Err("MacLaunchAgent only valid on macOS".to_string())
            }
        }
        ManagerAutostartInfo::MacLoginItem => {
            // Login Items registered via SMAppService are opaque to third-party
            // apps. Signal the frontend to deep-link the user to System Settings.
            Err("manual".to_string())
        }
        ManagerAutostartInfo::WindowsRunKey { hive, value_name } => {
            #[cfg(target_os = "windows")]
            {
                use winreg::enums::*;
                use winreg::types::FromRegValue;
                use winreg::RegKey;
                let hkey = match hive.as_str() {
                    "HKCU" => HKEY_CURRENT_USER,
                    "HKLM" => HKEY_LOCAL_MACHINE,
                    other => return Err(format!("Unknown hive: {other}")),
                };
                let root = RegKey::predef(hkey);
                // Editing HKLM almost always requires admin. Map permission
                // failures on any HKLM op to the "manual" sentinel so the
                // frontend shows an instructional fallback instead of a
                // generic error toast.
                let map_permission =
                    |err: std::io::Error| -> String {
                        if hive == "HKLM"
                            && err.kind() == std::io::ErrorKind::PermissionDenied
                        {
                            "manual".to_string()
                        } else {
                            err.to_string()
                        }
                    };
                let run = root
                    .open_subkey_with_flags(
                        r"Software\Microsoft\Windows\CurrentVersion\Run",
                        KEY_QUERY_VALUE | KEY_SET_VALUE,
                    )
                    .map_err(|e| {
                        let msg = map_permission(e);
                        if msg == "manual" {
                            msg
                        } else {
                            format!("Open Run key: {msg}")
                        }
                    })?;
                // Re-read the value and confirm it still points at BOINC
                // Manager before deleting — guards against the frontend
                // asking us to delete an arbitrary Run key entry.
                let value = run
                    .get_raw_value(&value_name)
                    .map_err(|e| format!("Read value {value_name}: {e}"))?;
                if !matches!(value.vtype, REG_SZ | REG_EXPAND_SZ) {
                    return Err(format!(
                        "{value_name} is not a string value; refusing to delete"
                    ));
                }
                let data = String::from_reg_value(&value)
                    .map_err(|e| format!("Decode value {value_name}: {e}"))?;
                if !data.to_ascii_lowercase().contains("boincmgr") {
                    return Err(format!(
                        "{value_name} does not reference boincmgr; refusing to delete"
                    ));
                }
                run.delete_value(&value_name).map_err(|e| {
                    let msg = map_permission(e);
                    if msg == "manual" {
                        msg
                    } else {
                        format!("Delete value {value_name}: {msg}")
                    }
                })?;
                Ok(())
            }
            #[cfg(not(target_os = "windows"))]
            {
                let _ = (hive, value_name);
                Err("WindowsRunKey only valid on Windows".to_string())
            }
        }
        ManagerAutostartInfo::WindowsStartupShortcut { lnk_path } => {
            #[cfg(target_os = "windows")]
            {
                let path = std::path::Path::new(&lnk_path);
                let startup_dirs = std::env::var_os("APPDATA")
                    .map(|appdata| {
                        vec![std::path::PathBuf::from(appdata)
                            .join(r"Microsoft\Windows\Start Menu\Programs\Startup")]
                    })
                    .unwrap_or_default();
                validate_autostart_path(path, &startup_dirs, |name| {
                    let lower = name.to_ascii_lowercase();
                    lower.ends_with(".lnk")
                        && (lower.contains("boincmgr") || lower.contains("boinc manager"))
                        && !lower.ends_with(".fresco-disabled")
                })?;
                rename_with_disabled_suffix(path)
                    .map_err(|e| format!("Failed to rename {lnk_path}: {e}"))?;
                Ok(())
            }
            #[cfg(not(target_os = "windows"))]
            {
                let _ = lnk_path;
                Err("WindowsStartupShortcut only valid on Windows".to_string())
            }
        }
        ManagerAutostartInfo::LinuxAutostart { desktop_path, system_wide } => {
            if system_wide {
                // We can't rename files under /etc/xdg/autostart without root.
                // Ask the frontend to show instructions.
                return Err("manual".to_string());
            }
            let path = std::path::Path::new(&desktop_path);
            #[cfg(target_os = "linux")]
            let dirs: Vec<std::path::PathBuf> = linux_autostart_dirs()
                .into_iter()
                .filter(|(_, sys)| !*sys)
                .map(|(d, _)| d)
                .collect();
            #[cfg(not(target_os = "linux"))]
            let dirs: Vec<std::path::PathBuf> = Vec::new();
            validate_autostart_path(path, &dirs, is_manager_desktop_name)?;
            rename_with_disabled_suffix(path)
                .map_err(|e| format!("Failed to rename {desktop_path}: {e}"))?;
            Ok(())
        }
    }
}

#[cfg(test)]
mod manager_autostart_tests {
    use super::*;
    use std::fs;

    #[test]
    fn plist_name_matcher_accepts_official_and_rejects_client() {
        assert!(is_manager_plist_name("edu.berkeley.boinc.Manager.plist"));
        assert!(is_manager_plist_name("edu.berkeley.BOINCManager.plist"));
        assert!(is_manager_plist_name("com.example.BoincManager.plist"));

        // Critical: must not match the client daemon.
        assert!(!is_manager_plist_name("edu.berkeley.boinc.plist"));
        assert!(!is_manager_plist_name("edu.berkeley.boinc-client.plist"));

        // Previously-disabled files are ignored so re-runs don't loop.
        assert!(!is_manager_plist_name(
            "edu.berkeley.boinc.Manager.plist.fresco-disabled"
        ));
        assert!(!is_manager_plist_name("unrelated.plist"));
    }

    #[test]
    fn desktop_name_matcher_accepts_manager_variants() {
        assert!(is_manager_desktop_name("boincmgr.desktop"));
        assert!(is_manager_desktop_name("boinc-manager.desktop"));
        assert!(is_manager_desktop_name("BOINCMgr.desktop"));
        assert!(!is_manager_desktop_name("boincmgr.desktop.fresco-disabled"));
        assert!(!is_manager_desktop_name("firefox.desktop"));
        assert!(!is_manager_desktop_name("boincmgr.txt"));
    }

    #[test]
    fn find_first_matching_file_returns_match_and_none() {
        let tmp = tempfile::tempdir().unwrap();
        fs::write(tmp.path().join("noise.plist"), b"").unwrap();
        fs::write(tmp.path().join("edu.berkeley.boinc.Manager.plist"), b"").unwrap();

        let found = find_first_matching_file(
            &[tmp.path().to_path_buf()],
            is_manager_plist_name,
        );
        assert!(found.is_some());
        assert!(found.unwrap().to_string_lossy().ends_with("Manager.plist"));

        let empty = tempfile::tempdir().unwrap();
        assert!(find_first_matching_file(
            &[empty.path().to_path_buf()],
            is_manager_plist_name,
        ).is_none());
    }

    #[test]
    fn find_first_matching_skips_missing_dirs() {
        let tmp = tempfile::tempdir().unwrap();
        fs::write(tmp.path().join("boinc-manager.desktop"), b"").unwrap();

        let mut dirs = vec![std::path::PathBuf::from("/nonexistent/does/not/exist")];
        dirs.push(tmp.path().to_path_buf());

        let found = find_first_matching_file(&dirs, is_manager_desktop_name);
        assert!(found.is_some());
    }

    #[test]
    fn rename_with_disabled_suffix_renames_and_overwrites() {
        let tmp = tempfile::tempdir().unwrap();
        let original = tmp.path().join("boincmgr.desktop");
        fs::write(&original, b"first").unwrap();

        let disabled = rename_with_disabled_suffix(&original).unwrap();
        assert!(!original.exists());
        assert!(disabled.exists());
        assert_eq!(fs::read(&disabled).unwrap(), b"first");

        // A second disable on a fresh file must overwrite the leftover.
        fs::write(&original, b"second").unwrap();
        let disabled2 = rename_with_disabled_suffix(&original).unwrap();
        assert_eq!(disabled, disabled2);
        assert_eq!(fs::read(&disabled2).unwrap(), b"second");
    }

    #[test]
    fn validate_autostart_path_rejects_mismatched_filename() {
        let tmp = tempfile::tempdir().unwrap();
        let bogus = tmp.path().join("important_user_file.plist");
        let err = validate_autostart_path(&bogus, &[tmp.path().to_path_buf()], is_manager_plist_name)
            .unwrap_err();
        assert!(err.contains("does not match"));
    }

    #[test]
    fn validate_autostart_path_accepts_matching_filename() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("edu.berkeley.boinc.Manager.plist");
        validate_autostart_path(&path, &[tmp.path().to_path_buf()], is_manager_plist_name).unwrap();
    }

    #[test]
    fn disable_rejects_mac_launch_agent_with_mismatched_filename() {
        let tmp = tempfile::tempdir().unwrap();
        let bogus = tmp.path().join("unrelated.plist");
        #[cfg(target_os = "macos")]
        std::fs::write(&bogus, b"").unwrap();
        let err = disable_boinc_manager_autostart(ManagerAutostartInfo::MacLaunchAgent {
            plist_path: bogus.to_string_lossy().into_owned(),
        })
        .unwrap_err();
        // Either the filename-matcher rejects (macOS) or the "only valid on
        // macOS" sentinel trips (non-macOS); both indicate we didn't rename.
        assert!(err.contains("does not match") || err.contains("only valid on macOS"));
    }

    #[test]
    fn disable_rejects_mac_login_item_with_manual_sentinel() {
        // Frontend keys off the literal "manual" string to fall back to
        // deep-linking System Settings, so this contract must not drift.
        let err = disable_boinc_manager_autostart(ManagerAutostartInfo::MacLoginItem)
            .unwrap_err();
        assert_eq!(err, "manual");
    }

    #[test]
    fn disable_rejects_system_wide_linux_autostart_with_manual_sentinel() {
        let err = disable_boinc_manager_autostart(ManagerAutostartInfo::LinuxAutostart {
            desktop_path: "/etc/xdg/autostart/boincmgr.desktop".into(),
            system_wide: true,
        })
        .unwrap_err();
        assert_eq!(err, "manual");
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn disable_user_linux_autostart_renames_file() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("boinc-manager.desktop");
        std::fs::write(&path, b"[Desktop Entry]\n").unwrap();

        disable_boinc_manager_autostart(ManagerAutostartInfo::LinuxAutostart {
            desktop_path: path.to_string_lossy().into_owned(),
            system_wide: false,
        })
        .unwrap();

        assert!(!path.exists());
        assert!(path.with_file_name("boinc-manager.desktop.fresco-disabled").exists());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn disable_mac_launch_agent_renames_plist() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("edu.berkeley.boinc.Manager.plist");
        std::fs::write(&path, b"<plist/>").unwrap();

        disable_boinc_manager_autostart(ManagerAutostartInfo::MacLaunchAgent {
            plist_path: path.to_string_lossy().into_owned(),
        })
        .unwrap();

        assert!(!path.exists());
        assert!(path
            .with_file_name("edu.berkeley.boinc.Manager.plist.fresco-disabled")
            .exists());
    }
}

#[cfg(test)]
mod install_options_tests {
    use super::*;

    #[test]
    fn install_options_reports_current_platform() {
        let opts = detect_boinc_install_options();
        let expected = if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "macos"
        } else {
            "linux"
        };
        assert_eq!(opts.platform, expected);
    }

    #[test]
    fn install_options_boinc_present_matches_resolver() {
        let opts = detect_boinc_install_options();
        assert_eq!(opts.boinc_present, resolve_boinc_exe("").is_ok());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn install_options_windows_has_empty_pm_list() {
        let opts = detect_boinc_install_options();
        assert!(opts.package_managers.is_empty());
    }

    #[cfg(not(target_os = "macos"))]
    #[tokio::test]
    async fn install_boinc_via_brew_errors_on_non_macos() {
        let err = install_boinc_via_brew().await.unwrap_err();
        assert_eq!(err, "macOS-only");
    }
}

#[tauri::command]
fn open_login_items_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.LoginItems-Settings.extension")
            .spawn()
            .map_err(|e| format!("Failed to open System Settings: {e}"))?;
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("open_login_items_settings is macOS-only".to_string())
    }
}

// ── Graphics launcher ───────────────────────────────────────────

#[tauri::command]
fn launch_graphics(path: String) -> Result<(), String> {
    std::process::Command::new(&path)
        .spawn()
        .map_err(|e| format!("Failed to launch graphics: {e}"))?;
    Ok(())
}

#[tauri::command]
fn launch_remote_desktop(addr: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("mstsc")
            .arg(format!("/v:{addr}"))
            .spawn()
            .map_err(|e| format!("Failed to launch remote desktop: {e}"))?;
    }
    #[cfg(target_os = "linux")]
    {
        // Try xfreerdp first, fall back to rdesktop
        let result = std::process::Command::new("xfreerdp")
            .arg(format!("/v:{addr}"))
            .spawn();
        if result.is_err() {
            std::process::Command::new("rdesktop")
                .arg(&addr)
                .spawn()
                .map_err(|e| format!("Failed to launch remote desktop: {e}"))?;
        }
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(format!("rdp://full%20address=s:{addr}"))
            .spawn()
            .map_err(|e| format!("Failed to launch remote desktop: {e}"))?;
    }
    Ok(())
}

// ── Build info ──────────────────────────────────────────────────

#[tauri::command]
fn get_build_time() -> String {
    option_env!("FRESCO_BUILD_TIME")
        .unwrap_or("dev")
        .to_string()
}

#[tauri::command]
fn get_platform() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

#[tauri::command]
fn get_arch() -> &'static str {
    if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "x86_64"
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Focus existing window when second instance is launched
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .manage(AppState {
            client: Arc::new(Mutex::new(None)),
        })
        .setup(|app| {
            let handle = app.handle().clone();
            tray::setup_tray(&handle).expect("failed to setup tray");

            // Parse CLI args
            if let Ok(matches) = app.cli().matches() {
                let autostart = matches
                    .args
                    .get("autostart")
                    .map(|a| a.occurrences > 0)
                    .unwrap_or(false);

                if autostart {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                }

                // Emit CLI connection info to frontend
                let host = matches
                    .args
                    .get("host")
                    .and_then(|a| a.value.as_str().map(String::from));
                let port = matches
                    .args
                    .get("port")
                    .and_then(|a| a.value.as_str().map(String::from));
                let password = matches
                    .args
                    .get("password")
                    .and_then(|a| a.value.as_str().map(String::from));
                let datadir = matches
                    .args
                    .get("datadir")
                    .and_then(|a| a.value.as_str().map(String::from));

                if host.is_some() || datadir.is_some() {
                    use tauri::Emitter;
                    let _ = app.emit(
                        "cli-connect",
                        serde_json::json!({
                            "host": host,
                            "port": port,
                            "password": password,
                            "datadir": datadir,
                        }),
                    );
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            tauri::WindowEvent::ThemeChanged(theme) => {
                tray::update_icons_for_theme(window.app_handle(), *theme);
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            connect,
            connect_local,
            disconnect,
            get_connection_state,
            get_results,
            get_project_status,
            get_cc_status,
            get_transfers,
            suspend_task,
            resume_task,
            abort_task,
            suspend_project,
            resume_project,
            update_project,
            no_new_tasks_project,
            allow_new_tasks_project,
            reset_project,
            detach_project,
            set_run_mode,
            set_gpu_mode,
            set_network_mode,
            retry_transfer,
            abort_transfer,
            run_benchmarks,
            retry_pending_transfers,
            shutdown_client,
            get_statistics,
            get_messages,
            get_notices,
            get_disk_usage,
            get_preferences,
            set_preferences,
            get_host_info,
            get_all_projects_list,
            lookup_account,
            lookup_account_poll,
            project_attach,
            project_attach_poll,
            get_project_config,
            get_project_config_poll,
            create_account,
            create_account_poll,
            compute_passwd_hash,
            acct_mgr_info,
            acct_mgr_rpc,
            acct_mgr_rpc_poll,
            get_proxy_settings,
            set_proxy_settings,
            get_cc_config,
            set_cc_config,
            get_newer_version,
            start_boinc_client,
            detect_boinc_client_dir,
            detect_boinc_install_options,
            install_boinc_via_brew,
            detect_boinc_manager_autostart,
            disable_boinc_manager_autostart,
            open_login_items_settings,
            launch_graphics,
            launch_remote_desktop,
            exchange_versions,
            get_state,
            read_global_prefs_override,
            read_cc_config,
            get_global_prefs_working,
            get_global_prefs_file,
            set_language,
            get_project_init_status,
            project_attach_from_file,
            get_old_results,
            get_message_count,
            get_daily_xfer_history,
            get_build_time,
            get_platform,
            get_arch,
            updater::download_update,
            updater::update_now,
            updater::install_update,
            updater::cleanup_old_binary,
            tray::sync_tray_modes,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = _event {
                if let Some(window) = _app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        });
}
