import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setTheme: vi.fn(),
  }),
}));

import { useManagerSettingsStore } from "./managerSettings";

const STORAGE_KEY = "boinc-manager-settings";

describe("useManagerSettingsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("loads defaults when localStorage is empty", () => {
    const store = useManagerSettingsStore();
    expect(store.settings.language).toBe("auto");
    expect(store.settings.theme).toBe("system");
    expect(store.settings.showExitConfirmation).toBe(true);
    expect(store.settings.checkForUpdates).toBe(true);
  });

  it("loads saved settings from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ language: "ru", theme: "dark" }));
    const store = useManagerSettingsStore();
    expect(store.settings.language).toBe("ru");
    expect(store.settings.theme).toBe("dark");
    // Defaults are preserved for unset keys
    expect(store.settings.showExitConfirmation).toBe(true);
  });

  it("handles corrupt localStorage gracefully", () => {
    localStorage.setItem(STORAGE_KEY, "not-json{{{");
    const store = useManagerSettingsStore();
    expect(store.settings.language).toBe("auto");
  });

  it("resetSettings restores defaults", () => {
    const store = useManagerSettingsStore();
    store.settings.language = "de";
    store.settings.theme = "dark";
    store.resetSettings();
    expect(store.settings.language).toBe("auto");
    expect(store.settings.theme).toBe("system");
  });

  it("applies 'light' theme to documentElement", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "light" }));
    useManagerSettingsStore();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("removes dataset.theme for 'system' theme", () => {
    document.documentElement.dataset.theme = "dark";
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "system" }));
    useManagerSettingsStore();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
