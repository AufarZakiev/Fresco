import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useNoticesStore } from "./notices";
import { useConnectionStore } from "./connection";
import type { Notice } from "../types/boinc";

vi.mock("../composables/useRpc", () => ({
  getNotices: vi.fn(),
}));

vi.mock("../composables/useNotifications", () => ({
  notifyNewNotices: vi.fn(),
}));

import { getNotices } from "../composables/useRpc";
import { notifyNewNotices } from "../composables/useNotifications";

const mockGetNotices = vi.mocked(getNotices);
const mockNotify = vi.mocked(notifyNewNotices);

function makeNotice(seqno: number, overrides: Partial<Notice> = {}): Notice {
  return {
    seqno,
    title: `Notice ${seqno}`,
    description: "A notice",
    create_time: 1700000000 + seqno,
    category: "client",
    link: "",
    project_name: "",
    is_private: false,
    ...overrides,
  };
}

describe("useNoticesStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts with empty notices", () => {
    const store = useNoticesStore();
    expect(store.notices).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it("fetchNotices appends new notices and updates lastSeqno", async () => {
    const notices = [makeNotice(1), makeNotice(2)];
    mockGetNotices.mockResolvedValueOnce(notices);

    const store = useNoticesStore();
    await store.fetchNotices();

    expect(store.notices).toEqual(notices);
    expect(mockGetNotices).toHaveBeenCalledWith(0);
    expect(mockNotify).toHaveBeenCalledWith(2);
  });

  it("fetchNotices accumulates across calls", async () => {
    mockGetNotices.mockResolvedValueOnce([makeNotice(1)]);
    const store = useNoticesStore();
    await store.fetchNotices();

    mockGetNotices.mockResolvedValueOnce([makeNotice(2), makeNotice(3)]);
    await store.fetchNotices();

    expect(store.notices).toHaveLength(3);
    expect(mockGetNotices).toHaveBeenLastCalledWith(1);
  });

  it("fetchNotices does not notify when no new notices", async () => {
    mockGetNotices.mockResolvedValueOnce([]);
    const store = useNoticesStore();
    await store.fetchNotices();

    expect(store.notices).toEqual([]);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("fetchNotices sets error on failure", async () => {
    mockGetNotices.mockRejectedValueOnce(new Error("Connection lost"));
    const store = useNoticesStore();
    await store.fetchNotices();

    expect(store.error).toBe("Connection lost");
    expect(store.loading).toBe(false);
  });

  it("fetchNotices triggers handleConnectionError on failure", async () => {
    mockGetNotices.mockRejectedValueOnce(new Error("Connection lost"));
    const connection = useConnectionStore();
    const spy = vi.spyOn(connection, "handleConnectionError");

    const store = useNoticesStore();
    await store.fetchNotices();

    expect(spy).toHaveBeenCalledOnce();
  });

  it("resetSessionState clears data and stops polling", async () => {
    mockGetNotices.mockResolvedValueOnce([makeNotice(1), makeNotice(2)]);
    const store = useNoticesStore();
    store.startPolling(1000);
    await vi.advanceTimersByTimeAsync(100);

    expect(store.notices.length).toBeGreaterThan(0);

    store.resetSessionState();

    expect(store.notices).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();

    // Polling should be stopped — no further fetches
    const callsAfterReset = mockGetNotices.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(mockGetNotices.mock.calls.length).toBe(callsAfterReset);
  });

  it("resetSessionState invalidates in-flight fetches", async () => {
    let resolveRpc: (value: Notice[]) => void;
    mockGetNotices.mockImplementationOnce(
      () => new Promise((resolve) => { resolveRpc = resolve; }),
    );

    const store = useNoticesStore();
    const fetchPromise = store.fetchNotices();

    // Reset while fetch is still pending
    store.resetSessionState();

    // Resolve the stale fetch — its result should be discarded
    resolveRpc!([makeNotice(1)]);
    await fetchPromise;

    expect(store.notices).toEqual([]);
  });

  it("resetSessionState suppresses notification on first fetch after reset", async () => {
    mockGetNotices.mockResolvedValueOnce([makeNotice(1)]);
    const store = useNoticesStore();
    await store.fetchNotices();
    expect(mockNotify).toHaveBeenCalledTimes(1);

    store.resetSessionState();
    mockNotify.mockClear();

    // First fetch after reset: catch-up, no notification
    mockGetNotices.mockResolvedValueOnce([makeNotice(5), makeNotice(6)]);
    await store.fetchNotices();
    expect(store.notices).toHaveLength(2);
    expect(mockNotify).not.toHaveBeenCalled();

    // Second fetch: new notices, should notify
    mockGetNotices.mockResolvedValueOnce([makeNotice(7)]);
    await store.fetchNotices();
    expect(mockNotify).toHaveBeenCalledWith(1);
  });

  it("resetSessionState clears catchingUp even when first fetch returns empty", async () => {
    const store = useNoticesStore();
    store.resetSessionState();
    mockNotify.mockClear();

    // First fetch after reset returns empty
    mockGetNotices.mockResolvedValueOnce([]);
    await store.fetchNotices();
    expect(mockNotify).not.toHaveBeenCalled();

    // Second fetch returns notices — should notify normally
    mockGetNotices.mockResolvedValueOnce([makeNotice(1)]);
    await store.fetchNotices();
    expect(mockNotify).toHaveBeenCalledWith(1);
  });

  it("resetSessionState allows re-fetching from scratch", async () => {
    mockGetNotices.mockResolvedValueOnce([makeNotice(1)]);
    const store = useNoticesStore();
    await store.fetchNotices();
    expect(store.notices).toHaveLength(1);

    store.resetSessionState();

    mockGetNotices.mockResolvedValueOnce([makeNotice(10)]);
    await store.fetchNotices();

    // Should have fetched from seqno 0 (reset) and only contain new data
    expect(mockGetNotices).toHaveBeenLastCalledWith(0);
    expect(store.notices).toHaveLength(1);
    expect(store.notices[0].seqno).toBe(10);
  });

  it("polls and stops", async () => {
    mockGetNotices.mockResolvedValue([]);
    const store = useNoticesStore();
    store.startPolling(1000);

    await vi.advanceTimersByTimeAsync(100);
    const initialCalls = mockGetNotices.mock.calls.length;
    expect(initialCalls).toBeGreaterThanOrEqual(1);

    store.stopPolling();
    const afterStop = mockGetNotices.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(mockGetNotices.mock.calls.length).toBe(afterStop);
  });
});
