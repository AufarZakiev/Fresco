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
};

function load(): ManagerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...defaults };
}

function applyTheme(theme: ManagerSettings["theme"]) {
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

export const useManagerSettingsStore = defineStore("managerSettings", () => {
  const settings = ref<ManagerSettings>(load());

  applyTheme(settings.value.theme);

  watch(settings, (v) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  }, { deep: true });

  watch(() => settings.value.theme, (theme) => {
    applyTheme(theme);
  });

  function reset() {
    settings.value = { ...defaults };
  }

  return { settings, reset };
});
