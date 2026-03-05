import { defineStore } from "pinia";
import { ref } from "vue";
import { getStatistics } from "../composables/useRpc";
import type { ProjectStatistics } from "../types/boinc";
import { useConnectionStore } from "./connection";

const POLL_INTERVAL_MS = 60000;

export const useStatisticsStore = defineStore("statistics", () => {
  const projectStats = ref<ProjectStatistics[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function fetchStatistics() {
    loading.value = true;
    error.value = null;
    try {
      projectStats.value = await getStatistics();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      const connection = useConnectionStore();
      connection.handleConnectionError();
    } finally {
      loading.value = false;
    }
  }

  function startPolling(intervalMs = POLL_INTERVAL_MS) {
    stopPolling();
    fetchStatistics();
    pollTimer = setInterval(fetchStatistics, intervalMs);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  return {
    projectStats,
    loading,
    error,
    fetchStatistics,
    startPolling,
    stopPolling,
  };
});
