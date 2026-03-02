import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDiskUsageStore } from "./diskUsage";
import { useConnectionStore } from "./connection";
import type { DiskUsage } from "../types/boinc";

vi.mock("../composables/useRpc", () => ({
  getDiskUsage: vi.fn(),
}));

import { getDiskUsage } from "../composables/useRpc";

const mockGetDiskUsage = vi.mocked(getDiskUsage);

const sampleUsage: DiskUsage = {
  projects: [{ master_url: "https://example.com/", disk_usage: 5000000 }],
  d_total: 500000000000,
  d_free: 200000000000,
  d_boinc: 5000000,
  d_allowed: 100000000000,
};

describe("useDiskUsageStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts with empty usage", () => {
    const store = useDiskUsageStore();
    expect(store.usage.d_total).toBe(0);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it("fetchDiskUsage populates data", async () => {
    mockGetDiskUsage.mockResolvedValueOnce(sampleUsage);
    const store = useDiskUsageStore();
    await store.fetchDiskUsage();
    expect(store.usage).toEqual(sampleUsage);
    expect(store.loading).toBe(false);
  });

  it("fetchDiskUsage sets error on failure", async () => {
    mockGetDiskUsage.mockRejectedValueOnce(new Error("Network error"));
    const store = useDiskUsageStore();
    await store.fetchDiskUsage();
    expect(store.error).toBe("Network error");
    expect(store.loading).toBe(false);
  });

  it("fetchDiskUsage triggers handleConnectionError on failure", async () => {
    mockGetDiskUsage.mockRejectedValueOnce(new Error("Network error"));
    const connection = useConnectionStore();
    const spy = vi.spyOn(connection, "handleConnectionError");

    const store = useDiskUsageStore();
    await store.fetchDiskUsage();

    expect(spy).toHaveBeenCalledOnce();
  });

  it("polls and stops", async () => {
    mockGetDiskUsage.mockResolvedValue(sampleUsage);
    const store = useDiskUsageStore();
    store.startPolling(1000);

    await vi.advanceTimersByTimeAsync(100);
    const initialCalls = mockGetDiskUsage.mock.calls.length;
    expect(initialCalls).toBeGreaterThanOrEqual(1);

    store.stopPolling();
    const afterStop = mockGetDiskUsage.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(mockGetDiskUsage.mock.calls.length).toBe(afterStop);
  });
});
