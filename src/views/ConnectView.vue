<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useConnectionStore } from "../stores/connection";
import { useTasksStore } from "../stores/tasks";
import { useProjectsStore } from "../stores/projects";
import { useTransfersStore } from "../stores/transfers";
import { useClientStore } from "../stores/client";
import { useStatisticsStore } from "../stores/statistics";
import { useMessagesStore } from "../stores/messages";
import { useNoticesStore } from "../stores/notices";
import { useDiskUsageStore } from "../stores/diskUsage";
import { useRouter } from "vue-router";
import { startBoincClient } from "../composables/useRpc";
import { CONNECTION_STATE, CONNECTION_MODE } from "../types/boinc";
import type { ConnectionMode } from "../types/boinc";

const connection = useConnectionStore();
const tasks = useTasksStore();
const projects = useProjectsStore();
const transfers = useTransfersStore();
const client = useClientStore();
const statistics = useStatisticsStore();
const messages = useMessagesStore();
const notices = useNoticesStore();
const diskUsage = useDiskUsageStore();
const router = useRouter();

interface RecentConnection {
  mode: ConnectionMode;
  label: string;
  dataDir?: string;
  clientDir?: string;
  host?: string;
  port?: number;
  password?: string;
  timestamp: number;
}

const RECENT_KEY = "boinc-recent-connections";
const MAX_RECENT = 5;

const mode = ref<ConnectionMode>(CONNECTION_MODE.LOCAL);
const dataDir = ref(defaultDataDir());
const clientDir = ref(defaultClientDir());
const host = ref("localhost");
const port = ref(31416);
const password = ref("");
const connecting = ref(false);
const statusMessage = ref<string | null>(null);
const recentConnections = ref<RecentConnection[]>([]);

onMounted(() => {
  loadRecent();
});

function defaultDataDir(): string {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("win")) return "C:\\ProgramData\\BOINC";
  if (platform.includes("mac")) return "/Library/Application Support/BOINC Data";
  return "/var/lib/boinc-client";
}

function defaultClientDir(): string {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("win")) return "C:\\Program Files\\BOINC";
  if (platform.includes("mac")) return "/Applications/BOINCManager.app/Contents/Resources";
  return "/usr/bin";
}

function loadRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) {
      recentConnections.value = JSON.parse(raw);
    }
  } catch {
    recentConnections.value = [];
  }
}

function saveRecent(entry: RecentConnection) {
  const existing = recentConnections.value.filter(
    (r) =>
      !(r.mode === entry.mode &&
        r.dataDir === entry.dataDir &&
        r.host === entry.host &&
        r.port === entry.port),
  );
  const updated = [entry, ...existing].slice(0, MAX_RECENT);
  recentConnections.value = updated;
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
}

function removeRecent(index: number) {
  recentConnections.value.splice(index, 1);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recentConnections.value));
}

function applyRecent(entry: RecentConnection) {
  mode.value = entry.mode;
  if (entry.mode === CONNECTION_MODE.LOCAL) {
    dataDir.value = entry.dataDir ?? defaultDataDir();
    clientDir.value = entry.clientDir ?? defaultClientDir();
  } else {
    host.value = entry.host ?? "localhost";
    port.value = entry.port ?? 31416;
    password.value = entry.password ?? "";
  }
}

const connectionLabel = computed(() => {
  if (mode.value === CONNECTION_MODE.LOCAL) {
    return dataDir.value;
  }
  return `${host.value}:${port.value}`;
});

function startAllPolling() {
  tasks.startPolling();
  projects.startPolling();
  transfers.startPolling();
  client.startPolling();
  statistics.startPolling();
  messages.startPolling();
  notices.startPolling();
  diskUsage.startPolling();
}

async function handleConnect() {
  connecting.value = true;
  statusMessage.value = null;

  if (mode.value === CONNECTION_MODE.LOCAL) {
    await connection.connectToLocal(dataDir.value);

    // If local connection failed with a non-auth error, try auto-starting BOINC
    if (connection.state !== CONNECTION_STATE.CONNECTED && connection.state !== CONNECTION_STATE.AUTH_ERROR) {
      statusMessage.value = "Starting BOINC client...";
      try {
        await startBoincClient(dataDir.value, clientDir.value);
        statusMessage.value = "BOINC client started, connecting...";
        await connection.connectToLocal(dataDir.value);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        connection.error = msg;
      }
      statusMessage.value = null;
    }
  } else {
    await connection.connectToRemote(host.value, port.value, password.value);
  }

  connecting.value = false;

  if (connection.state === CONNECTION_STATE.CONNECTED) {
    const entry: RecentConnection = {
      mode: mode.value,
      label: connectionLabel.value,
      timestamp: Date.now(),
    };
    if (mode.value === CONNECTION_MODE.LOCAL) {
      entry.dataDir = dataDir.value;
      entry.clientDir = clientDir.value;
    } else {
      entry.host = host.value;
      entry.port = port.value;
      // Do not persist password for security
    }
    saveRecent(entry);

    startAllPolling();
    router.push("/tasks");
  }
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <div class="connect-view">
    <div class="connect-card">
      <h2 class="connect-title">Connect to BOINC Client</h2>

      <div class="mode-toggle">
        <button
          class="toggle-btn"
          :class="{ active: mode === CONNECTION_MODE.LOCAL }"
          @click="mode = CONNECTION_MODE.LOCAL"
        >
          Local
        </button>
        <button
          class="toggle-btn"
          :class="{ active: mode === CONNECTION_MODE.REMOTE }"
          @click="mode = CONNECTION_MODE.REMOTE"
        >
          Remote
        </button>
      </div>

      <div class="form">
        <!-- Local mode -->
        <template v-if="mode === CONNECTION_MODE.LOCAL">
          <label class="field">
            <span class="field-label">Data directory</span>
            <input
              v-model="dataDir"
              type="text"
              class="field-input"
              :disabled="connecting"
              placeholder="Path to BOINC data directory"
            />
          </label>
          <label class="field">
            <span class="field-label">Client directory</span>
            <input
              v-model="clientDir"
              type="text"
              class="field-input"
              :disabled="connecting"
              placeholder="Path to BOINC client executable"
            />
          </label>
        </template>

        <!-- Remote mode -->
        <template v-if="mode === CONNECTION_MODE.REMOTE">
          <label class="field">
            <span class="field-label">Host</span>
            <input
              v-model="host"
              type="text"
              class="field-input"
              :disabled="connecting"
              placeholder="localhost"
            />
          </label>
          <label class="field">
            <span class="field-label">Port</span>
            <input
              v-model.number="port"
              type="number"
              class="field-input"
              :disabled="connecting"
              placeholder="31416"
            />
          </label>
          <label class="field">
            <span class="field-label">Password</span>
            <input
              v-model="password"
              type="password"
              class="field-input"
              :disabled="connecting"
              placeholder="GUI RPC password"
            />
          </label>
        </template>

        <button
          class="btn btn-primary connect-btn"
          :disabled="connecting"
          @click="handleConnect"
        >
          {{ statusMessage ?? (connecting ? "Connecting..." : "Connect") }}
        </button>

        <p v-if="connection.error && !statusMessage" class="error">{{ connection.error }}</p>
      </div>

      <!-- Recent connections -->
      <div v-if="recentConnections.length > 0" class="recent-section">
        <h3 class="recent-title">Recent Connections</h3>
        <ul class="recent-list">
          <li
            v-for="(entry, index) in recentConnections"
            :key="index"
            class="recent-item"
          >
            <button class="recent-btn" @click="applyRecent(entry)">
              <span class="recent-mode-badge">{{ entry.mode === CONNECTION_MODE.LOCAL ? "Local" : "Remote" }}</span>
              <span class="recent-label">{{ entry.label }}</span>
              <span class="recent-time">{{ formatTimestamp(entry.timestamp) }}</span>
            </button>
            <button
              class="recent-remove"
              title="Remove"
              @click.stop="removeRecent(index)"
            >
              &times;
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.connect-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: var(--space-2xl);
}

.connect-card {
  width: 100%;
  max-width: 480px;
}

.connect-title {
  margin-bottom: var(--space-xl);
  font-size: var(--font-size-2xl);
  font-weight: 600;
  color: var(--color-text-primary);
  text-align: center;
}

/* Mode toggle */
.mode-toggle {
  display: flex;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  padding: 3px;
  margin-bottom: var(--space-lg);
}

.toggle-btn {
  flex: 1;
  padding: var(--space-sm) var(--space-md);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: var(--font-size-base);
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.toggle-btn.active {
  background: var(--color-bg);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-sm);
}

.toggle-btn:not(.active):hover {
  color: var(--color-text-primary);
}

/* Form fields */
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.field-label {
  font-size: var(--font-size-md);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.field-input {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  background: var(--color-bg);
  transition: border-color var(--transition-fast);
  outline: none;
}

.field-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.field-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.connect-btn {
  padding: 10px var(--space-xl);
  font-size: var(--font-size-base);
  margin-top: var(--space-xs);
}

.connect-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: var(--color-danger);
  font-size: var(--font-size-md);
}

/* Recent connections */
.recent-section {
  margin-top: var(--space-xl);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--color-border);
}

.recent-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: var(--space-sm);
}

.recent-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.recent-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.recent-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
}

.recent-btn:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-border);
}

.recent-mode-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--color-bg-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.recent-label {
  flex: 1;
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.recent-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  font-size: var(--font-size-lg);
  transition: all var(--transition-fast);
}

.recent-remove:hover {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

@media (max-width: 767px) {
  .connect-view {
    padding: var(--space-lg);
  }
}
</style>
