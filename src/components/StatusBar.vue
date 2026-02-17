<script setup lang="ts">
import { computed } from "vue";
import { useConnectionStore } from "../stores/connection";
import { useClientStore } from "../stores/client";
import { getSuspendReasonText } from "../composables/useSuspendReasons";
import { CONNECTION_STATE } from "../types/boinc";
import { useUpdateCheck } from "../composables/useUpdateCheck";

const { buildTime } = useUpdateCheck();

const buildLabel = computed(() => {
  if (!buildTime.value || buildTime.value === "dev") return "dev";
  try {
    return new Date(buildTime.value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return buildTime.value;
  }
});

const connection = useConnectionStore();
const client = useClientStore();

const taskSuspendText = computed(() =>
  getSuspendReasonText(client.status.task_suspend_reason),
);

const gpuSuspendText = computed(() =>
  getSuspendReasonText(client.status.gpu_suspend_reason),
);

const statusDotClass = computed(() => {
  const s = connection.state;
  if (s === CONNECTION_STATE.CONNECTED) return "status-dot-connected";
  if (s === CONNECTION_STATE.RECONNECTING) return "status-dot-reconnecting";
  if (s === CONNECTION_STATE.AUTH_ERROR || (typeof s === "object" && "Error" in s))
    return "status-dot-error";
  return "status-dot-disconnected";
});

const statusText = computed(() => {
  const s = connection.state;
  if (s === CONNECTION_STATE.CONNECTED) return "Connected";
  if (s === CONNECTION_STATE.RECONNECTING)
    return `Reconnecting (${connection.reconnectAttempt}/${connection.maxReconnectAttempts})...`;
  if (s === CONNECTION_STATE.CONNECTING) return "Connecting...";
  if (s === CONNECTION_STATE.AUTH_ERROR) return "Auth Error";
  if (s === CONNECTION_STATE.DISCONNECTED) return "Disconnected";
  if (typeof s === "object" && "Error" in s) return "Error";
  return "Disconnected";
});
</script>

<template>
  <div class="status-bar">
    <div class="status-section">
      <span class="status-dot" :class="statusDotClass" />
      <span>{{ statusText }}</span>
    </div>

    <div class="status-section">
      <span v-if="taskSuspendText" class="suspend-text">
        Tasks suspended: {{ taskSuspendText }}
      </span>
      <span v-if="gpuSuspendText" class="suspend-text">
        GPU suspended: {{ gpuSuspendText }}
      </span>
    </div>

    <div class="status-section">
      <span>{{ buildLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  position: fixed;
  bottom: 0;
  left: var(--sidebar-width);
  right: 0;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  z-index: 5;
  gap: 12px;
}

.status-section {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
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

.suspend-text {
  color: var(--color-warning);
  font-weight: 500;
}

@media (max-width: 767px) {
  .status-bar {
    left: 0;
  }
}
</style>
