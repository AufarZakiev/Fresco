import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { getMessages } from "../composables/useRpc";
import type { Message } from "../types/boinc";

const POLL_INTERVAL_MS = 5000;

export const useMessagesStore = defineStore("messages", () => {
  const messages = ref<Message[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastSeqno = ref(0);
  const searchText = ref("");
  let pollTimer: ReturnType<typeof setInterval> | null = null;

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
      const newMessages = await getMessages(lastSeqno.value);
      if (newMessages.length > 0) {
        messages.value = [...messages.value, ...newMessages];
        lastSeqno.value = Math.max(
          ...newMessages.map((m) => m.seqno),
        );
      }
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
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
    fetchMessages,
    startPolling,
    stopPolling,
  };
});
