<script setup lang="ts">
import { computed } from "vue";
import { useConnectionStore } from "../stores/connection";
import { useClientStore } from "../stores/client";
import { getSuspendReasonText } from "../composables/useSuspendReasons";

const connection = useConnectionStore();
const client = useClientStore();

const taskSuspendText = computed(() =>
  getSuspendReasonText(client.status.task_suspend_reason),
);

const gpuSuspendText = computed(() =>
  getSuspendReasonText(client.status.gpu_suspend_reason),
);
</script>

<template>
  <div class="status-bar">
    <div class="status-section">
      <span
        class="status-dot"
        :class="{
          'status-dot-connected': connection.state === 'Connected',
          'status-dot-reconnecting': connection.state === 'Reconnecting',
          'status-dot-error':
            connection.state === 'AuthError' ||
            (typeof connection.state === 'object' && 'Error' in connection.state),
          'status-dot-disconnected':
            connection.state === 'Disconnected' || connection.state === 'Connecting',
        }"
      />
      <span>{{
        connection.state === "Connected"
          ? "Connected"
          : connection.state === "Reconnecting"
            ? `Reconnecting (${connection.reconnectAttempt}/${connection.maxReconnectAttempts})...`
            : connection.state === "Connecting"
              ? "Connecting..."
              : connection.state === "AuthError"
                ? "Auth Error"
                : connection.state === "Disconnected"
                  ? "Disconnected"
                  : typeof connection.state === "object" && "Error" in connection.state
                    ? "Error"
                    : "Disconnected"
      }}</span>
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
      <span>Fresco</span>
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
</style>
