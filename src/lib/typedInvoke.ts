import { invoke as rawInvoke } from "@tauri-apps/api/core";
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
  ConnectionState,
  ManagerAutostartInfo,
  BoincInstallOptions,
} from "../types/boinc";
import type { OS, Arch } from "../composables/usePlatform";

/**
 * Maps every Tauri command name to its argument object and return type.
 * Adding/removing/renaming a command here will cause type errors at every
 * call site, so frontend-Rust drift is caught at type-check time.
 */
interface CommandMap {
  // Connection
  connect: { args: { host: string; port: number; password: string }; ret: void };
  connect_local: { args: { dataDir: string }; ret: void };
  disconnect: { args: Record<string, never>; ret: void };
  get_connection_state: { args: Record<string, never>; ret: ConnectionState };

  // Read operations
  get_results: { args: { activeOnly: boolean }; ret: TaskResult[] };
  get_project_status: { args: Record<string, never>; ret: Project[] };
  get_cc_status: { args: Record<string, never>; ret: CcStatus };
  get_transfers: { args: Record<string, never>; ret: FileTransfer[] };

  // Task actions
  suspend_task: { args: { projectUrl: string; name: string }; ret: void };
  resume_task: { args: { projectUrl: string; name: string }; ret: void };
  abort_task: { args: { projectUrl: string; name: string }; ret: void };

  // Project actions
  suspend_project: { args: { projectUrl: string }; ret: void };
  resume_project: { args: { projectUrl: string }; ret: void };
  update_project: { args: { projectUrl: string }; ret: void };
  no_new_tasks_project: { args: { projectUrl: string }; ret: void };
  allow_new_tasks_project: { args: { projectUrl: string }; ret: void };
  reset_project: { args: { projectUrl: string }; ret: void };
  detach_project: { args: { projectUrl: string }; ret: void };

  // Mode controls
  set_run_mode: { args: { mode: number; duration: number }; ret: void };
  set_gpu_mode: { args: { mode: number; duration: number }; ret: void };
  set_network_mode: { args: { mode: number; duration: number }; ret: void };

  // Transfer actions
  retry_transfer: { args: { projectUrl: string; filename: string }; ret: void };
  abort_transfer: { args: { projectUrl: string; filename: string }; ret: void };

  // BOINC client launcher
  start_boinc_client: { args: { dataDir: string; clientDir: string }; ret: void };
  detect_boinc_client_dir: { args: Record<string, never>; ret: string };

  // BOINC install onboarding (first run, no binary)
  detect_boinc_install_options: {
    args: Record<string, never>;
    ret: BoincInstallOptions;
  };
  install_boinc_via_brew: { args: Record<string, never>; ret: void };

  // BOINC Manager takeover (onboarding)
  detect_boinc_manager_autostart: {
    args: Record<string, never>;
    ret: ManagerAutostartInfo | null;
  };
  disable_boinc_manager_autostart: {
    args: { info: ManagerAutostartInfo };
    ret: void;
  };
  open_login_items_settings: { args: Record<string, never>; ret: void };

  // Other
  run_benchmarks: { args: Record<string, never>; ret: void };
  retry_pending_transfers: { args: Record<string, never>; ret: void };
  shutdown_client: { args: Record<string, never>; ret: void };

  // Statistics
  get_statistics: { args: Record<string, never>; ret: ProjectStatistics[] };

  // Messages & Notices
  get_messages: { args: { seqno: number }; ret: Message[] };
  get_notices: { args: { seqno: number }; ret: Notice[] };

  // Disk usage
  get_disk_usage: { args: Record<string, never>; ret: DiskUsage };

  // Preferences
  get_preferences: { args: Record<string, never>; ret: GlobalPreferences };
  set_preferences: { args: { prefs: GlobalPreferences }; ret: void };

  // Host info
  get_host_info: { args: Record<string, never>; ret: HostInfo };

  // Project attach
  get_all_projects_list: { args: Record<string, never>; ret: ProjectListEntry[] };
  lookup_account: { args: { url: string; email: string; password: string }; ret: void };
  lookup_account_poll: { args: Record<string, never>; ret: AccountOut };
  project_attach: { args: { url: string; authenticator: string; name: string }; ret: void };
  project_attach_poll: { args: Record<string, never>; ret: ProjectAttachReply };

  // Project config
  get_project_config: { args: { url: string }; ret: void };
  get_project_config_poll: { args: Record<string, never>; ret: ProjectConfig };
  create_account: {
    args: { url: string; email: string; passwdHash: string; userName: string; teamName: string };
    ret: void;
  };
  create_account_poll: { args: Record<string, never>; ret: AccountOut };
  compute_passwd_hash: { args: { email: string; password: string }; ret: string };

  // Account manager
  acct_mgr_info: { args: Record<string, never>; ret: AcctMgrInfo };
  acct_mgr_rpc: { args: { url: string; name: string; password: string }; ret: void };
  acct_mgr_rpc_poll: { args: Record<string, never>; ret: AcctMgrRpcReply };

  // Proxy settings
  get_proxy_settings: { args: Record<string, never>; ret: ProxyInfo };
  set_proxy_settings: { args: { proxy: ProxyInfo }; ret: void };

  // CC Config
  get_cc_config: { args: Record<string, never>; ret: CcConfig };
  set_cc_config: { args: { config: CcConfig }; ret: void };

  // Version
  get_newer_version: { args: Record<string, never>; ret: NewerVersionInfo };
  exchange_versions: { args: Record<string, never>; ret: VersionInfo };

  // Graphics
  launch_graphics: { args: { path: string }; ret: void };
  launch_remote_desktop: { args: { addr: string }; ret: void };

  // State
  get_state: { args: Record<string, never>; ret: CcState };

  // Read commands
  read_global_prefs_override: { args: Record<string, never>; ret: void };
  read_cc_config: { args: Record<string, never>; ret: void };
  get_global_prefs_working: { args: Record<string, never>; ret: GlobalPreferences };
  get_global_prefs_file: { args: Record<string, never>; ret: GlobalPreferences };

  // Language
  set_language: { args: { lang: string }; ret: void };

  // Project init
  get_project_init_status: { args: Record<string, never>; ret: ProjectInitStatus };
  project_attach_from_file: { args: Record<string, never>; ret: void };

  // Old results
  get_old_results: { args: Record<string, never>; ret: OldResult[] };

  // Message count
  get_message_count: { args: Record<string, never>; ret: number };

  // Daily transfer history
  get_daily_xfer_history: { args: Record<string, never>; ret: DailyXferHistory };

  // Build info
  get_build_time: { args: Record<string, never>; ret: string };
  get_platform: { args: Record<string, never>; ret: OS };
  get_arch: { args: Record<string, never>; ret: Arch };

  // Tray sync
  sync_tray_modes: { args: { taskMode: number; gpuMode: number }; ret: void };

  // Updater
  download_update: { args: { assetUrl: string }; ret: void };
  update_now: { args: { assetUrl: string }; ret: boolean };
  install_update: { args: Record<string, never>; ret: boolean };
  cleanup_old_binary: { args: Record<string, never>; ret: void };
}

type Command = keyof CommandMap;

/**
 * Typed wrapper around Tauri's invoke().
 *
 * For commands with no arguments, call as `invoke("command_name")`.
 * For commands with arguments, call as `invoke("command_name", { ... })`.
 *
 * Both the command name and its argument shape are checked at compile time.
 */
export function invoke<C extends Command>(
  cmd: C,
  ...args: CommandMap[C]["args"] extends Record<string, never>
    ? []
    : [CommandMap[C]["args"]]
): Promise<CommandMap[C]["ret"]> {
  if (args.length === 0) {
    return rawInvoke(cmd);
  }
  return rawInvoke(cmd, args[0] as Record<string, unknown>);
}
