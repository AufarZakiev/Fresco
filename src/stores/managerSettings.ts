import { defineStore } from "pinia";
import { watch } from "vue";
import { useLocalStorage } from "@vueuse/core";

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
  const settings = useLocalStorage<ManagerSettings>(STORAGE_KEY, { ...defaults }, {
    mergeDefaults: true,
    flush: "sync",
  });

  applyTheme(settings.value.theme);

  watch(
    () => settings.value.theme,
    (theme) => {
      applyTheme(theme);
    },
  );

  function resetSettings() {
    Object.assign(settings.value, defaults);
  }

  return { settings, resetSettings };
});
