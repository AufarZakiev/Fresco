import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { usePreferencesStore } from "./preferences";
import type { GlobalPreferences } from "../types/boinc";

vi.mock("../composables/useRpc", () => ({
  getPreferences: vi.fn(),
  setPreferences: vi.fn(),
  getGlobalPrefsWorking: vi.fn(),
  getGlobalPrefsFile: vi.fn(),
}));

import {
  getPreferences,
  setPreferences,
  getGlobalPrefsWorking,
  getGlobalPrefsFile,
} from "../composables/useRpc";

const mockGetPreferences = vi.mocked(getPreferences);
const mockSetPreferences = vi.mocked(setPreferences);
const mockGetWorking = vi.mocked(getGlobalPrefsWorking);
const mockGetFile = vi.mocked(getGlobalPrefsFile);

function makePrefs(overrides: Partial<GlobalPreferences> = {}): GlobalPreferences {
  return {
    run_on_batteries: false,
    run_if_user_active: true,
    run_gpu_if_user_active: false,
    idle_time_to_run: 3,
    max_ncpus_pct: 100,
    cpu_usage_limit: 100,
    ram_max_used_busy_frac: 0.5,
    ram_max_used_idle_frac: 0.9,
    max_bytes_sec_down: 0,
    max_bytes_sec_up: 0,
    daily_xfer_limit_mb: 0,
    daily_xfer_period_days: 0,
    disk_max_used_gb: 100,
    disk_max_used_pct: 90,
    disk_min_free_gb: 0.1,
    disk_interval: 60,
    work_buf_min_days: 0.1,
    cpu_scheduling_period_minutes: 60,
    start_hour: 0,
    end_hour: 0,
    net_start_hour: 0,
    net_end_hour: 0,
    suspend_if_no_recent_input: 0,
    suspend_cpu_usage: 25,
    niu_suspend_cpu_usage: 50,
    niu_cpu_usage_limit: 100,
    niu_max_ncpus_pct: 100,
    leave_apps_in_memory: false,
    dont_verify_images: false,
    confirm_before_connecting: false,
    hangup_if_dialed: false,
    network_wifi_only: false,
    work_buf_additional_days: 0.5,
    max_ncpus: 0,
    battery_charge_min_pct: 90,
    battery_max_temperature: 40,
    vm_max_used_frac: 0.75,
    day_prefs: [],
    ...overrides,
  };
}

describe("usePreferencesStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with null prefs", () => {
    const store = usePreferencesStore();
    expect(store.prefs).toBeNull();
    expect(store.workingPrefs).toBeNull();
    expect(store.filePrefs).toBeNull();
    expect(store.loading).toBe(false);
  });

  it("fetchPreferences loads all three pref sources", async () => {
    const overridePrefs = makePrefs({ cpu_usage_limit: 80 });
    const workingPrefs = makePrefs({ cpu_usage_limit: 80 });
    const filePrefs = makePrefs({ cpu_usage_limit: 100 });

    mockGetPreferences.mockResolvedValueOnce(overridePrefs);
    mockGetWorking.mockResolvedValueOnce(workingPrefs);
    mockGetFile.mockResolvedValueOnce(filePrefs);

    const store = usePreferencesStore();
    await store.fetchPreferences();

    expect(store.prefs).toEqual(overridePrefs);
    expect(store.workingPrefs).toEqual(workingPrefs);
    expect(store.filePrefs).toEqual(filePrefs);
    expect(store.prefetched).toBe(true);
    expect(store.loading).toBe(false);
  });

  it("fetchPreferences handles getGlobalPrefsFile failure gracefully", async () => {
    mockGetPreferences.mockResolvedValueOnce(makePrefs());
    mockGetWorking.mockResolvedValueOnce(makePrefs());
    mockGetFile.mockRejectedValueOnce(new Error("Not found"));

    const store = usePreferencesStore();
    await store.fetchPreferences();

    expect(store.prefs).not.toBeNull();
    expect(store.filePrefs).toBeNull();
    expect(store.error).toBeNull();
  });

  it("fetchPreferences sets error on main failure", async () => {
    mockGetPreferences.mockRejectedValueOnce(new Error("RPC fail"));
    mockGetWorking.mockResolvedValueOnce(makePrefs());
    mockGetFile.mockResolvedValueOnce(makePrefs());

    const store = usePreferencesStore();
    await store.fetchPreferences();

    expect(store.error).toBe("Error: RPC fail");
    expect(store.loading).toBe(false);
  });

  it("prefetchPreferences only runs once", async () => {
    mockGetPreferences.mockResolvedValue(makePrefs());
    mockGetWorking.mockResolvedValue(makePrefs());
    mockGetFile.mockResolvedValue(makePrefs());

    const store = usePreferencesStore();
    await store.prefetchPreferences();
    await store.prefetchPreferences();

    expect(mockGetPreferences).toHaveBeenCalledTimes(1);
  });

  it("getEffectiveValue returns numeric value from workingPrefs", async () => {
    mockGetPreferences.mockResolvedValueOnce(makePrefs());
    mockGetWorking.mockResolvedValueOnce(makePrefs({ cpu_usage_limit: 75 }));
    mockGetFile.mockResolvedValueOnce(makePrefs());

    const store = usePreferencesStore();
    await store.fetchPreferences();

    expect(store.getEffectiveValue("cpu_usage_limit")).toBe(75);
  });

  it("getEffectiveValue returns null when workingPrefs not loaded", () => {
    const store = usePreferencesStore();
    expect(store.getEffectiveValue("cpu_usage_limit")).toBeNull();
  });

  it("getFileValue returns numeric value from filePrefs", async () => {
    mockGetPreferences.mockResolvedValueOnce(makePrefs());
    mockGetWorking.mockResolvedValueOnce(makePrefs());
    mockGetFile.mockResolvedValueOnce(makePrefs({ disk_max_used_gb: 200 }));

    const store = usePreferencesStore();
    await store.fetchPreferences();

    expect(store.getFileValue("disk_max_used_gb")).toBe(200);
  });

  it("getBoolEffectiveValue returns boolean from workingPrefs", async () => {
    mockGetPreferences.mockResolvedValueOnce(makePrefs());
    mockGetWorking.mockResolvedValueOnce(makePrefs({ run_on_batteries: true }));
    mockGetFile.mockResolvedValueOnce(makePrefs());

    const store = usePreferencesStore();
    await store.fetchPreferences();

    expect(store.getBoolEffectiveValue("run_on_batteries")).toBe(true);
  });

  it("savePreferences calls RPC and updates state", async () => {
    const newPrefs = makePrefs({ cpu_usage_limit: 50 });
    mockSetPreferences.mockResolvedValueOnce(undefined);
    mockGetWorking.mockResolvedValueOnce(makePrefs({ cpu_usage_limit: 50 }));

    const store = usePreferencesStore();
    await store.savePreferences(newPrefs);

    expect(mockSetPreferences).toHaveBeenCalledWith(newPrefs);
    expect(store.prefs).toEqual(newPrefs);
    expect(store.saving).toBe(false);
  });

  it("savePreferences sets error on failure", async () => {
    mockSetPreferences.mockRejectedValueOnce(new Error("Save failed"));

    const store = usePreferencesStore();
    await store.savePreferences(makePrefs());

    expect(store.error).toBe("Error: Save failed");
    expect(store.saving).toBe(false);
  });
});
