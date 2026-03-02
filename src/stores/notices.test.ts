import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useNoticesStore } from "./notices";
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

    expect(store.error).toBe("Error: Connection lost");
    expect(store.loading).toBe(false);
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
