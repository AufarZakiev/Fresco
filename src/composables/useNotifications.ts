import { useManagerSettingsStore } from "../stores/managerSettings";

const LAST_REMINDER_KEY = "boinc-last-reminder";

function getFrequencyMs(freq: string): number {
  switch (freq) {
    case "always": return 0;
    case "1h": return 3600_000;
    case "6h": return 21600_000;
    case "1d": return 86400_000;
    case "1w": return 604800_000;
    case "never": return Infinity;
    default: return 86400_000;
  }
}

function shouldNotify(): boolean {
  const store = useManagerSettingsStore();
  const freq = getFrequencyMs(store.settings.reminderFrequency);
  if (freq === Infinity) return false;
  if (freq === 0) return true;

  const last = Number(localStorage.getItem(LAST_REMINDER_KEY) || "0");
  return Date.now() - last >= freq;
}

function markNotified() {
  localStorage.setItem(LAST_REMINDER_KEY, String(Date.now()));
}

async function send(title: string, body: string) {
  try {
    const {
      isPermissionGranted,
      requestPermission,
      sendNotification,
    } = await import("@tauri-apps/plugin-notification");

    let granted = await isPermissionGranted();
    if (!granted) {
      const perm = await requestPermission();
      granted = perm === "granted";
    }
    if (granted) {
      sendNotification({ title, body });
    }
  } catch {
    // Not in Tauri environment
  }
}

export async function notifyNewNotices(count: number) {
  if (count <= 0 || !shouldNotify()) return;
  markNotified();
  await send(
    "BOINC Notices",
    count === 1
      ? "There is 1 new notice — click to view"
      : `There are ${count} new notices — click to view`,
  );
}

export async function notifyConnectionLost() {
  await send("BOINC Manager", "Lost connection to BOINC client");
}
