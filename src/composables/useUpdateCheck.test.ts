import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @tauri-apps/api/core — default return must be a Promise so the
// eager `invoke("get_build_time")` call at module-load doesn't blow up.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(""),
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

const appBuildTime = "2025-06-01T10:00:00Z";
const newerBuildTime = "2025-06-15T10:00:00Z";

function makeRelease(
  publishedAt: string,
  releaseBuildTime: string,
  assets: { name: string; browser_download_url: string }[] = [],
) {
  return {
    published_at: publishedAt,
    html_url: "https://github.com/AufarZakiev/Fresco/releases/latest",
    body: `build_time:${releaseBuildTime}`,
    assets,
  };
}

const windowsAssets = [
  { name: "Fresco_Windows_x86_64.exe", browser_download_url: "https://example.com/win64.exe" },
  { name: "Fresco_Windows_ARM64.exe", browser_download_url: "https://example.com/winarm.exe" },
  { name: "Fresco_macOS_ARM64.app.zip", browser_download_url: "https://example.com/macarm.zip" },
  { name: "Fresco_Linux_x86_64.AppImage", browser_download_url: "https://example.com/linux.appimage" },
];

describe("useUpdateCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    const state = useUpdateCheck();
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

  it("detects update when release build time differs from app build time", async () => {
    mockInvoke.mockResolvedValue(appBuildTime);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeRelease("2025-06-15T12:00:00Z", newerBuildTime, windowsAssets)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await checkForUpdates(true);

    const { updateAvailable, releaseDate } = useUpdateCheck();
    expect(updateAvailable.value).toBe(true);
    expect(releaseDate.value).toBe("2025-06-15T12:00:00Z");
  });

  it("reports no update when build times match", async () => {
    mockInvoke.mockResolvedValue(appBuildTime);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeRelease("2025-06-15T12:00:00Z", appBuildTime, windowsAssets)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await checkForUpdates(true);

    const { updateAvailable } = useUpdateCheck();
    expect(updateAvailable.value).toBe(false);
  });

  it("reports no update when release body has no build_time", async () => {
    mockInvoke.mockResolvedValue(appBuildTime);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        published_at: "2025-06-15T12:00:00Z",
        html_url: "https://github.com/AufarZakiev/Fresco/releases/latest",
        body: "",
        assets: windowsAssets,
      }), {
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

  it("checks even when last check was recent (no throttle)", async () => {
    localStorage.setItem("fresco-last-update-check", String(Date.now()));

    mockInvoke.mockResolvedValue(appBuildTime);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeRelease("2025-06-15T12:00:00Z", newerBuildTime, windowsAssets)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await checkForUpdates(false);

    const { updateAvailable } = useUpdateCheck();
    expect(updateAvailable.value).toBe(true);
  });

  it("matches platform asset URL", async () => {
    mockInvoke.mockResolvedValue(appBuildTime);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeRelease("2025-06-15T12:00:00Z", newerBuildTime, windowsAssets)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await checkForUpdates(true);

    const { assetUrl } = useUpdateCheck();
    expect(typeof assetUrl.value).toBe("string");
  });

  it("handles fetch errors gracefully", async () => {
    mockInvoke.mockResolvedValue(appBuildTime);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    await checkForUpdates(true);

    const { error, updateAvailable } = useUpdateCheck();
    expect(error.value).toBe("Network error");
    expect(updateAvailable.value).toBe(false);
  });

  it("handles non-200 API responses", async () => {
    mockInvoke.mockResolvedValue(appBuildTime);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 403 }),
    );

    await checkForUpdates(true);

    const { error } = useUpdateCheck();
    expect(error.value).toContain("403");
  });
});
