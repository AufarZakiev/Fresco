import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useStatisticsStore } from "./statistics";
import type { ProjectStatistics } from "../types/boinc";

vi.mock("../composables/useRpc", () => ({
  getStatistics: vi.fn(),
}));

import { getStatistics } from "../composables/useRpc";

const mockGetStatistics = vi.mocked(getStatistics);

const sampleStats: ProjectStatistics[] = [
  {
    master_url: "https://example.com/",
    daily_statistics: [
      { day: 1700000000, user_total_credit: 1000, user_expavg_credit: 100, host_total_credit: 500, host_expavg_credit: 50 },
    ],
  },
];

describe("useStatisticsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts with empty stats", () => {
    const store = useStatisticsStore();
    expect(store.projectStats).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it("fetchStatistics populates data", async () => {
    mockGetStatistics.mockResolvedValueOnce(sampleStats);
    const store = useStatisticsStore();
    await store.fetchStatistics();
    expect(store.projectStats).toEqual(sampleStats);
    expect(store.loading).toBe(false);
  });

  it("fetchStatistics sets error on failure", async () => {
    mockGetStatistics.mockRejectedValueOnce(new Error("Timeout"));
    const store = useStatisticsStore();
    await store.fetchStatistics();
    expect(store.error).toBe("Error: Timeout");
    expect(store.loading).toBe(false);
  });

  it("polls and stops", async () => {
    mockGetStatistics.mockResolvedValue(sampleStats);
    const store = useStatisticsStore();
    store.startPolling(1000);

    await vi.advanceTimersByTimeAsync(100);
    const initialCalls = mockGetStatistics.mock.calls.length;
    expect(initialCalls).toBeGreaterThanOrEqual(1);

    store.stopPolling();
    const afterStop = mockGetStatistics.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(mockGetStatistics.mock.calls.length).toBe(afterStop);
  });
});
