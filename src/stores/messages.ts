import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { getMessages, getMessageCount } from "../composables/useRpc";
import type { Message } from "../types/boinc";

const POLL_INTERVAL_MS = 5000;
const PAGE_SIZE = 50;

export const useMessagesStore = defineStore("messages", () => {
  const messages = ref<Message[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastSeqno = ref(0);
  const searchText = ref("");
  const hasMore = ref(true);
  const loadingMore = ref(false);
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let initialized = false;

  const filteredMessages = computed(() => {
    let result = messages.value;
    if (searchText.value) {
      const term = searchText.value.toLowerCase();
      result = result.filter(
        (m) =>
          m.body.toLowerCase().includes(term) ||
          (m.project && m.project.toLowerCase().includes(term)),
      );
    }
    return result;
  });

  async function fetchMessages() {
    loading.value = true;
    error.value = null;
    try {
      if (!initialized) {
        const count = await getMessageCount();
        const startSeqno = Math.max(0, count - PAGE_SIZE);
        const initial = await getMessages(startSeqno);
        if (initial.length > 0) {
          messages.value = initial;
          lastSeqno.value = Math.max(...initial.map((m) => m.seqno));
        }
        hasMore.value = startSeqno > 0;
        initialized = true;
      } else {
        const newMessages = await getMessages(lastSeqno.value);
        if (newMessages.length > 0) {
          messages.value = [...messages.value, ...newMessages];
          lastSeqno.value = Math.max(
            ...newMessages.map((m) => m.seqno),
          );
        }
      }
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchOlderMessages() {
    if (!hasMore.value || loadingMore.value || messages.value.length === 0)
      return;

    loadingMore.value = true;
    try {
      const oldestSeqno = Math.min(...messages.value.map((m) => m.seqno));
      if (oldestSeqno <= 0) {
        hasMore.value = false;
        return;
      }

      const startSeqno = Math.max(0, oldestSeqno - PAGE_SIZE - 1);
      const older = await getMessages(startSeqno);
      const filtered = older.filter((m) => m.seqno < oldestSeqno);

      if (filtered.length > 0) {
        messages.value = [...filtered, ...messages.value];
      }

      hasMore.value = startSeqno > 0 && filtered.length > 0;
    } catch (e) {
      error.value = String(e);
    } finally {
      loadingMore.value = false;
    }
  }

  function startPolling(intervalMs = POLL_INTERVAL_MS) {
    stopPolling();
    fetchMessages();
    pollTimer = setInterval(fetchMessages, intervalMs);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  return {
    messages,
    loading,
    error,
    searchText,
    filteredMessages,
    hasMore,
    loadingMore,
    fetchMessages,
    fetchOlderMessages,
    startPolling,
    stopPolling,
  };
});
