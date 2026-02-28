import { invoke } from "@tauri-apps/api/core";
import type {
  TaskResult,
  Project,
  CcStatus,
  CcState,
  FileTransfer,
  ProjectStatistics,
  Message,
  Notice,
  DiskUsage,
  GlobalPreferences,
  HostInfo,
  ProjectListEntry,
  AccountOut,
  ProjectAttachReply,
  ProjectConfig,
  AcctMgrInfo,
  AcctMgrRpcReply,
  ProxyInfo,
  CcConfig,
  NewerVersionInfo,
  VersionInfo,
  ProjectInitStatus,
  DailyXferHistory,
  OldResult,
} from "../types/boinc";

/**
 * Thin wrappers around Tauri invoke() calls to the Rust backend.
 * Each function maps 1:1 to a #[tauri::command] in lib.rs.
 */

// ── Connection ───────────────────────────────────────────────────

export async function connectLocal(dataDir: string): Promise<void> {
  return invoke("connect_local", { dataDir });
}

export async function connect(
  host: string,
  port: number,
  password: string,
): Promise<void> {
  return invoke("connect", { host, port, password });
}

export async function disconnect(): Promise<void> {
  return invoke("disconnect");
}

export async function getConnectionState(): Promise<string> {
  return invoke("get_connection_state");
}

// ── Read operations ──────────────────────────────────────────────

export async function getResults(activeOnly: boolean): Promise<TaskResult[]> {
  return invoke("get_results", { activeOnly });
}

export async function getProjectStatus(): Promise<Project[]> {
  return invoke("get_project_status");
}

export async function getCcStatus(): Promise<CcStatus> {
  return invoke("get_cc_status");
}

export async function getTransfers(): Promise<FileTransfer[]> {
  return invoke("get_transfers");
}

// ── Task actions ─────────────────────────────────────────────────

export async function suspendTask(
  projectUrl: string,
  name: string,
): Promise<void> {
  return invoke("suspend_task", { projectUrl, name });
}

export async function resumeTask(
  projectUrl: string,
  name: string,
): Promise<void> {
  return invoke("resume_task", { projectUrl, name });
}

export async function abortTask(
  projectUrl: string,
  name: string,
): Promise<void> {
  return invoke("abort_task", { projectUrl, name });
}

// ── Project actions ──────────────────────────────────────────────

export async function suspendProject(projectUrl: string): Promise<void> {
  return invoke("suspend_project", { projectUrl });
}

export async function resumeProject(projectUrl: string): Promise<void> {
  return invoke("resume_project", { projectUrl });
}

export async function updateProject(projectUrl: string): Promise<void> {
  return invoke("update_project", { projectUrl });
}

export async function noNewTasksProject(projectUrl: string): Promise<void> {
  return invoke("no_new_tasks_project", { projectUrl });
}

export async function allowNewTasksProject(projectUrl: string): Promise<void> {
  return invoke("allow_new_tasks_project", { projectUrl });
}

export async function resetProject(projectUrl: string): Promise<void> {
  return invoke("reset_project", { projectUrl });
}

export async function detachProject(projectUrl: string): Promise<void> {
  return invoke("detach_project", { projectUrl });
}

// ── Mode controls ────────────────────────────────────────────────

export async function setRunMode(
  mode: number,
  duration: number,
): Promise<void> {
  return invoke("set_run_mode", { mode, duration });
}

export async function setGpuMode(
  mode: number,
  duration: number,
): Promise<void> {
  return invoke("set_gpu_mode", { mode, duration });
}

export async function setNetworkMode(
  mode: number,
  duration: number,
): Promise<void> {
  return invoke("set_network_mode", { mode, duration });
}

// ── Transfer actions ─────────────────────────────────────────────

export async function retryTransfer(
  projectUrl: string,
  filename: string,
): Promise<void> {
  return invoke("retry_transfer", { projectUrl, filename });
}

export async function abortTransfer(
  projectUrl: string,
  filename: string,
): Promise<void> {
  return invoke("abort_transfer", { projectUrl, filename });
}

// ── BOINC client launcher ────────────────────────────────────────

export async function startBoincClient(dataDir: string, clientDir: string = ""): Promise<void> {
  return invoke("start_boinc_client", { dataDir, clientDir });
}

// ── Other ────────────────────────────────────────────────────────

export async function runBenchmarks(): Promise<void> {
  return invoke("run_benchmarks");
}

export async function retryPendingTransfers(): Promise<void> {
  return invoke("retry_pending_transfers");
}

export async function shutdownClient(): Promise<void> {
  return invoke("shutdown_client");
}

// ── Statistics ───────────────────────────────────────────────────

export async function getStatistics(): Promise<ProjectStatistics[]> {
  return invoke("get_statistics");
}

// ── Messages ─────────────────────────────────────────────────────

export async function getMessages(seqno: number): Promise<Message[]> {
  return invoke("get_messages", { seqno });
}

// ── Notices ──────────────────────────────────────────────────────

export async function getNotices(seqno: number): Promise<Notice[]> {
  return invoke("get_notices", { seqno });
}

// ── Disk usage ───────────────────────────────────────────────────

export async function getDiskUsage(): Promise<DiskUsage> {
  return invoke("get_disk_usage");
}

// ── Preferences ──────────────────────────────────────────────────

export async function getPreferences(): Promise<GlobalPreferences> {
  return invoke("get_preferences");
}

export async function setPreferences(
  prefs: GlobalPreferences,
): Promise<void> {
  return invoke("set_preferences", { prefs });
}

// ── Host info ────────────────────────────────────────────────────

export async function getHostInfo(): Promise<HostInfo> {
  return invoke("get_host_info");
}

// ── Project attach ───────────────────────────────────────────────

export async function getAllProjectsList(): Promise<ProjectListEntry[]> {
  return invoke("get_all_projects_list");
}

export async function lookupAccount(
  url: string,
  email: string,
  password: string,
): Promise<void> {
  return invoke("lookup_account", { url, email, password });
}

export async function lookupAccountPoll(): Promise<AccountOut> {
  return invoke("lookup_account_poll");
}

export async function projectAttach(
  url: string,
  authenticator: string,
  name: string,
): Promise<void> {
  return invoke("project_attach", { url, authenticator, name });
}

export async function projectAttachPoll(): Promise<ProjectAttachReply> {
  return invoke("project_attach_poll");
}

// ── Project config ──────────────────────────────────────────────

export async function getProjectConfig(url: string): Promise<void> {
  return invoke("get_project_config", { url });
}

export async function getProjectConfigPoll(): Promise<ProjectConfig> {
  return invoke("get_project_config_poll");
}

export async function createAccount(
  url: string,
  email: string,
  passwdHash: string,
  userName: string,
  teamName: string,
): Promise<void> {
  return invoke("create_account", { url, email, passwdHash, userName, teamName });
}

export async function createAccountPoll(): Promise<AccountOut> {
  return invoke("create_account_poll");
}

export async function computePasswdHash(
  email: string,
  password: string,
): Promise<string> {
  return invoke("compute_passwd_hash", { email, password });
}

// ── Account manager ─────────────────────────────────────────────

export async function acctMgrInfo(): Promise<AcctMgrInfo> {
  return invoke("acct_mgr_info");
}

export async function acctMgrRpc(
  url: string,
  name: string,
  password: string,
): Promise<void> {
  return invoke("acct_mgr_rpc", { url, name, password });
}

export async function acctMgrRpcPoll(): Promise<AcctMgrRpcReply> {
  return invoke("acct_mgr_rpc_poll");
}

// ── Proxy settings ──────────────────────────────────────────────

export async function getProxySettings(): Promise<ProxyInfo> {
  return invoke("get_proxy_settings");
}

export async function setProxySettings(proxy: ProxyInfo): Promise<void> {
  return invoke("set_proxy_settings", { proxy });
}

// ── CC Config ───────────────────────────────────────────────────

export async function getCcConfig(): Promise<CcConfig> {
  return invoke("get_cc_config");
}

export async function setCcConfig(config: CcConfig): Promise<void> {
  return invoke("set_cc_config", { config });
}

// ── Version check ───────────────────────────────────────────────

export async function getNewerVersion(): Promise<NewerVersionInfo> {
  return invoke("get_newer_version");
}

// ── Graphics launcher ───────────────────────────────────────────

export async function launchGraphics(path: string): Promise<void> {
  return invoke("launch_graphics", { path });
}

export async function launchRemoteDesktop(addr: string): Promise<void> {
  return invoke("launch_remote_desktop", { addr });
}

// ── Exchange versions ───────────────────────────────────────────

export async function exchangeVersions(): Promise<VersionInfo> {
  return invoke("exchange_versions");
}

// ── Get state ───────────────────────────────────────────────────

export async function getState(): Promise<CcState> {
  return invoke("get_state");
}

// ── Read commands ───────────────────────────────────────────────

export async function readGlobalPrefsOverride(): Promise<void> {
  return invoke("read_global_prefs_override");
}

export async function readCcConfig(): Promise<void> {
  return invoke("read_cc_config");
}

export async function getGlobalPrefsWorking(): Promise<GlobalPreferences> {
  return invoke("get_global_prefs_working");
}

export async function getGlobalPrefsFile(): Promise<GlobalPreferences> {
  return invoke("get_global_prefs_file");
}

// ── Language ────────────────────────────────────────────────────

export async function setLanguage(lang: string): Promise<void> {
  return invoke("set_language", { lang });
}

// ── Project init ────────────────────────────────────────────────

export async function getProjectInitStatus(): Promise<ProjectInitStatus> {
  return invoke("get_project_init_status");
}

export async function projectAttachFromFile(): Promise<void> {
  return invoke("project_attach_from_file");
}

// ── Old results ─────────────────────────────────────────────────

export async function getOldResults(): Promise<OldResult[]> {
  return invoke("get_old_results");
}

// ── Message count ───────────────────────────────────────────────

export async function getMessageCount(): Promise<number> {
  return invoke("get_message_count");
}

// ── Daily transfer history ──────────────────────────────────────

export async function getDailyXferHistory(): Promise<DailyXferHistory> {
  return invoke("get_daily_xfer_history");
}
