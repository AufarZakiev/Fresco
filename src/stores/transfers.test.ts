import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useTransfersStore } from "./transfers";
import type { FileTransfer } from "../types/boinc";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

function makeTransfer(overrides: Partial<FileTransfer> = {}): FileTransfer {
  return {
    project_url: "https://example.com/project/",
    project_name: "Example Project",
    name: "data_file_001.zip",
    nbytes: 1048576,
    status: 0,
    bytes_xferred: 524288,
    xfer_speed: 65536,
    is_upload: false,
    num_retries: 0,
    first_request_time: 0,
    next_request_time: 0,
    time_so_far: 0,
    estimated_xfer_time_remaining: 0,
    file_offset: 0,
    hostname: "",
    project_backoff: 0,
    ...overrides,
  };
}

describe("useTransfersStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts with empty state", () => {
    const store = useTransfersStore();
    expect(store.transfers).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it("fetches transfers via RPC", async () => {
    const transfers = [makeTransfer()];
    mockInvoke.mockResolvedValueOnce(transfers);

    const store = useTransfersStore();
    await store.fetchTransfers();

    expect(mockInvoke).toHaveBeenCalledWith("get_transfers");
    expect(store.transfers).toEqual(transfers);
  });

  it("retryTransfer calls RPC and refreshes", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce([makeTransfer()]);

    const store = useTransfersStore();
    await store.retryTransfer(
      "https://example.com/project/",
      "data_file_001.zip",
    );

    expect(mockInvoke).toHaveBeenCalledWith("retry_transfer", {
      projectUrl: "https://example.com/project/",
      filename: "data_file_001.zip",
    });
  });

  it("abortTransfer calls RPC and refreshes", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce([]);

    const store = useTransfersStore();
    await store.abortTransfer(
      "https://example.com/project/",
      "data_file_001.zip",
    );

    expect(mockInvoke).toHaveBeenCalledWith("abort_transfer", {
      projectUrl: "https://example.com/project/",
      filename: "data_file_001.zip",
    });
  });

  it("polls and stops", async () => {
    mockInvoke.mockResolvedValue([]);

    const store = useTransfersStore();
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
