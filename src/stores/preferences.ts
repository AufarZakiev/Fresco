import { defineStore } from "pinia";
import { ref } from "vue";
import {
  getPreferences,
  setPreferences as setPrefsRpc,
} from "../composables/useRpc";
import type { GlobalPreferences } from "../types/boinc";

export const usePreferencesStore = defineStore("preferences", () => {
  const prefs = ref<GlobalPreferences | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  async function fetchPreferences() {
    loading.value = true;
    error.value = null;
    try {
      prefs.value = await getPreferences();
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  }

  async function savePreferences(newPrefs: GlobalPreferences) {
    saving.value = true;
    error.value = null;
    try {
      await setPrefsRpc(newPrefs);
      prefs.value = newPrefs;
    } catch (e) {
      error.value = String(e);
    } finally {
      saving.value = false;
    }
  }

  return { prefs, loading, saving, error, fetchPreferences, savePreferences };
});
