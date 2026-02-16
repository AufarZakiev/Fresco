import { defineStore } from "pinia";
import { ref } from "vue";
import {
  getPreferences,
  setPreferences as setPrefsRpc,
  getGlobalPrefsWorking,
} from "../composables/useRpc";
import type { GlobalPreferences } from "../types/boinc";

export const usePreferencesStore = defineStore("preferences", () => {
  const prefs = ref<GlobalPreferences | null>(null);
  const workingPrefs = ref<GlobalPreferences | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);
  const prefetched = ref(false);

  async function fetchPreferences() {
    loading.value = true;
    error.value = null;
    try {
      const [overridePrefs, effectivePrefs] = await Promise.all([
        getPreferences(),
        getGlobalPrefsWorking(),
      ]);
      prefs.value = overridePrefs;
      workingPrefs.value = effectivePrefs;
      prefetched.value = true;
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  }

  /** Fire-and-forget prefetch that doesn't show a loading spinner. */
  async function prefetch() {
    if (prefetched.value) return;
    error.value = null;
    try {
      const [overridePrefs, effectivePrefs] = await Promise.all([
        getPreferences(),
        getGlobalPrefsWorking(),
      ]);
      prefs.value = overridePrefs;
      workingPrefs.value = effectivePrefs;
      prefetched.value = true;
    } catch {
      // Silent failure — dialog will fetch on open if needed
    }
  }

  /** Get the effective (working) value for a numeric field. */
  function getEffectiveValue(field: keyof GlobalPreferences): number | null {
    if (!workingPrefs.value) return null;
    const val = workingPrefs.value[field];
    return typeof val === "number" ? val : null;
  }

  async function savePreferences(newPrefs: GlobalPreferences) {
    saving.value = true;
    error.value = null;
    try {
      await setPrefsRpc(newPrefs);
      prefs.value = newPrefs;
      // Re-fetch working prefs since BOINC recalculates effective values
      try {
        workingPrefs.value = await getGlobalPrefsWorking();
      } catch {
        // Non-critical — working prefs will refresh on next open
      }
    } catch (e) {
      error.value = String(e);
    } finally {
      saving.value = false;
    }
  }

  return {
    prefs,
    workingPrefs,
    loading,
    saving,
    error,
    prefetched,
    fetchPreferences,
    prefetch,
    getEffectiveValue,
    savePreferences,
  };
});
