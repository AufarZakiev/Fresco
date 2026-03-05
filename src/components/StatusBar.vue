<script setup lang="ts">
import { computed } from "vue";
import { useClientStore } from "../stores/client";
import { getSuspendReasonText } from "../composables/useSuspendReasons";

const client = useClientStore();

const taskSuspendText = computed(() =>
  getSuspendReasonText(client.status.task_suspend_reason),
);

const gpuSuspendText = computed(() =>
  getSuspendReasonText(client.status.gpu_suspend_reason),
);

const hasContent = computed(() => !!taskSuspendText.value || !!gpuSuspendText.value);
</script>

<template>
  <div v-if="hasContent" class="status-bar" role="contentinfo">
    <span v-if="taskSuspendText" class="suspend-text">
      {{ $t("statusBar.tasksSuspended", { reason: taskSuspendText }) }}
    </span>
    <span v-if="gpuSuspendText" class="suspend-text">
      {{ $t("statusBar.gpuSuspended", { reason: gpuSuspendText }) }}
    </span>
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
  justify-content: center;
  padding: 0 12px;
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  z-index: 5;
  gap: 12px;
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
