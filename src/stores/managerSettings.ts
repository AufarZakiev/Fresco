import { defineStore } from "pinia";
import { ref, watch } from "vue";

export interface ManagerSettings {
  language: string;
  reminderFrequency: string;
  showExitConfirmation: boolean;
  showShutdownConfirmation: boolean;
  minimizeToTrayOnClose: boolean;
  startMinimizedToTray: boolean;
}

const STORAGE_KEY = "boinc-manager-settings";

const defaults: ManagerSettings = {
  language: "auto",
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

export const useManagerSettingsStore = defineStore("managerSettings", () => {
  const settings = ref<ManagerSettings>(load());

  watch(settings, (v) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  }, { deep: true });

  function reset() {
    settings.value = { ...defaults };
  }

  return { settings, reset };
});
