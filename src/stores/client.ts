import { defineStore } from "pinia";
import { ref } from "vue";
import type { CcStatus } from "../types/boinc";
import {
  getCcStatus,
  setRunMode as rpcSetRunMode,
  setGpuMode as rpcSetGpuMode,
  setNetworkMode as rpcSetNetworkMode,
  runBenchmarks as rpcRunBenchmarks,
  retryPendingTransfers as rpcRetryPendingTransfers,
  shutdownClient as rpcShutdownClient,
} from "../composables/useRpc";
import { useConnectionStore } from "./connection";

const defaultStatus: CcStatus = {
  task_mode: 0,
  task_mode_perm: 0,
  task_mode_delay: 0,
  gpu_mode: 0,
  gpu_mode_perm: 0,
  gpu_mode_delay: 0,
  network_mode: 0,
  network_mode_perm: 0,
  network_mode_delay: 0,
  network_status: 0,
  task_suspend_reason: 0,
  gpu_suspend_reason: 0,
  network_suspend_reason: 0,
  ams_password_error: false,
  manager_must_quit: false,
  disallow_attach: false,
  simple_gui_only: false,
  max_event_log_lines: 0,
};

export const useClientStore = defineStore("client", () => {
  const status = ref<CcStatus>({ ...defaultStatus });
  const loading = ref(false);
  const error = ref<string | null>(null);

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function fetchStatus() {
    loading.value = true;
    error.value = null;
    try {
      status.value = await getCcStatus();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      const connection = useConnectionStore();
      connection.handleConnectionError();
    } finally {
      loading.value = false;
    }
  }

  function startPolling(intervalMs = 5000) {
    stopPolling();
    fetchStatus();
    pollTimer = setInterval(fetchStatus, intervalMs);
  }

  function stopPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function setRunMode(mode: number) {
    await rpcSetRunMode(mode, 0);
    await fetchStatus();
  }

  async function setGpuMode(mode: number) {
    await rpcSetGpuMode(mode, 0);
    await fetchStatus();
  }

  async function setNetworkMode(mode: number) {
    await rpcSetNetworkMode(mode, 0);
    await fetchStatus();
  }

  async function runBenchmarks() {
    await rpcRunBenchmarks();
  }

  async function retryPendingTransfers() {
    await rpcRetryPendingTransfers();
  }

  async function shutdownClient() {
    await rpcShutdownClient();
  }

  return {
    status,
    loading,
    error,
    fetchStatus,
    startPolling,
    stopPolling,
    setRunMode,
    setGpuMode,
    setNetworkMode,
    runBenchmarks,
    retryPendingTransfers,
    shutdownClient,
  };
});
