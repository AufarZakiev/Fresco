import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useManagerSettingsStore } from "../stores/managerSettings";

const GITHUB_API_URL =
  "https://api.github.com/repos/AufarZakiev/Fresco/releases/latest";
const THROTTLE_KEY = "fresco-last-update-check";
const DISMISSED_KEY = "fresco-update-dismissed";

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  published_at: string;
  html_url: string;
  body: string;
  assets: GitHubAsset[];
}

// Shared reactive state (singleton across components)
const updateAvailable = ref(false);
const releaseDate = ref("");
const releaseUrl = ref("");
const assetUrl = ref("");
const buildTime = ref("");
const checking = ref(false);
const error = ref("");
const dismissed = ref(false);
const updateOnExit = ref(false);
const downloading = ref(false);
const downloaded = ref(false);
const downloadError = ref("");

// Fetch build time eagerly so About dialog shows it immediately
invoke<string>("get_build_time").then((bt) => {
  buildTime.value = bt;
});

function getPlatformAssetPattern(): string {
  const platform = navigator.platform.toLowerCase();
  const ua = navigator.userAgent.toLowerCase();

  if (platform.includes("win")) {
    if (ua.includes("arm") || ua.includes("aarch64")) {
      return "Windows_ARM64";
    }
    return "Windows_x86_64";
  }
  if (platform.includes("mac")) {
    if (ua.includes("arm") || platform.includes("arm")) {
      return "macOS_ARM64";
    }
    return "macOS_x86_64";
  }
  // Linux
  if (ua.includes("aarch64") || ua.includes("arm64")) {
    return "Linux_ARM64";
  }
  return "Linux_x86_64";
}

function matchAsset(assets: GitHubAsset[]): string {
  const pattern = getPlatformAssetPattern();
  const match = assets.find((a) => a.name.includes(pattern));
  return match?.browser_download_url ?? "";
}

function extractBuildTime(body: string): string {
  const match = body.match(/build_time:(\S+)/);
  return match?.[1] ?? "";
}

function isDismissed(date: string): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === date;
  } catch {
    return false;
  }
}

function markChecked() {
  try {
    localStorage.setItem(THROTTLE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export async function checkForUpdates(force = false) {
  if (checking.value) return;

  if (!force) {
    const store = useManagerSettingsStore();
    if (!store.settings.checkForUpdates) return;
  }

  checking.value = true;
  error.value = "";

  try {
    const bt: string = await invoke("get_build_time");
    buildTime.value = bt;

    if (bt === "dev") {
      checking.value = false;
      return;
    }

    const response = await fetch(GITHUB_API_URL);
    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const release: GitHubRelease = await response.json();
    markChecked();

    // Compare the app's embedded build time against the one in the release body.
    // Both are set from the same CI timestamp, so they match exactly when
    // the app was built from the same workflow run as the release.
    const releaseBuildTime = extractBuildTime(release.body ?? "");

    if (releaseBuildTime && releaseBuildTime !== bt) {
      updateAvailable.value = true;
      releaseDate.value = release.published_at;
      releaseUrl.value = release.html_url;
      assetUrl.value = matchAsset(release.assets);
      dismissed.value = isDismissed(release.published_at);
    } else {
      updateAvailable.value = false;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    checking.value = false;
  }
}

export async function startBackgroundDownload() {
  if (downloading.value || downloaded.value || !assetUrl.value) return;
  downloading.value = true;
  downloadError.value = "";
  try {
    await invoke("download_update", { assetUrl: assetUrl.value });
    downloaded.value = true;
  } catch (e) {
    downloadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    downloading.value = false;
  }
}

export function dismissUpdate() {
  dismissed.value = true;
  try {
    localStorage.setItem(DISMISSED_KEY, releaseDate.value);
  } catch {
    // ignore
  }
}

export function useUpdateCheck() {
  return {
    updateAvailable,
    releaseDate,
    releaseUrl,
    assetUrl,
    buildTime,
    checking,
    error,
    dismissed,
    updateOnExit,
    downloading,
    downloaded,
    downloadError,
    checkForUpdates,
    dismissUpdate,
    startBackgroundDownload,
  };
}
