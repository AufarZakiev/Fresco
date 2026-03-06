<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, provide } from "vue";
import { onKeyStroke, useEventListener } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import { useRoute, useRouter } from "vue-router";
import { useConnectionStore } from "./stores/connection";
import { CONNECTION_STATE } from "./types/boinc";
import ActivityControls from "./components/ActivityControls.vue";
import PreferencesDialog from "./components/PreferencesDialog.vue";
import AboutDialog from "./components/AboutDialog.vue";
import StatusBar from "./components/StatusBar.vue";
import SelectComputerDialog from "./components/SelectComputerDialog.vue";
import ExitConfirmDialog from "./components/ExitConfirmDialog.vue";
import ToastContainer from "./components/ToastContainer.vue";
import UpdateBanner from "./components/UpdateBanner.vue";
import ProjectAttachWizard from "./components/ProjectAttachWizard.vue";
import AccountManagerWizard from "./components/AccountManagerWizard.vue";
import Tooltip from "./components/Tooltip.vue";
import { useWindowState } from "./composables/useWindowState";
import { useUpdateCheck } from "./composables/useUpdateCheck";
import { getOS, defaultDataDir } from "./composables/usePlatform";
import { notifyConnectionLost } from "./composables/useNotifications";
import { useTasksStore } from "./stores/tasks";
import { useProjectsStore } from "./stores/projects";
import { useTransfersStore } from "./stores/transfers";
import { useClientStore } from "./stores/client";
import { getSuspendReasonText } from "./composables/useSuspendReasons";
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
  startBoincClient,
} from "./composables/useRpc";

const { t } = useI18n();
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
const showSelectComputer = ref(false);
const showAttachWizard = ref(false);
const showAcctMgr = ref(false);
provide("openAttachWizard", () => { showAttachWizard.value = true; });
provide("openAcctMgr", () => { showAcctMgr.value = true; });
const prefsInitialTab = ref<"computing" | "manager">("computing");
const showExitConfirm = ref(false);
const initializing = ref(true);
const loadingStatus = ref(t("app.loading.connectingLocal"));
const isDarkTheme = ref(
  window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
);
window
  .matchMedia?.("(prefers-color-scheme: dark)")
  .addEventListener("change", (e) => {
    isDarkTheme.value = e.matches;
  });
const sidebarOpen = ref(false);
const collapsedGroups = ref<string[]>(["advanced"]);

function isCollapsed(key: string): boolean {
  return collapsedGroups.value.includes(key);
}

function toggleCollapsed(key: string) {
  if (isCollapsed(key)) {
    collapsedGroups.value = collapsedGroups.value.filter((l) => l !== key);
  } else {
    collapsedGroups.value = [...collapsedGroups.value, key];
  }
}
const hasSidebar = computed(
  () =>
    connection.state === CONNECTION_STATE.CONNECTED ||
    connection.state === CONNECTION_STATE.RECONNECTING,
);

const hasStatusBar = computed(() => {
  const client = useClientStore();
  return !!(
    getSuspendReasonText(client.status.task_suspend_reason) ||
    getSuspendReasonText(client.status.gpu_suspend_reason)
  );
});

const statusDotClass = computed(() => {
  const state = connection.state;
  if (state === CONNECTION_STATE.CONNECTED) return "status-dot-connected";
  if (state === CONNECTION_STATE.RECONNECTING) return "status-dot-reconnecting";
  if (
    state === CONNECTION_STATE.AUTH_ERROR ||
    (typeof state === "object" && "Error" in state)
  )
    return "status-dot-error";
  return "status-dot-disconnected";
});

const statusText = computed(() => {
  const state = connection.state;
  if (state === CONNECTION_STATE.CONNECTED) return t("statusBar.connected");
  if (state === CONNECTION_STATE.RECONNECTING)
    return t("statusBar.reconnecting", {
      attempt: connection.reconnectAttempt,
      max: connection.maxReconnectAttempts,
    });
  if (state === CONNECTION_STATE.CONNECTING) return t("statusBar.connecting");
  if (state === CONNECTION_STATE.AUTH_ERROR) return t("statusBar.authError");
  if (state === CONNECTION_STATE.DISCONNECTED)
    return t("statusBar.disconnected");
  if (typeof state === "object" && "Error" in state)
    return t("statusBar.error");
  return t("statusBar.disconnected");
});
let autoConnectCancelled = false;

useWindowState();
const {
  updateAvailable,
  dismissed,
  updateOnExit,
  downloaded,
  downloading,
  checkForUpdates: doUpdateCheck,
} = useUpdateCheck();

// ── Auto-connect to local BOINC client on startup ───────────────

function startAllPolling() {
  messagesStore.resetSessionState();
  noticesStore.resetSessionState();
  tasksStore.startPolling();
  projectsStore.startPolling();
  transfersStore.startPolling();
  clientStore.startPolling();
  statisticsStore.startPolling();
  messagesStore.startPolling();
  noticesStore.startPolling();
  diskUsageStore.startPolling();
  preferencesStore.prefetchPreferences();
}

async function autoConnect() {
  const dataDir = defaultDataDir(await getOS());
  loadingStatus.value = t("app.loading.connectingLocal");
  await connection.connectToLocal(dataDir);

  // If connection failed with a non-auth error, try auto-starting BOINC
  if (
    connection.state !== CONNECTION_STATE.CONNECTED &&
    connection.state !== CONNECTION_STATE.AUTH_ERROR
  ) {
    loadingStatus.value = t("app.loading.startingBoinc");
    try {
      await startBoincClient(dataDir);
      loadingStatus.value = t("app.loading.boincStarted");
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

// Disable right-click context menu in the entire app,
// but allow native context menu in editable elements (input, textarea, contenteditable)
useEventListener(document, "contextmenu", (e) => {
  if (!isTextEditable(e.target)) {
    e.preventDefault();
  }
});

// Prevent Backspace from triggering browser-like back navigation in the WebView.
// Only allow Backspace in text-editable elements (text inputs, textareas, contenteditable).
const TEXT_INPUT_TYPES = new Set([
  "text",
  "password",
  "search",
  "email",
  "url",
  "tel",
  "number",
]);

function isTextEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has(target.type);
  }
  return false;
}

onKeyStroke("Backspace", (e) => {
  if (!isTextEditable(e.target)) {
    e.preventDefault();
  }
});

onMounted(async () => {
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
          case "resume_cpu":
            setRunMode(4, 0).catch(() => {});
            break;
          case "resume_gpu":
            setGpuMode(4, 0).catch(() => {});
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
      const shouldRelaunch: boolean = await invoke("install_update");
      const process = await import("@tauri-apps/plugin-process");
      if (shouldRelaunch) {
        await process.relaunch();
      } else {
        await process.exit(0);
      }
      return;
    } catch {
      // Install failed — exit normally
    }
  }
  try {
    const { getCurrentWebviewWindow } =
      await import("@tauri-apps/api/webviewWindow");
    await getCurrentWebviewWindow().destroy();
  } catch {
    // ignore
  }
}

const navGroups = computed(() => [
  {
    key: "computing",
    label: t("sidebar.computing"),
    items: [
      { path: "/tasks", label: t("sidebar.tasks"), icon: "cpu" },
      { path: "/projects", label: t("sidebar.projects"), icon: "folder" },
      { path: "/notices", label: t("sidebar.notices"), icon: "bell" },
      { path: "/statistics", label: t("sidebar.statistics"), icon: "chart" },
    ],
  },
  {
    key: "system",
    label: t("sidebar.system"),
    items: [
      { path: "/disk", label: t("sidebar.diskUsage"), icon: "disk" },
      { path: "/host", label: t("sidebar.hostInfo"), icon: "monitor" },
    ],
  },
  {
    key: "advanced",
    label: t("sidebar.advanced"),
    collapsible: true,
    items: [
      { path: "/transfers", label: t("sidebar.transfers"), icon: "transfer" },
      { path: "/event-log", label: t("sidebar.eventLog"), icon: "message" },
    ],
  },
]);

function isActive(path: string): boolean {
  return route.path === path;
}

// Auto-expand collapsed group when its route is active
watch(
  () => route.path,
  (path) => {
    for (const group of navGroups.value) {
      if (group.collapsible && group.items.some((i) => i.path === path)) {
        collapsedGroups.value = collapsedGroups.value.filter(
          (l) => l !== group.key,
        );
      }
    }
  },
);

let wasConnected = false;
watch(
  () => connection.state,
  async (newState) => {
    if (newState === CONNECTION_STATE.CONNECTED) {
      wasConnected = true;
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
      <img
        class="loading-logo"
        :src="isDarkTheme ? '/icon-dark.png' : '/icon.png'"
        alt="Fresco"
        width="96"
        height="96"
      />
      <span class="loading-app-title">Fresco</span>
      <div class="loading-spinner"></div>
      <span class="loading-text">{{ loadingStatus }}</span>
      <button class="btn loading-cancel" @click="cancelAutoConnect">
        {{ $t("app.loading.cancel") }}
      </button>
    </div>
  </div>
  <div v-else class="app" :class="{ 'has-sidebar': hasSidebar }">
    <a href="#main-content" class="skip-link">{{ $t("app.skipToContent") }}</a>
    <button
      v-if="hasSidebar"
      class="hamburger-btn"
      :aria-label="$t('sidebar.toggleSidebar')"
      @click="sidebarOpen = !sidebarOpen"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
        <path
          fill-rule="evenodd"
          d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
    <div
      v-if="sidebarOpen && hasSidebar"
      class="sidebar-backdrop"
      @click="sidebarOpen = false"
    ></div>
    <aside v-if="hasSidebar" class="sidebar" :class="{ open: sidebarOpen }">
      <nav class="sidebar-nav">
        <div v-for="group in navGroups" :key="group.key" class="nav-group">
          <button
            v-if="group.collapsible"
            type="button"
            class="nav-group-label clickable"
            :aria-expanded="!isCollapsed(group.key)"
            @click="toggleCollapsed(group.key)"
          >
            <span
              class="nav-group-chevron"
              :class="{ collapsed: isCollapsed(group.key) }"
              aria-hidden="true"
              >&#9662;</span
            >
            {{ group.label }}
          </button>
          <span v-else class="nav-group-label">
            {{ group.label }}
          </span>
          <router-link
            v-for="item in group.items"
            v-show="!group.collapsible || !isCollapsed(group.key)"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: isActive(item.path) }"
            @click="sidebarOpen = false"
          >
            <svg class="nav-icon" viewBox="0 0 20 20" fill="currentColor">
              <template v-if="item.icon === 'cpu'">
                <path d="M13 7H7v6h6V7z" />
                <path
                  fill-rule="evenodd"
                  d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h1a2 2 0 012 2v1h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v1a2 2 0 01-2 2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H6a2 2 0 01-2-2v-1H3a1 1 0 110-2h1V8H3a1 1 0 010-2h1V5a2 2 0 012-2V2zm0 3h6a1 1 0 011 1v6a1 1 0 01-1 1H7a1 1 0 01-1-1V6a1 1 0 011-1z"
                  clip-rule="evenodd"
                />
              </template>
              <template v-else-if="item.icon === 'folder'">
                <path
                  d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
                />
              </template>
              <template v-else-if="item.icon === 'chart'">
                <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
              </template>
              <template v-else-if="item.icon === 'transfer'">
                <path
                  fill-rule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </template>
              <template v-else-if="item.icon === 'message'">
                <path
                  fill-rule="evenodd"
                  d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                  clip-rule="evenodd"
                />
              </template>
              <template v-else-if="item.icon === 'bell'">
                <path
                  d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"
                />
              </template>
              <template v-else-if="item.icon === 'disk'">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clip-rule="evenodd"
                />
              </template>
              <template v-else-if="item.icon === 'monitor'">
                <path
                  fill-rule="evenodd"
                  d="M3 5a2 2 0 012-2h10a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm11 1H6v3h8V6zM6 15a1 1 0 100 2h8a1 1 0 100-2H6z"
                  clip-rule="evenodd"
                />
              </template>
            </svg>
            {{ item.label }}
          </router-link>
        </div>
      </nav>

      <div class="sidebar-footer">
        <ActivityControls />
        <div class="sidebar-actions">
          <Tooltip :text="$t('statusBar.clickToSwitch')" placement="top">
            <div class="sidebar-status" @click="showSelectComputer = true">
              <span class="status-dot" :class="statusDotClass" />
              <span class="status-label">{{ statusText }}</span>
            </div>
          </Tooltip>
          <div class="sidebar-actions-btns">
            <Tooltip :text="$t('sidebar.preferences')">
              <button
                class="sidebar-action-btn"
                :aria-label="$t('sidebar.preferences')"
                @click="
                  prefsInitialTab = 'computing';
                  showPreferences = true;
                "
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  width="18"
                  height="18"
                >
                  <path
                    fill-rule="evenodd"
                    d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </Tooltip>
            <Tooltip :text="$t('statusBar.about')">
              <button
                class="sidebar-action-btn"
                :aria-label="$t('statusBar.about')"
                @click="showAbout = true"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  width="18"
                  height="18"
                >
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </aside>
    <main id="main-content" class="main-content" :style="{ '--status-bar-offset': hasStatusBar ? '28px' : '0px' }">
      <UpdateBanner v-if="updateAvailable && !dismissed" />
      <router-view />
    </main>

    <StatusBar v-if="hasSidebar" />

    <PreferencesDialog
      :open="showPreferences"
      :initial-tab="prefsInitialTab"
      @close="showPreferences = false"
    />
    <AboutDialog :open="showAbout" @close="showAbout = false" />
    <SelectComputerDialog
      :open="showSelectComputer"
      @close="showSelectComputer = false"
      @connected="startAllPolling(); router.push('/tasks')"
    />
    <ExitConfirmDialog
      :open="showExitConfirm"
      @close="showExitConfirm = false"
      @confirm="doExit"
    />
    <ProjectAttachWizard
      v-if="showAttachWizard"
      :open="showAttachWizard"
      @close="showAttachWizard = false"
    />
    <AccountManagerWizard
      v-if="showAcctMgr"
      :open="showAcctMgr"
      @close="showAcctMgr = false"
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

/* Global focus-visible outline for keyboard navigation (WCAG 2.4.7) */
:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

/* Remove default focus for mouse users */
:focus:not(:focus-visible) {
  outline: none;
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
input,
textarea,
select {
  color-scheme: light dark;
}

/* Global icon button style for drawer actions */
.btn.icon-btn {
  display: inline-flex !important;
  align-items: center;
  gap: 6px;
  padding-left: 8px !important;
}

.icon-btn svg {
  flex-shrink: 0;
  opacity: 0.7;
}

/* Global dialog animations */
.dialog-overlay {
  animation: overlay-in 0.2s ease;
}

.dialog-overlay > * {
  animation: dialog-in 0.2s cubic-bezier(0.2, 0, 0.13, 1.5);
}

@keyframes overlay-in {
  from {
    opacity: 0;
  }
}

@keyframes dialog-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
}
</style>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  overflow: hidden;
}

.app.has-sidebar .main-content {
  margin-left: var(--sidebar-width);
  flex: 1;
  min-width: 0;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  z-index: var(--z-sidebar-overlay);
}

/* ── Nav ──────────────────────────────────────────────────────── */

.sidebar-nav {
  flex: 1;
  padding: 4px 0 4px 8px;
  overflow-y: auto;
}

.nav-group {
  margin-bottom: 16px;
}

.nav-group-label {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}

button.nav-group-label {
  background: none;
  border: none;
  font: inherit;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: left;
  width: 100%;
  padding: 0;
}

.nav-group-label.clickable {
  cursor: pointer;
  user-select: none;
  border-radius: var(--radius-sm);
  position: relative;
}

.nav-group-label.clickable:hover {
  color: var(--color-text-secondary);
}

.nav-group-chevron {
  position: absolute;
  left: -2px;
  font-size: 10px;
  transition: transform 0.15s ease;
}

.nav-group-chevron.collapsed {
  transform: rotate(-90deg);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  margin-right: 8px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  text-decoration: none;
  color: var(--color-text-secondary);
  font-weight: 450;
  clip-path: polygon(0 0, 100% 0, 100% 50%, 100% 100%, 0 100%);
  transition:
    background 0.25s ease,
    color 0.25s ease,
    clip-path 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    padding-right 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-radius 0.3s ease;
}

.nav-item:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.nav-item.active {
  background: color-mix(in srgb, var(--color-accent) 18%, transparent);
  color: var(--color-accent);
  font-weight: 550;
  margin-right: 0;
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  padding-right: 22px;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%);
}

.nav-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  opacity: 0.7;
}

.nav-item-add {
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.nav-item:hover .nav-item-add {
  opacity: 1;
}

.nav-item.active .nav-item-add {
  margin-right: 8px;
}

.nav-item-add:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-accent);
}

.nav-item.active .nav-icon {
  opacity: 1;
}

/* ── Footer ───────────────────────────────────────────────────── */

.sidebar-footer {
  padding: 4px 12px 6px;
}

.sidebar-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.sidebar-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  padding: 2px 4px;
  margin: -2px -4px;
  transition: background var(--transition-fast);
}

.sidebar-status:hover {
  background: var(--color-accent-light);
  color: var(--color-accent);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot-connected {
  background: var(--color-success);
}

.status-dot-reconnecting {
  background: var(--color-warning);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.status-dot-error {
  background: var(--color-danger);
}

.status-dot-disconnected {
  background: var(--color-text-tertiary);
}

.status-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-actions-btns {
  display: flex;
  gap: 2px;
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
  width: 96px;
  height: 96px;
}

.loading-app-title {
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
  to {
    transform: rotate(360deg);
  }
}

/* ── Skip-to-content link (visible only on keyboard focus) ──── */

.skip-link {
  position: absolute;
  top: -100%;
  left: 16px;
  z-index: 1000;
  padding: 8px 16px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  text-decoration: none;
  transition: top 0.15s ease;
}

.skip-link:focus {
  top: 8px;
}

/* ── Hamburger button (mobile only) ─────────────────────────── */

.hamburger-btn {
  display: none;
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: var(--z-nav-header);
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
    z-index: var(--z-content);
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
