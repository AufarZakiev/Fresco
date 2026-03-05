<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Tooltip from "./Tooltip.vue";
import { useConnectionStore } from "../stores/connection";
import { useClientStore } from "../stores/client";
import { getSuspendReasonText } from "../composables/useSuspendReasons";
import { CONNECTION_STATE } from "../types/boinc";

const emit = defineEmits<{ "show-about": [] }>();

const { t } = useI18n();
const connection = useConnectionStore();
const client = useClientStore();

const taskSuspendText = computed(() =>
  getSuspendReasonText(client.status.task_suspend_reason),
);

const gpuSuspendText = computed(() =>
  getSuspendReasonText(client.status.gpu_suspend_reason),
);

const statusDotClass = computed(() => {
  const state = connection.state;
  if (state === CONNECTION_STATE.CONNECTED) return "status-dot-connected";
  if (state === CONNECTION_STATE.RECONNECTING) return "status-dot-reconnecting";
  if (state === CONNECTION_STATE.AUTH_ERROR || (typeof state === "object" && "Error" in state))
    return "status-dot-error";
  return "status-dot-disconnected";
});

const statusText = computed(() => {
  const state = connection.state;
  if (state === CONNECTION_STATE.CONNECTED) return t("statusBar.connected");
  if (state === CONNECTION_STATE.RECONNECTING)
    return t("statusBar.reconnecting", { attempt: connection.reconnectAttempt, max: connection.maxReconnectAttempts });
  if (state === CONNECTION_STATE.CONNECTING) return t("statusBar.connecting");
  if (state === CONNECTION_STATE.AUTH_ERROR) return t("statusBar.authError");
  if (state === CONNECTION_STATE.DISCONNECTED) return t("statusBar.disconnected");
  if (typeof state === "object" && "Error" in state) return t("statusBar.error");
  return t("statusBar.disconnected");
});
</script>

<template>
  <div class="status-bar" role="contentinfo">
    <div class="status-section">
      <span class="status-dot" :class="statusDotClass" aria-hidden="true" />
      <span>{{ statusText }}</span>
    </div>

    <div class="status-section">
      <span v-if="taskSuspendText" class="suspend-text">
        {{ $t('statusBar.tasksSuspended', { reason: taskSuspendText }) }}
      </span>
      <span v-if="gpuSuspendText" class="suspend-text">
        {{ $t('statusBar.gpuSuspended', { reason: gpuSuspendText }) }}
      </span>
    </div>

    <Tooltip :text="$t('statusBar.about')" placement="top">
      <button class="about-btn" :aria-label="$t('statusBar.about')" @click="emit('show-about')">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
        </svg>
      </button>
    </Tooltip>
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

.about-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all var(--transition-fast);
  padding: 0;
}

.about-btn:hover {
  color: var(--color-text-primary);
}

@media (max-width: 767px) {
  .status-bar {
    left: 0;
  }
}
</style>
