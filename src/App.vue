<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useRoute, useRouter } from "vue-router";
import { useConnectionStore } from "./stores/connection";
import { CONNECTION_STATE } from "./types/boinc";
import ActivityControls from "./components/ActivityControls.vue";
import PreferencesDialog from "./components/PreferencesDialog.vue";
import AboutDialog from "./components/AboutDialog.vue";
import StatusBar from "./components/StatusBar.vue";
import AccountManagerWizard from "./components/AccountManagerWizard.vue";
import SelectComputerDialog from "./components/SelectComputerDialog.vue";
import ProjectAttachWizard from "./components/ProjectAttachWizard.vue";
import ExitConfirmDialog from "./components/ExitConfirmDialog.vue";
import ToastContainer from "./components/ToastContainer.vue";
import UpdateBanner from "./components/UpdateBanner.vue";
import { useWindowState } from "./composables/useWindowState";
import { useUpdateCheck } from "./composables/useUpdateCheck";
import { notifyConnectionLost } from "./composables/useNotifications";
import { useTasksStore } from "./stores/tasks";
import { useProjectsStore } from "./stores/projects";
import { useTransfersStore } from "./stores/transfers";
import { useClientStore } from "./stores/client";
import { useStatisticsStore } from "./stores/statistics";
import { useMessagesStore } from "./stores/messages";
import { useNoticesStore } from "./stores/notices";
import { useDiskUsageStore } from "./stores/diskUsage";
import { usePreferencesStore } from "./stores/preferences";
import { useManagerSettingsStore } from "./stores/managerSettings";
import {
  setRunMode,
  setGpuMode,
  shutdownClient,
  disconnect,
  getHostInfo,
  startBoincClient,
} from "./composables/useRpc";

const connection = useConnectionStore();
const route = useRoute();
const router = useRouter();
const tasksStore = useTasksStore();
const projectsStore = useProjectsStore();
const transfersStore = useTransfersStore();
const clientStore = useClientStore();
const statisticsStore = useStatisticsStore();
const messagesStore = useMessagesStore();
const noticesStore = useNoticesStore();
const diskUsageStore = useDiskUsageStore();
const preferencesStore = usePreferencesStore();
useManagerSettingsStore(); // Initialize early to apply theme before ConnectView renders
const showPreferences = ref(false);
const showAbout = ref(false);
const showAcctMgr = ref(false);
const showSelectComputer = ref(false);
const showAddProject = ref(false);
const prefsInitialTab = ref<"computing" | "manager">("computing");
const showExitConfirm = ref(false);
const initializing = ref(true);
const loadingStatus = ref("Connecting to a local BOINC...");
const sidebarOpen = ref(false);
const hasSidebar = computed(
  () => connection.state === CONNECTION_STATE.CONNECTED || connection.state === CONNECTION_STATE.RECONNECTING,
);
let autoConnectCancelled = false;

useWindowState();
const { updateAvailable, dismissed, updateOnExit, downloaded, downloading, checkForUpdates: doUpdateCheck } = useUpdateCheck();

// ── Auto-connect to local BOINC client on startup ───────────────

function defaultDataDir(): string {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("win")) return "C:\\ProgramData\\BOINC";
  if (platform.includes("mac")) return "/Library/Application Support/BOINC Data";
  return "/var/lib/boinc-client";
}

function startAllPolling() {
  tasksStore.startPolling();
  projectsStore.startPolling();
  transfersStore.startPolling();
  clientStore.startPolling();
  statisticsStore.startPolling();
  messagesStore.startPolling();
  noticesStore.startPolling();
  diskUsageStore.startPolling();
  preferencesStore.prefetch();
}

async function autoConnect() {
  const dataDir = defaultDataDir();
  loadingStatus.value = "Connecting to a local BOINC...";
  await connection.connectToLocal(dataDir);

  // If connection failed with a non-auth error, try auto-starting BOINC
  if (connection.state !== CONNECTION_STATE.CONNECTED && connection.state !== CONNECTION_STATE.AUTH_ERROR) {
    loadingStatus.value = "Starting BOINC, this may take a while...";
    try {
      await startBoincClient(dataDir);
      loadingStatus.value = "BOINC started, connecting...";
      await connection.connectToLocal(dataDir);
    } catch {
      // BOINC not installed or failed to start — fall back to ConnectView
    }
  }

  if (autoConnectCancelled) return;

  if (connection.state === CONNECTION_STATE.CONNECTED) {
    startAllPolling();
    router.push("/tasks");
    invoke("cleanup_old_binary").catch(() => {});
  } else {
    // Auto-connect failed — show ConnectView
    router.replace("/");
  }
  initializing.value = false;
}

function cancelAutoConnect() {
  autoConnectCancelled = true;
  initializing.value = false;
  router.replace("/");
}

// ── Tauri event listeners for system tray ───────────────────────
type UnlistenFn = () => void;
const unlisteners: UnlistenFn[] = [];

onMounted(async () => {
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  doUpdateCheck();
  autoConnect();

  try {
    const { listen } = await import("@tauri-apps/api/event");

    // Tray actions
    unlisteners.push(
      await listen<string>("tray-action", (event) => {
        switch (event.payload) {
          case "snooze_cpu":
            setRunMode(3, 3600).catch(() => {});
            break;
          case "snooze_gpu":
            setGpuMode(3, 3600).catch(() => {});
            break;
          case "resume":
            setRunMode(0, 0).catch(() => {});
            setGpuMode(0, 0).catch(() => {});
            break;
          case "about":
            showAbout.value = true;
            break;
        }
      }),
    );

    // Window close is handled in Rust (on_window_event in lib.rs)
  } catch {
    // Not in Tauri environment (e.g. tests, browser dev)
  }
});

onUnmounted(() => {
  unlisteners.forEach((fn) => fn());
});

async function doExit(doShutdownClient: boolean) {
  showExitConfirm.value = false;
  try {
    if (doShutdownClient) {
      await shutdownClient();
    }
    await disconnect();
  } catch {
    // ignore
  }
  if (updateOnExit.value && downloaded.value && !downloading.value) {
    try {
      await invoke("install_update");
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
      return;
    } catch {
      // Install failed — exit normally
    }
  }
  try {
    const { getCurrentWebviewWindow } = await import(
      "@tauri-apps/api/webviewWindow"
    );
    await getCurrentWebviewWindow().destroy();
  } catch {
    // ignore
  }
}

const navGroups = [
  {
    label: "Computing",
    items: [
      { path: "/tasks", label: "Tasks", icon: "cpu" },
      { path: "/projects", label: "Projects", icon: "folder" },
      { path: "/statistics", label: "Statistics", icon: "chart" },
    ],
  },
  {
    label: "Network",
    items: [
      { path: "/transfers", label: "Transfers", icon: "transfer" },
      { path: "/messages", label: "Messages", icon: "message" },
      { path: "/notices", label: "Notices", icon: "bell" },
    ],
  },
  {
    label: "System",
    items: [
      { path: "/disk", label: "Disk Usage", icon: "disk" },
      { path: "/host", label: "Host Info", icon: "monitor" },
    ],
  },
];

function isActive(path: string): boolean {
  return route.path === path;
}

let wasConnected = false;
watch(
  () => connection.state,
  async (newState) => {
    if (newState === CONNECTION_STATE.CONNECTED) {
      wasConnected = true;
      try {
        const { getCurrentWebviewWindow } = await import(
          "@tauri-apps/api/webviewWindow"
        );
        const win = getCurrentWebviewWindow();
        const info = await getHostInfo();
        if (info.domain_name) {
          win.setTitle(`BOINC — ${info.domain_name}`);
        }
      } catch {
        // ignore if not in Tauri environment
      }
    } else if (newState === CONNECTION_STATE.RECONNECTING) {
      // Don't reset wasConnected — we're trying to reconnect
    } else if (wasConnected && newState !== CONNECTION_STATE.CONNECTING) {
      wasConnected = false;
      notifyConnectionLost();
    }
  },
);
</script>

<template>
  <div v-if="initializing" class="loading-screen">
    <div class="loading-content">
      <span class="loading-logo">Fresco</span>
      <div class="loading-spinner"></div>
      <span class="loading-text">{{ loadingStatus }}</span>
      <button class="btn loading-cancel" @click="cancelAutoConnect">Cancel</button>
    </div>
  </div>
  <div v-else class="app" :class="{ 'has-sidebar': hasSidebar }">
    <button
      v-if="hasSidebar"
      class="hamburger-btn"
      aria-label="Toggle sidebar"
      @click="sidebarOpen = !sidebarOpen"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
        <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
      </svg>
    </button>
    <div
      v-if="sidebarOpen && (hasSidebar)"
      class="sidebar-backdrop"
      @click="sidebarOpen = false"
    ></div>
    <aside v-if="hasSidebar" class="sidebar" :class="{ open: sidebarOpen }">
      <nav class="sidebar-nav">
        <div v-for="group in navGroups" :key="group.label" class="nav-group">
          <span class="nav-group-label">{{ group.label }}</span>
          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: isActive(item.path) }"
            @click="sidebarOpen = false"
          >
            <svg class="nav-icon" viewBox="0 0 20 20" fill="currentColor">
              <template v-if="item.icon === 'cpu'">
                <path d="M13 7H7v6h6V7z" />
                <path fill-rule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h1a2 2 0 012 2v1h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v1a2 2 0 01-2 2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H6a2 2 0 01-2-2v-1H3a1 1 0 110-2h1V8H3a1 1 0 010-2h1V5a2 2 0 012-2V2zm0 3h6a1 1 0 011 1v6a1 1 0 01-1 1H7a1 1 0 01-1-1V6a1 1 0 011-1z" clip-rule="evenodd" />
              </template>
              <template v-else-if="item.icon === 'folder'">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </template>
              <template v-else-if="item.icon === 'chart'">
                <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
              </template>
              <template v-else-if="item.icon === 'transfer'">
                <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
              </template>
              <template v-else-if="item.icon === 'message'">
                <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
              </template>
              <template v-else-if="item.icon === 'bell'">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </template>
              <template v-else-if="item.icon === 'disk'">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
              </template>
              <template v-else-if="item.icon === 'monitor'">
                <path fill-rule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm11 1H6v3h8V6zM6 15a1 1 0 100 2h8a1 1 0 100-2H6z" clip-rule="evenodd" />
              </template>
            </svg>
            {{ item.label }}
          </router-link>
        </div>
      </nav>

      <div class="sidebar-footer">
        <ActivityControls />
        <div class="sidebar-actions">
          <button class="sidebar-action-btn" title="Add Project" @click="showAddProject = true">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
          </button>
          <button class="sidebar-action-btn" title="Select Computer" @click="showSelectComputer = true">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fill-rule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm11 1H6v3h8V6zM6 15a1 1 0 100 2h8a1 1 0 100-2H6z" clip-rule="evenodd" />
            </svg>
          </button>
          <button class="sidebar-action-btn" title="Account Manager" @click="showAcctMgr = true">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
            </svg>
          </button>
          <button class="sidebar-action-btn" title="Preferences" @click="prefsInitialTab = 'computing'; showPreferences = true">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
    <main class="main-content">
      <UpdateBanner v-if="updateAvailable && !dismissed" />
      <router-view />
    </main>

    <StatusBar v-if="hasSidebar" @show-about="showAbout = true" />

    <PreferencesDialog
      :open="showPreferences"
      :initial-tab="prefsInitialTab"
      @close="showPreferences = false"
    />
    <AboutDialog :open="showAbout" @close="showAbout = false" />
    <AccountManagerWizard
      :open="showAcctMgr"
      @close="showAcctMgr = false"
    />
    <SelectComputerDialog
      :open="showSelectComputer"
      @close="showSelectComputer = false"
    />
    <ProjectAttachWizard
      :open="showAddProject"
      @close="showAddProject = false"
    />
    <ExitConfirmDialog
      :open="showExitConfirm"
      @close="showExitConfirm = false"
      @confirm="doExit"
    />
    <ToastContainer />
  </div>
</template>

<style>
@import "./styles/tokens.css";

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto,
    Helvetica, Arial, sans-serif;
  color: var(--color-text-primary);
  background: var(--color-bg);
  font-size: var(--font-size-base);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Global button styles */
.btn {
  padding: 6px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-weight: 500;
}

.btn:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-border);
}

.btn-primary {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.btn-primary:hover {
  background: var(--color-accent-hover);
  border-color: var(--color-accent-hover);
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-danger {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.btn-danger:hover {
  background: var(--color-danger-light);
}

/* Global input dark mode support */
input, textarea, select {
  color-scheme: light dark;
}
</style>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
}

.app.has-sidebar .main-content {
  margin-left: var(--sidebar-width);
  flex: 1;
  min-width: 0;
}

.main-content {
  flex: 1;
  padding-bottom: 28px;
}

/* ── Sidebar ──────────────────────────────────────────────────── */

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: var(--sidebar-width);
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  z-index: 10;
  overflow-y: auto;
}

/* ── Nav ──────────────────────────────────────────────────────── */

.sidebar-nav {
  flex: 1;
  padding: 4px 8px;
}

.nav-group {
  margin-bottom: 16px;
}

.nav-group-label {
  display: block;
  padding: 4px 10px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  text-decoration: none;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
  font-weight: 450;
}

.nav-item:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.nav-item.active {
  background: var(--color-accent-light);
  color: var(--color-accent);
  font-weight: 550;
}

.nav-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  opacity: 0.7;
}

.nav-item.active .nav-icon {
  opacity: 1;
}

/* ── Footer ───────────────────────────────────────────────────── */

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--color-border);
}

.sidebar-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
}

.sidebar-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.sidebar-action-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

/* ── Loading screen ──────────────────────────────────────────── */

.loading-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.loading-logo {
  font-weight: 700;
  font-size: 24px;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2.5px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
}

.loading-cancel {
  margin-top: 4px;
  padding: 6px 24px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Hamburger button (mobile only) ─────────────────────────── */

.hamburger-btn {
  display: none;
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 21;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text-primary);
  cursor: pointer;
}

.sidebar-backdrop {
  display: none;
}

/* ── Responsive: mobile < 768px ─────────────────────────────── */

@media (max-width: 767px) {
  .hamburger-btn {
    display: flex;
  }

  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 9;
  }

  .sidebar {
    transform: translateX(-100%);
    transition: transform var(--transition-normal);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .app.has-sidebar .main-content {
    margin-left: 0;
    padding-top: 52px;
  }
}
</style>
