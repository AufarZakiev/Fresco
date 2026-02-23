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

#[tauri::command]
async fn start_boinc_client(data_dir: String, client_dir: String) -> Result<(), String> {
    let already_running = is_boinc_running();

    if !already_running {
        let default_exe = if cfg!(target_os = "windows") {
            r"C:\Program Files\BOINC\boinc.exe".to_string()
        } else if cfg!(target_os = "macos") {
            "/Applications/BOINCManager.app/Contents/Resources/boinc".to_string()
        } else {
            "/usr/bin/boinc".to_string()
        };
        let exe_path = if client_dir.is_empty() {
            default_exe
        } else {
            let p = std::path::Path::new(&client_dir);
            if p.is_file() {
                client_dir.clone()
            } else {
                // Treat as directory — append the binary name
                let name = if cfg!(target_os = "windows") { "boinc.exe" } else { "boinc" };
                p.join(name).to_string_lossy().to_string()
            }
        };

        if !std::path::Path::new(&exe_path).exists() {
            return Err(format!("BOINC client not found at {exe_path}"));
        }

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
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
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
            updater::download_update,
            updater::update_now,
            updater::install_update,
            updater::cleanup_old_binary,
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
