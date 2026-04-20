import { ref } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { invoke } from "../lib/typedInvoke";
import { useManagerSettingsStore } from "../stores/managerSettings";
import { getOS, getArch, platformAssetPattern } from "./usePlatform";

const GITHUB_API_URL =
  "https://api.github.com/repos/AufarZakiev/Fresco/releases/latest";

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

const lastCheckTimestamp = useLocalStorage("fresco-last-update-check", 0);
const dismissedDate = useLocalStorage("fresco-update-dismissed", "");

// Fetch build time eagerly so About dialog shows it immediately
invoke("get_build_time").then((bt) => {
  buildTime.value = bt;
});

// Each platform's updater expects a specific asset format. Enforcing the
// extension prevents older releases that still ship `.app.zip` from being
// offered on macOS, which the DMG-based updater cannot consume.
const REQUIRED_EXTENSION: Record<string, string> = {
  windows: ".exe",
  macos: ".dmg",
  linux: ".AppImage",
};

async function matchAsset(assets: GitHubAsset[]): Promise<string> {
  const [os, arch] = await Promise.all([getOS(), getArch()]);
  const pattern = platformAssetPattern(os, arch);
  const requiredExt = REQUIRED_EXTENSION[os];
  const match = assets.find(
    (a) => a.name.includes(pattern) && a.name.endsWith(requiredExt),
  );
  return match?.browser_download_url ?? "";
}

function extractBuildTime(body: string): string {
  const match = body.match(/build_time:(\S+)/);
  return match?.[1] ?? "";
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
    lastCheckTimestamp.value = Date.now();

    // Compare the app's embedded build time against the one in the release body.
    // Both are set from the same CI timestamp, so they match exactly when
    // the app was built from the same workflow run as the release.
    const releaseBuildTime = extractBuildTime(release.body ?? "");

    if (releaseBuildTime && releaseBuildTime !== bt) {
      // Only surface the banner if the release ships an asset this platform
      // can actually install. Otherwise (e.g. macOS release still on legacy
      // .app.zip, or an architecture not built that day) we'd be teasing the
      // user with a notification they can't act on.
      const url = await matchAsset(release.assets);
      if (!url) {
        updateAvailable.value = false;
        return;
      }
      assetUrl.value = url;
      releaseDate.value = release.published_at;
      releaseUrl.value = release.html_url;
      dismissed.value = dismissedDate.value === release.published_at;
      updateAvailable.value = true;
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
  dismissedDate.value = releaseDate.value;
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
