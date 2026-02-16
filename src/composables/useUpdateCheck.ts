import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useManagerSettingsStore } from "../stores/managerSettings";

const GITHUB_API_URL =
  "https://api.github.com/repos/AufarZakiev/Fresco/releases/latest";
const THROTTLE_KEY = "fresco-last-update-check";
const DISMISSED_KEY = "fresco-update-dismissed";
const THROTTLE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  published_at: string;
  html_url: string;
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

function getPlatformAssetPattern(): string {
  const platform = navigator.platform.toLowerCase();
  const ua = navigator.userAgent.toLowerCase();

  if (platform.includes("win")) {
    if (ua.includes("arm") || ua.includes("aarch64")) {
      return "aarch64-pc-windows-msvc.exe";
    }
    return "x86_64-pc-windows-msvc.exe";
  }
  if (platform.includes("mac")) {
    if (ua.includes("arm") || platform.includes("arm")) {
      return "aarch64-apple-darwin.app.zip";
    }
    return "x86_64-apple-darwin.app.zip";
  }
  // Linux
  if (ua.includes("aarch64") || ua.includes("arm64")) {
    return "aarch64-unknown-linux-gnu";
  }
  return "x86_64-unknown-linux-gnu";
}

function matchAsset(assets: GitHubAsset[]): string {
  const pattern = getPlatformAssetPattern();
  const match = assets.find((a) => a.name.includes(pattern));
  return match?.browser_download_url ?? "";
}

function isDismissed(date: string): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === date;
  } catch {
    return false;
  }
}

function isThrottled(): boolean {
  try {
    const last = localStorage.getItem(THROTTLE_KEY);
    if (!last) return false;
    return Date.now() - Number(last) < THROTTLE_MS;
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
    if (isThrottled()) return;
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

    const publishedAt = new Date(release.published_at).getTime();
    const builtAt = new Date(bt).getTime();

    if (publishedAt > builtAt) {
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
    checkForUpdates,
    dismissUpdate,
  };
}
