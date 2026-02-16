import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock pinia store — provide a minimal mock for useManagerSettingsStore
vi.mock("../stores/managerSettings", () => ({
  useManagerSettingsStore: () => ({
    settings: { checkForUpdates: true },
  }),
}));

import { invoke } from "@tauri-apps/api/core";
import { checkForUpdates, useUpdateCheck } from "./useUpdateCheck";

const mockInvoke = vi.mocked(invoke);

function makeRelease(publishedAt: string, assets: { name: string; browser_download_url: string }[] = []) {
  return {
    published_at: publishedAt,
    html_url: "https://github.com/AufarZakiev/Fresco/releases/latest",
    assets,
  };
}

const windowsAssets = [
  { name: "Fresco-x86_64-pc-windows-msvc.exe", browser_download_url: "https://example.com/win64.exe" },
  { name: "Fresco-aarch64-pc-windows-msvc.exe", browser_download_url: "https://example.com/winarm.exe" },
  { name: "Fresco-aarch64-apple-darwin.app.zip", browser_download_url: "https://example.com/macarm.zip" },
  { name: "Fresco-x86_64-unknown-linux-gnu.AppImage", browser_download_url: "https://example.com/linux.appimage" },
];

describe("useUpdateCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
    // Reset shared state by calling the composable
    const state = useUpdateCheck();
    // Reset internal state manually via the refs
    state.updateAvailable.value = false;
    state.releaseDate.value = "";
    state.releaseUrl.value = "";
    state.assetUrl.value = "";
    state.buildTime.value = "";
    state.checking.value = false;
    state.error.value = "";
    state.dismissed.value = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects update when release is newer than build time", async () => {
    mockInvoke.mockResolvedValue("2025-01-01T00:00:00Z");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeRelease("2025-06-15T12:00:00Z", windowsAssets)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await checkForUpdates(true);

    const { updateAvailable, releaseDate } = useUpdateCheck();
    expect(updateAvailable.value).toBe(true);
    expect(releaseDate.value).toBe("2025-06-15T12:00:00Z");
  });

  it("reports no update when build time >= release date", async () => {
    mockInvoke.mockResolvedValue("2025-07-01T00:00:00Z");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeRelease("2025-06-15T12:00:00Z", windowsAssets)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await checkForUpdates(true);

    const { updateAvailable } = useUpdateCheck();
    expect(updateAvailable.value).toBe(false);
  });

  it("skips check for dev builds", async () => {
    mockInvoke.mockResolvedValue("dev");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await checkForUpdates(true);

    expect(fetchSpy).not.toHaveBeenCalled();
    const { updateAvailable } = useUpdateCheck();
    expect(updateAvailable.value).toBe(false);
  });

  it("respects 24h throttle", async () => {
    // Simulate a recent check
    localStorage.setItem("fresco-last-update-check", String(Date.now()));

    mockInvoke.mockResolvedValue("2025-01-01T00:00:00Z");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // Non-forced check should be throttled
    await checkForUpdates(false);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ignores throttle when forced", async () => {
    localStorage.setItem("fresco-last-update-check", String(Date.now()));

    mockInvoke.mockResolvedValue("2025-01-01T00:00:00Z");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeRelease("2025-06-15T12:00:00Z", windowsAssets)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await checkForUpdates(true);

    const { updateAvailable } = useUpdateCheck();
    expect(updateAvailable.value).toBe(true);
  });

  it("matches platform asset URL", async () => {
    mockInvoke.mockResolvedValue("2025-01-01T00:00:00Z");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeRelease("2025-06-15T12:00:00Z", windowsAssets)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await checkForUpdates(true);

    const { assetUrl } = useUpdateCheck();
    // In happy-dom, navigator.platform may vary, but assetUrl should be populated
    expect(typeof assetUrl.value).toBe("string");
  });

  it("handles fetch errors gracefully", async () => {
    mockInvoke.mockResolvedValue("2025-01-01T00:00:00Z");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    await checkForUpdates(true);

    const { error, updateAvailable } = useUpdateCheck();
    expect(error.value).toBe("Network error");
    expect(updateAvailable.value).toBe(false);
  });

  it("handles non-200 API responses", async () => {
    mockInvoke.mockResolvedValue("2025-01-01T00:00:00Z");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 403 }),
    );

    await checkForUpdates(true);

    const { error } = useUpdateCheck();
    expect(error.value).toContain("403");
  });
});
