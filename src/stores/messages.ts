import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { getMessages } from "../composables/useRpc";
import type { Message } from "../types/boinc";
import { MSG_PRIORITY } from "../types/boinc";

export const useMessagesStore = defineStore("messages", () => {
  const messages = ref<Message[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastSeqno = ref(0);
  const filterProject = ref("");
  const showErrorsOnly = ref(false);
  const searchText = ref("");
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const filteredMessages = computed(() => {
    let result = messages.value;
    if (filterProject.value) {
      result = result.filter((m) => m.project === filterProject.value);
    }
    if (showErrorsOnly.value) {
      result = result.filter(
        (m) => m.priority === MSG_PRIORITY.INTERNAL_ERROR,
      );
    }
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

  const projects = computed(() => {
    const set = new Set<string>();
    for (const m of messages.value) {
      if (m.project) set.add(m.project);
    }
    return Array.from(set).sort();
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

  function startPolling(intervalMs = 5000) {
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
    filterProject,
    showErrorsOnly,
    searchText,
    filteredMessages,
    projects,
    fetchMessages,
    startPolling,
    stopPolling,
  };
});
