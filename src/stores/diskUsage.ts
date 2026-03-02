import { defineStore } from "pinia";
import { ref } from "vue";
import { getDiskUsage } from "../composables/useRpc";
import type { DiskUsage } from "../types/boinc";
import { useConnectionStore } from "./connection";

const POLL_INTERVAL_MS = 30000;

export const useDiskUsageStore = defineStore("diskUsage", () => {
  const usage = ref<DiskUsage>({
    projects: [],
    d_total: 0,
    d_free: 0,
    d_boinc: 0,
    d_allowed: 0,
  });
  const loading = ref(false);
  const error = ref<string | null>(null);
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function fetchDiskUsage() {
    loading.value = true;
    error.value = null;
    try {
      usage.value = await getDiskUsage();
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
    fetchDiskUsage();
    pollTimer = setInterval(fetchDiskUsage, intervalMs);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  return { usage, loading, error, fetchDiskUsage, startPolling, stopPolling };
});
