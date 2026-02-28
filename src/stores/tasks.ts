import { defineStore } from "pinia";
import { ref } from "vue";
import type { TaskResult } from "../types/boinc";
import {
  getResults,
  suspendTask as rpcSuspendTask,
  resumeTask as rpcResumeTask,
  abortTask as rpcAbortTask,
} from "../composables/useRpc";
import { useConnectionStore } from "./connection";

const POLL_INTERVAL_MS = 2000;

export const useTasksStore = defineStore("tasks", () => {
  const tasks = ref<TaskResult[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function fetchTasks() {
    loading.value = true;
    error.value = null;
    try {
      tasks.value = await getResults(false);
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
    fetchTasks();
    pollTimer = setInterval(fetchTasks, intervalMs);
  }

  function stopPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function suspendTask(projectUrl: string, name: string) {
    await rpcSuspendTask(projectUrl, name);
    await fetchTasks();
  }

  async function resumeTask(projectUrl: string, name: string) {
    await rpcResumeTask(projectUrl, name);
    await fetchTasks();
  }

  async function abortTask(projectUrl: string, name: string) {
    await rpcAbortTask(projectUrl, name);
    await fetchTasks();
  }

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    startPolling,
    stopPolling,
    suspendTask,
    resumeTask,
    abortTask,
  };
});
