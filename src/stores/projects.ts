import { defineStore } from "pinia";
import { ref } from "vue";
import type { Project } from "../types/boinc";
import {
  getProjectStatus,
  suspendProject as rpcSuspendProject,
  resumeProject as rpcResumeProject,
  updateProject as rpcUpdateProject,
  noNewTasksProject as rpcNoNewTasks,
  allowNewTasksProject as rpcAllowNewTasks,
  resetProject as rpcResetProject,
  detachProject as rpcDetachProject,
} from "../composables/useRpc";
import { useConnectionStore } from "./connection";

export const useProjectsStore = defineStore("projects", () => {
  const projects = ref<Project[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function fetchProjects() {
    loading.value = true;
    error.value = null;
    try {
      projects.value = await getProjectStatus();
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
    fetchProjects();
    pollTimer = setInterval(fetchProjects, intervalMs);
  }

  function stopPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function suspendProject(url: string) {
    await rpcSuspendProject(url);
    await fetchProjects();
  }

  async function resumeProject(url: string) {
    await rpcResumeProject(url);
    await fetchProjects();
  }

  async function updateProject(url: string) {
    await rpcUpdateProject(url);
    await fetchProjects();
  }

  async function noNewTasks(url: string) {
    await rpcNoNewTasks(url);
    await fetchProjects();
  }

  async function allowNewTasks(url: string) {
    await rpcAllowNewTasks(url);
    await fetchProjects();
  }

  async function resetProject(url: string) {
    await rpcResetProject(url);
    await fetchProjects();
  }

  async function detachProject(url: string) {
    await rpcDetachProject(url);
    await fetchProjects();
  }

  return {
    projects,
    loading,
    error,
    fetchProjects,
    startPolling,
    stopPolling,
    suspendProject,
    resumeProject,
    updateProject,
    noNewTasks,
    allowNewTasks,
    resetProject,
    detachProject,
  };
});
