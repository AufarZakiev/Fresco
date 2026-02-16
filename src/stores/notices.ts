import { defineStore } from "pinia";
import { ref } from "vue";
import { getNotices } from "../composables/useRpc";
import { notifyNewNotices } from "../composables/useNotifications";
import type { Notice } from "../types/boinc";

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
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  }

  function startPolling(intervalMs = 30000) {
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
