import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { getMessages, getMessageCount } from "../composables/useRpc";
import type { Message } from "../types/boinc";
import { useConnectionStore } from "./connection";

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
  let generation = 0;

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
    const fetchGeneration = generation;
    try {
      if (!initialized) {
        const count = await getMessageCount();
        if (fetchGeneration !== generation) return;
        const startSeqno = Math.max(0, count - PAGE_SIZE);
        const initial = await getMessages(startSeqno);
        if (fetchGeneration !== generation) return;
        if (initial.length > 0) {
          messages.value = initial;
          lastSeqno.value = Math.max(...initial.map((m) => m.seqno));
        }
        hasMore.value = startSeqno > 0;
        initialized = true;
      } else {
        const newMessages = await getMessages(lastSeqno.value);
        if (fetchGeneration !== generation) return;
        if (newMessages.length > 0) {
          messages.value = [...messages.value, ...newMessages];
          lastSeqno.value = Math.max(...newMessages.map((m) => m.seqno));
        }
      }
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

  async function fetchOlderMessages() {
    if (!hasMore.value || loadingMore.value || messages.value.length === 0)
      return;

    loadingMore.value = true;
    const fetchGeneration = generation;
    try {
      const oldestSeqno = Math.min(...messages.value.map((m) => m.seqno));
      if (oldestSeqno <= 0) {
        hasMore.value = false;
        return;
      }

      // BOINC RPC `get_messages(seqno)` returns ALL messages with seqno > given value;
      // there is no server-side page size parameter. We request from (oldest - PAGE_SIZE)
      // and filter client-side to keep only the needed slice.
      const startSeqno = Math.max(0, oldestSeqno - PAGE_SIZE - 1);
      const older = await getMessages(startSeqno);
      if (fetchGeneration !== generation) return;
      const filtered = older.filter((m) => m.seqno < oldestSeqno);

      if (filtered.length > 0) {
        messages.value = [...filtered, ...messages.value];
      }

      hasMore.value = startSeqno > 0 && filtered.length > 0;
    } catch (e) {
      if (fetchGeneration !== generation) return;
      error.value = e instanceof Error ? e.message : String(e);
      const connection = useConnectionStore();
      connection.handleConnectionError();
    } finally {
      if (fetchGeneration === generation) {
        loadingMore.value = false;
      }
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

  function resetSessionState() {
    stopPolling();
    generation++;
    messages.value = [];
    lastSeqno.value = 0;
    hasMore.value = true;
    loadingMore.value = false;
    loading.value = false;
    error.value = null;
    initialized = false;
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
    resetSessionState,
  };
});
