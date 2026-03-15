<script setup lang="ts">
import { useClientStore } from "../stores/client";
import { RUN_MODE } from "../types/boinc";

const client = useClientStore();

function handleRunMode(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value);
  client.setRunMode(value);
}

function handleGpuMode(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value);
  client.setGpuMode(value);
}

function handleNetworkMode(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value);
  client.setNetworkMode(value);
}
</script>

<template>
  <div class="activity-controls">
    <label class="mode-control">
      <span class="mode-label">{{ $t("activity.cpu") }}</span>
      <select :value="client.status.task_mode_perm" :aria-label="$t('activity.cpuModeLabel')" @change="handleRunMode">
        <option :value="RUN_MODE.ALWAYS">{{ $t("activity.always") }}</option>
        <option :value="RUN_MODE.AUTO">{{ $t("activity.auto") }}</option>
        <option :value="RUN_MODE.NEVER">{{ $t("activity.suspend") }}</option>
      </select>
    </label>

    <label class="mode-control">
      <span class="mode-label">{{ $t("activity.gpu") }}</span>
      <select :value="client.status.gpu_mode_perm" :aria-label="$t('activity.gpuModeLabel')" @change="handleGpuMode">
        <option :value="RUN_MODE.ALWAYS">{{ $t("activity.always") }}</option>
        <option :value="RUN_MODE.AUTO">{{ $t("activity.auto") }}</option>
        <option :value="RUN_MODE.NEVER">{{ $t("activity.suspend") }}</option>
      </select>
    </label>

    <label class="mode-control">
      <span class="mode-label">{{ $t("activity.net") }}</span>
      <select
        :value="client.status.network_mode_perm"
        :aria-label="$t('activity.netModeLabel')"
        @change="handleNetworkMode"
      >
        <option :value="RUN_MODE.ALWAYS">{{ $t("activity.always") }}</option>
        <option :value="RUN_MODE.AUTO">{{ $t("activity.auto") }}</option>
        <option :value="RUN_MODE.NEVER">{{ $t("activity.suspend") }}</option>
      </select>
    </label>
  </div>
</template>

<style scoped>
.activity-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mode-control {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-xs);
}

.mode-label {
  color: var(--color-text-tertiary);
  font-weight: 500;
  width: 28px;
  flex-shrink: 0;
}

select {
  flex: 1;
  padding: 3px 22px 3px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  background: var(--color-bg);
  color: var(--color-text-primary);
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%239ca3af'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 4px center;
  background-size: 12px;
}
</style>
