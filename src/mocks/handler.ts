/**
 * IPC mock handler — dispatches invoke commands to mock data.
 * Used when running in a regular browser (no Tauri runtime).
 */
import type { InvokeArgs } from "@tauri-apps/api/core";

import { mockProjects } from "./data/projects";
import { mockTasks } from "./data/tasks";
import { mockTransfers } from "./data/transfers";
import { mockStatistics } from "./data/statistics";
import { mockMessages } from "./data/messages";
import { mockNotices } from "./data/notices";
import { mockDiskUsage } from "./data/diskUsage";
import { mockHostInfo } from "./data/hostInfo";
import { mockCcStatus } from "./data/ccStatus";
import { mockPreferences } from "./data/preferences";
import { mockCcConfig } from "./data/ccConfig";
import {
  mockProxyInfo,
  mockVersionInfo,
  mockAcctMgrInfo,
  mockNewerVersion,
  mockProjectInitStatus,
  mockDailyXferHistory,
  mockCcState,
  mockOldResults,
  mockAllProjectsList,
} from "./data/misc";
import { CONNECTION_STATE } from "../types/boinc";

export function handleIpc(cmd: string, payload?: InvokeArgs): unknown {
  switch (cmd) {
    // ── Connection ─────────────────────────────
    case "get_connection_state":
      return CONNECTION_STATE.CONNECTED;
    case "connect_local":
    case "connect":
    case "disconnect":
      return undefined;

    // ── Read operations ────────────────────────
    case "get_results":
      return mockTasks;
    case "get_project_status":
      return mockProjects;
    case "get_cc_status":
      return mockCcStatus;
    case "get_transfers":
      return mockTransfers;
    case "get_statistics":
      return mockStatistics;
    case "get_messages": {
      const seqno =
        ((payload as Record<string, unknown>)?.seqno as number) ?? 0;
      return mockMessages.filter((m) => m.seqno > seqno);
    }
    case "get_message_count":
      return mockMessages.length;
    case "get_notices": {
      const seqno =
        ((payload as Record<string, unknown>)?.seqno as number) ?? 0;
      return mockNotices.filter((n) => n.seqno > seqno);
    }
    case "get_disk_usage":
      return mockDiskUsage;
    case "get_host_info":
      return mockHostInfo;
    case "get_preferences":
    case "get_global_prefs_working":
    case "get_global_prefs_file":
      return mockPreferences;
    case "get_cc_config":
      return mockCcConfig;
    case "get_proxy_settings":
      return mockProxyInfo;
    case "exchange_versions":
      return mockVersionInfo;
    case "get_newer_version":
      return mockNewerVersion;
    case "acct_mgr_info":
      return mockAcctMgrInfo;
    case "get_project_init_status":
      return mockProjectInitStatus;
    case "get_daily_xfer_history":
      return mockDailyXferHistory;
    case "get_state":
      return mockCcState;
    case "get_old_results":
      return mockOldResults;
    case "get_all_projects_list":
      return mockAllProjectsList;
    case "get_build_time":
      return "mock-dev-build";
    case "get_platform":
      return "macos";
    case "get_arch":
      return "arm64";
    case "detect_boinc_client_dir":
      return "/Applications/BOINCManager.app/Contents/Resources";
    case "download_update":
      return undefined;

    // ── Write / action commands (no-op) ────────
    case "suspend_task":
    case "resume_task":
    case "abort_task":
    case "suspend_project":
    case "resume_project":
    case "update_project":
    case "no_new_tasks_project":
    case "allow_new_tasks_project":
    case "reset_project":
    case "detach_project":
    case "set_run_mode":
    case "set_gpu_mode":
    case "set_network_mode":
    case "retry_transfer":
    case "abort_transfer":
    case "retry_pending_transfers":
    case "run_benchmarks":
    case "shutdown_client":
    case "start_boinc_client":
    case "set_preferences":
    case "set_proxy_settings":
    case "set_cc_config":
    case "read_global_prefs_override":
    case "read_cc_config":
    case "set_language":
    case "project_attach_from_file":
    case "cleanup_old_binary":
    case "install_update":
    case "update_now":
    case "launch_graphics":
    case "launch_remote_desktop":
      return undefined;

    // ── Async polling commands (return neutral) ─
    case "lookup_account":
    case "create_account":
    case "project_attach":
    case "get_project_config":
    case "acct_mgr_rpc":
      return undefined;
    case "lookup_account_poll":
      return { error_num: 0, authenticator: "mock_auth_token", error_msg: "" };
    case "create_account_poll":
      return { error_num: 0, authenticator: "mock_auth_token", error_msg: "" };
    case "project_attach_poll":
      return { error_num: 0, messages: [] };
    case "get_project_config_poll":
      return {
        error_num: 0,
        name: "Mock Project",
        master_url: "",
        min_passwd_length: 6,
        account_creation_disabled: false,
        client_account_creation_disabled: false,
        uses_username: false,
        web_stopped: false,
        sched_stopped: false,
        platforms: [],
        terms_of_use: "",
        terms_of_use_is_html: false,
        ldap_auth: false,
      };
    case "acct_mgr_rpc_poll":
      return { error_num: 0, messages: [] };
    case "compute_passwd_hash":
      return "mock_hash_abcdef1234567890";

    default:
      console.warn(`[mock-ipc] Unhandled command: ${cmd}`, payload);
      return undefined;
  }
}
