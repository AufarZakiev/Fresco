import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

import { invoke } from "@tauri-apps/api/core";
import {
  connectLocal,
  connect,
  disconnect,
  getConnectionState,
  getResults,
  getProjectStatus,
  getCcStatus,
  getTransfers,
  suspendTask,
  resumeTask,
  abortTask,
  suspendProject,
  resumeProject,
  updateProject,
  noNewTasksProject,
  allowNewTasksProject,
  resetProject,
  detachProject,
  setRunMode,
  setGpuMode,
  setNetworkMode,
  retryTransfer,
  abortTransfer,
  startBoincClient,
  runBenchmarks,
  retryPendingTransfers,
  shutdownClient,
  getStatistics,
  getMessages,
  getNotices,
  getDiskUsage,
  getPreferences,
  setPreferences,
  getHostInfo,
  getAllProjectsList,
  lookupAccount,
  lookupAccountPoll,
  projectAttach,
  projectAttachPoll,
  getProjectConfig,
  getProjectConfigPoll,
  createAccount,
  createAccountPoll,
  computePasswdHash,
  acctMgrInfo,
  acctMgrRpc,
  acctMgrRpcPoll,
  getProxySettings,
  setProxySettings,
  getCcConfig,
  setCcConfig,
  getNewerVersion,
  launchGraphics,
  launchRemoteDesktop,
  exchangeVersions,
  getState,
  getWorkunitApps,
  readGlobalPrefsOverride,
  readCcConfig,
  getGlobalPrefsWorking,
  getGlobalPrefsFile,
  setLanguage,
  getProjectInitStatus,
  projectAttachFromFile,
  getOldResults,
  getMessageCount,
  getDailyXferHistory,
} from "./useRpc";

const mockInvoke = vi.mocked(invoke);

describe("useRpc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Connection ───────────────────────────────────────────────

  describe("connection", () => {
    it("connectLocal passes dataDir", async () => {
      await connectLocal("/data");
      expect(mockInvoke).toHaveBeenCalledWith("connect_local", { dataDir: "/data" });
    });

    it("connect passes host, port, password", async () => {
      await connect("localhost", 31416, "secret");
      expect(mockInvoke).toHaveBeenCalledWith("connect", {
        host: "localhost",
        port: 31416,
        password: "secret",
      });
    });

    it("disconnect calls with no args", async () => {
      await disconnect();
      expect(mockInvoke).toHaveBeenCalledWith("disconnect");
    });

    it("getConnectionState calls correct command", async () => {
      mockInvoke.mockResolvedValueOnce("connected");
      const result = await getConnectionState();
      expect(mockInvoke).toHaveBeenCalledWith("get_connection_state");
      expect(result).toBe("connected");
    });
  });

  // ── Read operations ──────────────────────────────────────────

  describe("read operations", () => {
    it("getResults passes activeOnly flag", async () => {
      await getResults(true);
      expect(mockInvoke).toHaveBeenCalledWith("get_results", { activeOnly: true });
    });

    it("getProjectStatus calls correct command", async () => {
      await getProjectStatus();
      expect(mockInvoke).toHaveBeenCalledWith("get_project_status");
    });

    it("getCcStatus calls correct command", async () => {
      await getCcStatus();
      expect(mockInvoke).toHaveBeenCalledWith("get_cc_status");
    });

    it("getTransfers calls correct command", async () => {
      await getTransfers();
      expect(mockInvoke).toHaveBeenCalledWith("get_transfers");
    });

    it("getStatistics calls correct command", async () => {
      await getStatistics();
      expect(mockInvoke).toHaveBeenCalledWith("get_statistics");
    });

    it("getMessages passes seqno", async () => {
      await getMessages(42);
      expect(mockInvoke).toHaveBeenCalledWith("get_messages", { seqno: 42 });
    });

    it("getNotices passes seqno", async () => {
      await getNotices(10);
      expect(mockInvoke).toHaveBeenCalledWith("get_notices", { seqno: 10 });
    });

    it("getDiskUsage calls correct command", async () => {
      await getDiskUsage();
      expect(mockInvoke).toHaveBeenCalledWith("get_disk_usage");
    });

    it("getHostInfo calls correct command", async () => {
      await getHostInfo();
      expect(mockInvoke).toHaveBeenCalledWith("get_host_info");
    });

    it("getState calls correct command", async () => {
      await getState();
      expect(mockInvoke).toHaveBeenCalledWith("get_state");
    });

    it("getWorkunitApps calls correct command", async () => {
      await getWorkunitApps();
      expect(mockInvoke).toHaveBeenCalledWith("get_workunit_apps");
    });
  });

  // ── Task actions ──────────────────────────────────────────────

  describe("task actions", () => {
    it("suspendTask passes projectUrl and name", async () => {
      await suspendTask("http://project.com", "task_1");
      expect(mockInvoke).toHaveBeenCalledWith("suspend_task", {
        projectUrl: "http://project.com",
        name: "task_1",
      });
    });

    it("resumeTask passes projectUrl and name", async () => {
      await resumeTask("http://project.com", "task_1");
      expect(mockInvoke).toHaveBeenCalledWith("resume_task", {
        projectUrl: "http://project.com",
        name: "task_1",
      });
    });

    it("abortTask passes projectUrl and name", async () => {
      await abortTask("http://project.com", "task_1");
      expect(mockInvoke).toHaveBeenCalledWith("abort_task", {
        projectUrl: "http://project.com",
        name: "task_1",
      });
    });
  });

  // ── Project actions ──────────────────────────────────────────

  describe("project actions", () => {
    const url = "http://example.com/project";

    it("suspendProject", async () => {
      await suspendProject(url);
      expect(mockInvoke).toHaveBeenCalledWith("suspend_project", { projectUrl: url });
    });

    it("resumeProject", async () => {
      await resumeProject(url);
      expect(mockInvoke).toHaveBeenCalledWith("resume_project", { projectUrl: url });
    });

    it("updateProject", async () => {
      await updateProject(url);
      expect(mockInvoke).toHaveBeenCalledWith("update_project", { projectUrl: url });
    });

    it("noNewTasksProject", async () => {
      await noNewTasksProject(url);
      expect(mockInvoke).toHaveBeenCalledWith("no_new_tasks_project", { projectUrl: url });
    });

    it("allowNewTasksProject", async () => {
      await allowNewTasksProject(url);
      expect(mockInvoke).toHaveBeenCalledWith("allow_new_tasks_project", { projectUrl: url });
    });

    it("resetProject", async () => {
      await resetProject(url);
      expect(mockInvoke).toHaveBeenCalledWith("reset_project", { projectUrl: url });
    });

    it("detachProject", async () => {
      await detachProject(url);
      expect(mockInvoke).toHaveBeenCalledWith("detach_project", { projectUrl: url });
    });
  });

  // ── Mode controls ─────────────────────────────────────────────

  describe("mode controls", () => {
    it("setRunMode passes mode and duration", async () => {
      await setRunMode(1, 3600);
      expect(mockInvoke).toHaveBeenCalledWith("set_run_mode", { mode: 1, duration: 3600 });
    });

    it("setGpuMode passes mode and duration", async () => {
      await setGpuMode(2, 0);
      expect(mockInvoke).toHaveBeenCalledWith("set_gpu_mode", { mode: 2, duration: 0 });
    });

    it("setNetworkMode passes mode and duration", async () => {
      await setNetworkMode(3, 7200);
      expect(mockInvoke).toHaveBeenCalledWith("set_network_mode", { mode: 3, duration: 7200 });
    });
  });

  // ── Transfer actions ──────────────────────────────────────────

  describe("transfer actions", () => {
    it("retryTransfer passes projectUrl and filename", async () => {
      await retryTransfer("http://p.com", "file.zip");
      expect(mockInvoke).toHaveBeenCalledWith("retry_transfer", {
        projectUrl: "http://p.com",
        filename: "file.zip",
      });
    });

    it("abortTransfer passes projectUrl and filename", async () => {
      await abortTransfer("http://p.com", "file.zip");
      expect(mockInvoke).toHaveBeenCalledWith("abort_transfer", {
        projectUrl: "http://p.com",
        filename: "file.zip",
      });
    });
  });

  // ── Client launcher ───────────────────────────────────────────

  describe("client launcher", () => {
    it("startBoincClient passes dataDir and clientDir", async () => {
      await startBoincClient("/data", "/usr/bin");
      expect(mockInvoke).toHaveBeenCalledWith("start_boinc_client", {
        dataDir: "/data",
        clientDir: "/usr/bin",
      });
    });

    it("startBoincClient defaults clientDir to empty string", async () => {
      await startBoincClient("/data");
      expect(mockInvoke).toHaveBeenCalledWith("start_boinc_client", {
        dataDir: "/data",
        clientDir: "",
      });
    });
  });

  // ── Other actions ─────────────────────────────────────────────

  describe("other actions", () => {
    it("runBenchmarks", async () => {
      await runBenchmarks();
      expect(mockInvoke).toHaveBeenCalledWith("run_benchmarks");
    });

    it("retryPendingTransfers", async () => {
      await retryPendingTransfers();
      expect(mockInvoke).toHaveBeenCalledWith("retry_pending_transfers");
    });

    it("shutdownClient", async () => {
      await shutdownClient();
      expect(mockInvoke).toHaveBeenCalledWith("shutdown_client");
    });
  });

  // ── Preferences ───────────────────────────────────────────────

  describe("preferences", () => {
    it("getPreferences calls correct command", async () => {
      await getPreferences();
      expect(mockInvoke).toHaveBeenCalledWith("get_preferences");
    });

    it("setPreferences passes prefs object", async () => {
      const prefs = { cpu_usage_limit: 80 } as never;
      await setPreferences(prefs);
      expect(mockInvoke).toHaveBeenCalledWith("set_preferences", { prefs });
    });
  });

  // ── Project attach ────────────────────────────────────────────

  describe("project attach", () => {
    it("getAllProjectsList calls correct command", async () => {
      await getAllProjectsList();
      expect(mockInvoke).toHaveBeenCalledWith("get_all_projects_list");
    });

    it("lookupAccount passes url, email, password", async () => {
      await lookupAccount("http://p.com", "a@b.com", "pass");
      expect(mockInvoke).toHaveBeenCalledWith("lookup_account", {
        url: "http://p.com",
        email: "a@b.com",
        password: "pass",
      });
    });

    it("lookupAccountPoll calls correct command", async () => {
      await lookupAccountPoll();
      expect(mockInvoke).toHaveBeenCalledWith("lookup_account_poll");
    });

    it("projectAttach passes url, authenticator, name", async () => {
      await projectAttach("http://p.com", "auth123", "My Project");
      expect(mockInvoke).toHaveBeenCalledWith("project_attach", {
        url: "http://p.com",
        authenticator: "auth123",
        name: "My Project",
      });
    });

    it("projectAttachPoll calls correct command", async () => {
      await projectAttachPoll();
      expect(mockInvoke).toHaveBeenCalledWith("project_attach_poll");
    });

    it("getProjectConfig passes url", async () => {
      await getProjectConfig("http://p.com");
      expect(mockInvoke).toHaveBeenCalledWith("get_project_config", { url: "http://p.com" });
    });

    it("getProjectConfigPoll calls correct command", async () => {
      await getProjectConfigPoll();
      expect(mockInvoke).toHaveBeenCalledWith("get_project_config_poll");
    });

    it("createAccount passes all fields", async () => {
      await createAccount("http://p.com", "a@b.com", "hash", "User", "Team");
      expect(mockInvoke).toHaveBeenCalledWith("create_account", {
        url: "http://p.com",
        email: "a@b.com",
        passwdHash: "hash",
        userName: "User",
        teamName: "Team",
      });
    });

    it("createAccountPoll calls correct command", async () => {
      await createAccountPoll();
      expect(mockInvoke).toHaveBeenCalledWith("create_account_poll");
    });

    it("computePasswdHash passes email and password", async () => {
      mockInvoke.mockResolvedValueOnce("hashed");
      const result = await computePasswdHash("a@b.com", "pass");
      expect(mockInvoke).toHaveBeenCalledWith("compute_passwd_hash", {
        email: "a@b.com",
        password: "pass",
      });
      expect(result).toBe("hashed");
    });
  });

  // ── Account manager ───────────────────────────────────────────

  describe("account manager", () => {
    it("acctMgrInfo calls correct command", async () => {
      await acctMgrInfo();
      expect(mockInvoke).toHaveBeenCalledWith("acct_mgr_info");
    });

    it("acctMgrRpc passes url, name, password", async () => {
      await acctMgrRpc("http://mgr.com", "user", "pass");
      expect(mockInvoke).toHaveBeenCalledWith("acct_mgr_rpc", {
        url: "http://mgr.com",
        name: "user",
        password: "pass",
      });
    });

    it("acctMgrRpcPoll calls correct command", async () => {
      await acctMgrRpcPoll();
      expect(mockInvoke).toHaveBeenCalledWith("acct_mgr_rpc_poll");
    });
  });

  // ── Proxy / CC Config ─────────────────────────────────────────

  describe("proxy and cc config", () => {
    it("getProxySettings calls correct command", async () => {
      await getProxySettings();
      expect(mockInvoke).toHaveBeenCalledWith("get_proxy_settings");
    });

    it("setProxySettings passes proxy object", async () => {
      const proxy = { http_server_name: "proxy.local" } as never;
      await setProxySettings(proxy);
      expect(mockInvoke).toHaveBeenCalledWith("set_proxy_settings", { proxy });
    });

    it("getCcConfig calls correct command", async () => {
      await getCcConfig();
      expect(mockInvoke).toHaveBeenCalledWith("get_cc_config");
    });

    it("setCcConfig passes config object", async () => {
      const config = { log_flags: {} } as never;
      await setCcConfig(config);
      expect(mockInvoke).toHaveBeenCalledWith("set_cc_config", { config });
    });
  });

  // ── Misc ──────────────────────────────────────────────────────

  describe("misc", () => {
    it("getNewerVersion calls correct command", async () => {
      await getNewerVersion();
      expect(mockInvoke).toHaveBeenCalledWith("get_newer_version");
    });

    it("launchGraphics passes path", async () => {
      await launchGraphics("/usr/bin/graphics");
      expect(mockInvoke).toHaveBeenCalledWith("launch_graphics", { path: "/usr/bin/graphics" });
    });

    it("launchRemoteDesktop passes addr", async () => {
      await launchRemoteDesktop("192.168.1.1");
      expect(mockInvoke).toHaveBeenCalledWith("launch_remote_desktop", { addr: "192.168.1.1" });
    });

    it("exchangeVersions calls correct command", async () => {
      await exchangeVersions();
      expect(mockInvoke).toHaveBeenCalledWith("exchange_versions");
    });

    it("readGlobalPrefsOverride calls correct command", async () => {
      await readGlobalPrefsOverride();
      expect(mockInvoke).toHaveBeenCalledWith("read_global_prefs_override");
    });

    it("readCcConfig calls correct command", async () => {
      await readCcConfig();
      expect(mockInvoke).toHaveBeenCalledWith("read_cc_config");
    });

    it("getGlobalPrefsWorking calls correct command", async () => {
      await getGlobalPrefsWorking();
      expect(mockInvoke).toHaveBeenCalledWith("get_global_prefs_working");
    });

    it("getGlobalPrefsFile calls correct command", async () => {
      await getGlobalPrefsFile();
      expect(mockInvoke).toHaveBeenCalledWith("get_global_prefs_file");
    });

    it("setLanguage passes lang", async () => {
      await setLanguage("ru");
      expect(mockInvoke).toHaveBeenCalledWith("set_language", { lang: "ru" });
    });

    it("getProjectInitStatus calls correct command", async () => {
      await getProjectInitStatus();
      expect(mockInvoke).toHaveBeenCalledWith("get_project_init_status");
    });

    it("projectAttachFromFile calls correct command", async () => {
      await projectAttachFromFile();
      expect(mockInvoke).toHaveBeenCalledWith("project_attach_from_file");
    });

    it("getOldResults calls correct command", async () => {
      await getOldResults();
      expect(mockInvoke).toHaveBeenCalledWith("get_old_results");
    });

    it("getMessageCount calls correct command", async () => {
      await getMessageCount();
      expect(mockInvoke).toHaveBeenCalledWith("get_message_count");
    });

    it("getDailyXferHistory calls correct command", async () => {
      await getDailyXferHistory();
      expect(mockInvoke).toHaveBeenCalledWith("get_daily_xfer_history");
    });
  });

  // ── Error propagation ─────────────────────────────────────────

  describe("error propagation", () => {
    it("propagates invoke rejection", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Connection refused"));
      await expect(connect("localhost", 31416, "")).rejects.toThrow("Connection refused");
    });

    it("propagates invoke rejection for read operations", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Not connected"));
      await expect(getResults(true)).rejects.toThrow("Not connected");
    });
  });
});
