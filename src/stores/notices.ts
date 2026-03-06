import { defineStore } from "pinia";
import { ref } from "vue";
import { getNotices } from "../composables/useRpc";
import { notifyNewNotices } from "../composables/useNotifications";
import type { Notice } from "../types/boinc";
import { useConnectionStore } from "./connection";

const POLL_INTERVAL_MS = 30000;

export const useNoticesStore = defineStore("notices", () => {
  const notices = ref<Notice[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastSeqno = ref(0);
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let generation = 0;
  let catchingUp = true;

  async function fetchNotices() {
    loading.value = true;
    error.value = null;
    const fetchGeneration = generation;
    try {
      const newNotices = await getNotices(lastSeqno.value);
      if (fetchGeneration !== generation) return;
      if (newNotices.length > 0) {
        notices.value = [...notices.value, ...newNotices];
        lastSeqno.value = Math.max(...newNotices.map((n) => n.seqno));
        if (!catchingUp) {
          notifyNewNotices(newNotices.length);
        }
      }
      catchingUp = false;
    } catch (e) {
      if (fetchGeneration !== generation) return;
      error.value = e instanceof Error ? e.message : String(e);
      const connection = useConnectionStore();
      connection.handleConnectionError();
    } finally {
      if (fetchGeneration === generation) {
        loading.value = false;
      }
    }
  }

  function startPolling(intervalMs = POLL_INTERVAL_MS) {
    stopPolling();
    fetchNotices();
    pollTimer = setInterval(fetchNotices, intervalMs);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function resetSessionState() {
    stopPolling();
    generation++;
    notices.value = [];
    lastSeqno.value = 0;
    loading.value = false;
    error.value = null;
    catchingUp = true;
  }

  return { notices, loading, error, fetchNotices, startPolling, stopPolling, resetSessionState };
});
