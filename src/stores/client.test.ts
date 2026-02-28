import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useClientStore } from "./client";
import type { CcStatus } from "../types/boinc";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

function makeStatus(overrides: Partial<CcStatus> = {}): CcStatus {
  return {
    task_mode: 2,
    task_mode_perm: 2,
    task_mode_delay: 0,
    gpu_mode: 2,
    gpu_mode_perm: 2,
    gpu_mode_delay: 0,
    network_mode: 2,
    network_mode_perm: 2,
    network_mode_delay: 0,
    network_status: 0,
    task_suspend_reason: 0,
    gpu_suspend_reason: 0,
    network_suspend_reason: 0,
    ams_password_error: false,
    manager_must_quit: false,
    disallow_attach: false,
    simple_gui_only: false,
    max_event_log_lines: 0,
    ...overrides,
  };
}

describe("useClientStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts with default status", () => {
    const store = useClientStore();
    expect(store.status.task_mode).toBe(0);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it("fetches status via RPC", async () => {
    const status = makeStatus();
    mockInvoke.mockResolvedValueOnce(status);

    const store = useClientStore();
    await store.fetchStatus();

    expect(mockInvoke).toHaveBeenCalledWith("get_cc_status");
    expect(store.status.task_mode).toBe(2);
  });

  it("setRunMode calls RPC and refreshes", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce(makeStatus({ task_mode_perm: 1 }));

    const store = useClientStore();
    await store.setRunMode(1);

    expect(mockInvoke).toHaveBeenCalledWith("set_run_mode", {
      mode: 1,
      duration: 0,
    });
  });

  it("setGpuMode calls RPC and refreshes", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce(makeStatus({ gpu_mode_perm: 3 }));

    const store = useClientStore();
    await store.setGpuMode(3);

    expect(mockInvoke).toHaveBeenCalledWith("set_gpu_mode", {
      mode: 3,
      duration: 0,
    });
  });

  it("setNetworkMode calls RPC and refreshes", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce(makeStatus({ network_mode_perm: 1 }));

    const store = useClientStore();
    await store.setNetworkMode(1);

    expect(mockInvoke).toHaveBeenCalledWith("set_network_mode", {
      mode: 1,
      duration: 0,
    });
  });

  it("runBenchmarks calls RPC", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const store = useClientStore();
    await store.runBenchmarks();

    expect(mockInvoke).toHaveBeenCalledWith("run_benchmarks");
  });

  it("retryPendingTransfers calls RPC", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const store = useClientStore();
    await store.retryPendingTransfers();

    expect(mockInvoke).toHaveBeenCalledWith("retry_pending_transfers");
  });

  it("shutdownClient calls RPC", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const store = useClientStore();
    await store.shutdownClient();

    expect(mockInvoke).toHaveBeenCalledWith("shutdown_client");
  });

  it("polls and stops", async () => {
    mockInvoke.mockResolvedValue(makeStatus());

    const store = useClientStore();
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
