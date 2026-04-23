import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useWorkunitAppsStore } from "./workunitApps";
import type { WorkunitApp } from "../types/boinc";

vi.mock("../composables/useRpc", () => ({
  getWorkunitApps: vi.fn(),
}));

import { getWorkunitApps } from "../composables/useRpc";

const mockGet = vi.mocked(getWorkunitApps);

function makeWa(overrides: Partial<WorkunitApp> = {}): WorkunitApp {
  return {
    project_url: "https://example.com/",
    result_name: "task_0",
    wu_name: "task",
    app_name: "rosetta",
    user_friendly_name: "Rosetta Mini",
    plan_class: "",
    sub_appname: "",
    ...overrides,
  };
}

describe("useWorkunitAppsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("appLabel returns undefined when not loaded", () => {
    const store = useWorkunitAppsStore();
    expect(store.appLabel("https://example.com/", "task_0")).toBeUndefined();
  });

  it("appLabel uses sub_appname when present", async () => {
    mockGet.mockResolvedValueOnce([
      makeWa({ sub_appname: "Rosetta Mini sub", plan_class: "mt" }),
    ]);
    const store = useWorkunitAppsStore();
    await store.fetchWorkunitApps();
    expect(store.appLabel("https://example.com/", "task_0")).toBe(
      "Rosetta Mini sub",
    );
  });

  it("appLabel falls back to user_friendly_name (plan_class)", async () => {
    mockGet.mockResolvedValueOnce([makeWa({ plan_class: "mt" })]);
    const store = useWorkunitAppsStore();
    await store.fetchWorkunitApps();
    expect(store.appLabel("https://example.com/", "task_0")).toBe(
      "Rosetta Mini (mt)",
    );
  });

  it("appLabel omits empty plan_class", async () => {
    mockGet.mockResolvedValueOnce([makeWa()]);
    const store = useWorkunitAppsStore();
    await store.fetchWorkunitApps();
    expect(store.appLabel("https://example.com/", "task_0")).toBe(
      "Rosetta Mini",
    );
  });

  it("appLabel returns undefined when no friendly name or sub_appname", async () => {
    mockGet.mockResolvedValueOnce([
      makeWa({ user_friendly_name: "", sub_appname: "" }),
    ]);
    const store = useWorkunitAppsStore();
    await store.fetchWorkunitApps();
    expect(store.appLabel("https://example.com/", "task_0")).toBeUndefined();
  });

  it("polls and stops", async () => {
    mockGet.mockResolvedValue([]);
    const store = useWorkunitAppsStore();
    store.startPolling(1000);

    await vi.advanceTimersByTimeAsync(100);
    expect(mockGet.mock.calls.length).toBeGreaterThanOrEqual(1);

    store.stopPolling();
    const afterStop = mockGet.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(mockGet.mock.calls.length).toBe(afterStop);
  });
});
