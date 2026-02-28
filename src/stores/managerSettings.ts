import { defineStore } from "pinia";
import { ref, watch } from "vue";

export interface ManagerSettings {
  language: string;
  theme: "system" | "light" | "dark";
  reminderFrequency: string;
  showExitConfirmation: boolean;
  showShutdownConfirmation: boolean;
  minimizeToTrayOnClose: boolean;
  startMinimizedToTray: boolean;
  checkForUpdates: boolean;
}

const STORAGE_KEY = "boinc-manager-settings";

const defaults: ManagerSettings = {
  language: "auto",
  theme: "system",
  reminderFrequency: "1d",
  showExitConfirmation: true,
  showShutdownConfirmation: true,
  minimizeToTrayOnClose: true,
  startMinimizedToTray: false,
  checkForUpdates: true,
};

function loadSettings(): ManagerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    // Ignore corrupt localStorage
  }
  return { ...defaults };
}

async function applyTheme(theme: ManagerSettings["theme"]) {
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    if (theme === "system") {
      await win.setTheme(null);
    } else {
      await win.setTheme(theme);
    }
  } catch {
    // Not in Tauri environment
  }
}

export const useManagerSettingsStore = defineStore("managerSettings", () => {
  const settings = ref<ManagerSettings>(loadSettings());

  applyTheme(settings.value.theme);

  watch(settings, (v) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  }, { deep: true });

  watch(() => settings.value.theme, (theme) => {
    applyTheme(theme);
  });

  function resetSettings() {
    settings.value = { ...defaults };
  }

  return { settings, resetSettings };
});
