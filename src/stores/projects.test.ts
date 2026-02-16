import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useProjectsStore } from "./projects";
import type { Project } from "../types/boinc";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    master_url: "https://example.com/project/",
    project_name: "Example Project",
    user_name: "testuser",
    team_name: "Test Team",
    user_total_credit: 12345,
    user_expavg_credit: 100,
    host_total_credit: 5000,
    host_expavg_credit: 50,
    suspended_via_gui: false,
    dont_request_more_work: false,
    resource_share: 100,
    hostid: 0,
    disk_usage: 0,
    nrpc_failures: 0,
    min_rpc_time: 0,
    download_backoff: 0,
    upload_backoff: 0,
    sched_priority: 0,
    duration_correction_factor: 0,
    last_rpc_time: 0,
    njobs_success: 0,
    njobs_error: 0,
    venue: "",
    gui_urls: [],
    ...overrides,
  };
}

describe("useProjectsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts with empty state", () => {
    const store = useProjectsStore();
    expect(store.projects).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it("fetches projects via RPC", async () => {
    const projects = [makeProject()];
    mockInvoke.mockResolvedValueOnce(projects);

    const store = useProjectsStore();
    await store.fetchProjects();

    expect(mockInvoke).toHaveBeenCalledWith("get_project_status");
    expect(store.projects).toEqual(projects);
  });

  it("suspendProject calls RPC and refreshes", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce([makeProject({ suspended_via_gui: true })]);

    const store = useProjectsStore();
    await store.suspendProject("https://example.com/project/");

    expect(mockInvoke).toHaveBeenCalledWith("suspend_project", {
      projectUrl: "https://example.com/project/",
    });
  });

  it("resumeProject calls RPC and refreshes", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce([makeProject()]);

    const store = useProjectsStore();
    await store.resumeProject("https://example.com/project/");

    expect(mockInvoke).toHaveBeenCalledWith("resume_project", {
      projectUrl: "https://example.com/project/",
    });
  });

  it("updateProject calls RPC and refreshes", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce([makeProject()]);

    const store = useProjectsStore();
    await store.updateProject("https://example.com/project/");

    expect(mockInvoke).toHaveBeenCalledWith("update_project", {
      projectUrl: "https://example.com/project/",
    });
  });

  it("noNewTasks calls RPC and refreshes", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce([
      makeProject({ dont_request_more_work: true }),
    ]);

    const store = useProjectsStore();
    await store.noNewTasks("https://example.com/project/");

    expect(mockInvoke).toHaveBeenCalledWith("no_new_tasks_project", {
      projectUrl: "https://example.com/project/",
    });
  });

  it("allowNewTasks calls RPC and refreshes", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce([makeProject()]);

    const store = useProjectsStore();
    await store.allowNewTasks("https://example.com/project/");

    expect(mockInvoke).toHaveBeenCalledWith("allow_new_tasks_project", {
      projectUrl: "https://example.com/project/",
    });
  });

  it("resetProject calls RPC and refreshes", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce([]);

    const store = useProjectsStore();
    await store.resetProject("https://example.com/project/");

    expect(mockInvoke).toHaveBeenCalledWith("reset_project", {
      projectUrl: "https://example.com/project/",
    });
  });

  it("detachProject calls RPC and refreshes", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce([]);

    const store = useProjectsStore();
    await store.detachProject("https://example.com/project/");

    expect(mockInvoke).toHaveBeenCalledWith("detach_project", {
      projectUrl: "https://example.com/project/",
    });
  });

  it("polls and stops", async () => {
    mockInvoke.mockResolvedValue([]);

    const store = useProjectsStore();
    store.startPolling(1000);

    await vi.advanceTimersByTimeAsync(100);
    const initialCalls = mockInvoke.mock.calls.length;
    expect(initialCalls).toBeGreaterThanOrEqual(1);

    store.stopPolling();
    const afterStop = mockInvoke.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(mockInvoke.mock.calls.length).toBe(afterStop);
  });
});
