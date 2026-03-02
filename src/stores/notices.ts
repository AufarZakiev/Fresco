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

  async function fetchNotices() {
    loading.value = true;
    error.value = null;
    try {
      const newNotices = await getNotices(lastSeqno.value);
      if (newNotices.length > 0) {
        notices.value = [...notices.value, ...newNotices];
        lastSeqno.value = Math.max(...newNotices.map((n) => n.seqno));
        notifyNewNotices(newNotices.length);
      }
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
    fetchNotices();
    pollTimer = setInterval(fetchNotices, intervalMs);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  return { notices, loading, error, fetchNotices, startPolling, stopPolling };
});
