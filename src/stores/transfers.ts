import { defineStore } from "pinia";
import { ref } from "vue";
import type { FileTransfer } from "../types/boinc";
import {
  getTransfers,
  retryTransfer as rpcRetryTransfer,
  abortTransfer as rpcAbortTransfer,
} from "../composables/useRpc";
import { useConnectionStore } from "./connection";

const POLL_INTERVAL_MS = 2000;

export const useTransfersStore = defineStore("transfers", () => {
  const transfers = ref<FileTransfer[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function fetchTransfers() {
    loading.value = true;
    error.value = null;
    try {
      transfers.value = await getTransfers();
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
    fetchTransfers();
    pollTimer = setInterval(fetchTransfers, intervalMs);
  }

  function stopPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function retryTransfer(projectUrl: string, filename: string) {
    await rpcRetryTransfer(projectUrl, filename);
    await fetchTransfers();
  }

  async function abortTransfer(projectUrl: string, filename: string) {
    await rpcAbortTransfer(projectUrl, filename);
    await fetchTransfers();
  }

  return {
    transfers,
    loading,
    error,
    fetchTransfers,
    startPolling,
    stopPolling,
    retryTransfer,
    abortTransfer,
  };
});
