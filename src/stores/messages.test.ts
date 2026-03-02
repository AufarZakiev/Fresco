import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useMessagesStore } from "./messages";
import { useConnectionStore } from "./connection";
import type { Message } from "../types/boinc";
import { MSG_PRIORITY } from "../types/boinc";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

function makeMessage(seqno: number, overrides: Partial<Message> = {}): Message {
  return {
    project: "Test Project",
    priority: MSG_PRIORITY.INFO,
    seqno,
    body: `Message ${seqno}`,
    timestamp: 1700000000 + seqno,
    ...overrides,
  };
}

/** Stub invoke so get_message_count returns `count` and get_messages returns a range. */
function stubRpc(totalCount: number, allMessages: Message[]) {
  mockInvoke.mockImplementation(async (cmd: string, args?: unknown) => {
    if (cmd === "get_message_count") return totalCount;
    if (cmd === "get_messages") {
      const seqno = (args as { seqno: number }).seqno;
      return allMessages.filter((m) => m.seqno > seqno);
    }
    return undefined;
  });
}

describe("useMessagesStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts with empty state", () => {
    const store = useMessagesStore();
    expect(store.messages).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.hasMore).toBe(true);
    expect(store.loadingMore).toBe(false);
  });

  it("initial fetch windows to last PAGE_SIZE messages", async () => {
    // Simulate 100 total messages, seqnos 1–100
    const all = Array.from({ length: 100 }, (_, i) => makeMessage(i + 1));
    stubRpc(100, all);

    const store = useMessagesStore();
    await store.fetchMessages();

    // PAGE_SIZE is 50, so startSeqno = max(0, 100 - 50) = 50
    // get_messages(50) returns seqno 51..100 → 50 messages
    expect(store.messages).toHaveLength(50);
    expect(store.messages[0].seqno).toBe(51);
    expect(store.messages[49].seqno).toBe(100);
    expect(store.hasMore).toBe(true);
    expect(store.loading).toBe(false);
  });

  it("sets hasMore=false when total <= PAGE_SIZE", async () => {
    const all = Array.from({ length: 10 }, (_, i) => makeMessage(i + 1));
    stubRpc(10, all);

    const store = useMessagesStore();
    await store.fetchMessages();

    // startSeqno = max(0, 10 - 50) = 0
    expect(store.messages).toHaveLength(10);
    expect(store.hasMore).toBe(false);
  });

  it("appends new messages on subsequent fetches", async () => {
    const all = Array.from({ length: 10 }, (_, i) => makeMessage(i + 1));
    stubRpc(10, all);

    const store = useMessagesStore();
    await store.fetchMessages(); // initial
    expect(store.messages).toHaveLength(10);

    // Add new messages
    all.push(makeMessage(11), makeMessage(12));
    stubRpc(12, all);

    await store.fetchMessages(); // poll
    expect(store.messages).toHaveLength(12);
    expect(store.messages[11].seqno).toBe(12);
  });

  it("does not duplicate messages on poll when no new messages", async () => {
    const all = Array.from({ length: 5 }, (_, i) => makeMessage(i + 1));
    stubRpc(5, all);

    const store = useMessagesStore();
    await store.fetchMessages();
    await store.fetchMessages();

    expect(store.messages).toHaveLength(5);
  });

  it("fetchOlderMessages prepends older messages", async () => {
    // Start with messages 51–100
    const all = Array.from({ length: 100 }, (_, i) => makeMessage(i + 1));
    stubRpc(100, all);

    const store = useMessagesStore();
    await store.fetchMessages();
    expect(store.messages).toHaveLength(50);
    expect(store.messages[0].seqno).toBe(51);

    await store.fetchOlderMessages();

    // Should have prepended older messages (seqno 1–50)
    expect(store.messages.length).toBeGreaterThan(50);
    expect(store.messages[0].seqno).toBeLessThan(51);
  });

  it("fetchOlderMessages sets hasMore=false at beginning of log", async () => {
    const all = Array.from({ length: 10 }, (_, i) => makeMessage(i + 1));
    stubRpc(10, all);

    const store = useMessagesStore();
    await store.fetchMessages();

    // hasMore is already false because total <= PAGE_SIZE
    expect(store.hasMore).toBe(false);

    // fetchOlderMessages should bail early
    await store.fetchOlderMessages();
    expect(store.messages).toHaveLength(10);
  });

  it("fetchOlderMessages does not run when loadingMore is true", async () => {
    const all = Array.from({ length: 100 }, (_, i) => makeMessage(i + 1));
    stubRpc(100, all);

    const store = useMessagesStore();
    await store.fetchMessages();

    // Simulate concurrent calls
    const p1 = store.fetchOlderMessages();
    const p2 = store.fetchOlderMessages();
    await Promise.all([p1, p2]);

    // Only one fetch should have run (the second bails on loadingMore guard)
    expect(store.loadingMore).toBe(false);
  });

  it("fetchOlderMessages does not duplicate existing messages", async () => {
    const all = Array.from({ length: 100 }, (_, i) => makeMessage(i + 1));
    stubRpc(100, all);

    const store = useMessagesStore();
    await store.fetchMessages();

    const beforeCount = store.messages.length;
    await store.fetchOlderMessages();

    // All seqnos should be unique
    const seqnos = store.messages.map((m) => m.seqno);
    const uniqueSeqnos = new Set(seqnos);
    expect(uniqueSeqnos.size).toBe(seqnos.length);
    expect(store.messages.length).toBeGreaterThan(beforeCount);
  });

  it("sets error on RPC failure", async () => {
    mockInvoke.mockRejectedValueOnce("Connection lost");

    const store = useMessagesStore();
    await store.fetchMessages();

    expect(store.error).toBe("Connection lost");
    expect(store.messages).toEqual([]);
  });

  it("fetchMessages triggers handleConnectionError on failure", async () => {
    mockInvoke.mockRejectedValueOnce("Connection lost");
    const connection = useConnectionStore();
    const spy = vi.spyOn(connection, "handleConnectionError");

    const store = useMessagesStore();
    await store.fetchMessages();

    expect(spy).toHaveBeenCalledOnce();
  });

  it("fetchOlderMessages triggers handleConnectionError on failure", async () => {
    const all = Array.from({ length: 100 }, (_, i) => makeMessage(i + 1));
    stubRpc(100, all);

    const store = useMessagesStore();
    await store.fetchMessages();

    mockInvoke.mockRejectedValueOnce("Network error");
    const connection = useConnectionStore();
    const spy = vi.spyOn(connection, "handleConnectionError");

    await store.fetchOlderMessages();

    expect(spy).toHaveBeenCalledOnce();
  });

  it("filteredMessages filters by search text", async () => {
    const all = [
      makeMessage(1, { body: "Alpha task done", project: "ProjA" }),
      makeMessage(2, { body: "Beta error occurred", project: "ProjB" }),
      makeMessage(3, { body: "Gamma complete", project: "ProjC" }),
    ];
    stubRpc(3, all);

    const store = useMessagesStore();
    await store.fetchMessages();

    store.searchText = "error";
    expect(store.filteredMessages).toHaveLength(1);
    expect(store.filteredMessages[0].seqno).toBe(2);

    store.searchText = "proj";
    expect(store.filteredMessages).toHaveLength(3);

    store.searchText = "";
    expect(store.filteredMessages).toHaveLength(3);
  });

  it("polling starts and stops correctly", async () => {
    const all = Array.from({ length: 5 }, (_, i) => makeMessage(i + 1));
    stubRpc(5, all);

    const store = useMessagesStore();
    store.startPolling(1000);

    await vi.advanceTimersByTimeAsync(100);
    const initialCalls = mockInvoke.mock.calls.length;
    expect(initialCalls).toBeGreaterThanOrEqual(1);

    await vi.advanceTimersByTimeAsync(2000);
    const afterPolling = mockInvoke.mock.calls.length;
    expect(afterPolling).toBeGreaterThan(initialCalls);

    store.stopPolling();
    const afterStop = mockInvoke.mock.calls.length;

    await vi.advanceTimersByTimeAsync(5000);
    expect(mockInvoke.mock.calls.length).toBe(afterStop);
  });

  it("stopPolling is idempotent", () => {
    const store = useMessagesStore();
    store.stopPolling();
    store.stopPolling();
  });
});
