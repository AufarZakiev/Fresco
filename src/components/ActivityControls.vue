<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useClientStore } from "../stores/client";
import RunModeSegmented from "./RunModeSegmented.vue";

const client = useClientStore();

const STORAGE_KEY = "fresco.activityControls.expanded";
const expanded = ref(localStorage.getItem(STORAGE_KEY) === "true");
watch(expanded, (v) => localStorage.setItem(STORAGE_KEY, String(v)));

const allMode = computed<number | null>(() => {
  const cpu = client.status.task_mode_perm;
  const gpu = client.status.gpu_mode_perm;
  const net = client.status.network_mode_perm;
  return cpu === gpu && gpu === net ? cpu : null;
});

function setAll(value: number) {
  if (client.status.task_mode_perm !== value) client.setRunMode(value);
  if (client.status.gpu_mode_perm !== value) client.setGpuMode(value);
  if (client.status.network_mode_perm !== value) client.setNetworkMode(value);
}

const controls = computed(() => [
  {
    labelKey: "activity.cpu",
    ariaKey: "activity.cpuModeLabel",
    current: client.status.task_mode_perm,
    onSelect: (v: number) => client.setRunMode(v),
  },
  {
    labelKey: "activity.gpu",
    ariaKey: "activity.gpuModeLabel",
    current: client.status.gpu_mode_perm,
    onSelect: (v: number) => client.setGpuMode(v),
  },
  {
    labelKey: "activity.net",
    ariaKey: "activity.netModeLabel",
    current: client.status.network_mode_perm,
    onSelect: (v: number) => client.setNetworkMode(v),
  },
]);
</script>

<template>
  <div class="activity-controls">
    <div class="mode-control">
      <span class="mode-label">{{ $t("activity.all") }}</span>
      <RunModeSegmented
        :current="allMode"
        :ariaLabel="$t('activity.allModeLabel')"
        @select="setAll"
      />
      <button
        type="button"
        class="expand-toggle"
        :aria-label="$t(expanded ? 'activity.collapse' : 'activity.expand')"
        :aria-expanded="expanded"
        :title="$t(expanded ? 'activity.collapse' : 'activity.expand')"
        data-testid="expand-toggle"
        @click="expanded = !expanded"
      >
        <svg
          :class="['chevron', { open: expanded }]"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>

    <div :class="['expandable', { open: expanded }]" :aria-hidden="!expanded">
      <div class="expandable-inner">
        <div v-for="c in controls" :key="c.labelKey" class="mode-control mode-control--child">
          <span class="mode-label">{{ $t(c.labelKey) }}</span>
          <RunModeSegmented
            :current="c.current"
            :ariaLabel="$t(c.ariaKey)"
            @select="c.onSelect"
          />
          <span class="expand-toggle-spacer" aria-hidden="true" />
        </div>
      </div>
    </div>
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

.expand-toggle {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;
}

.expand-toggle:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.expand-toggle:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
}

.expand-toggle-spacer {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.chevron {
  width: 12px;
  height: 12px;
  transition: transform 0.2s ease;
}

.chevron.open {
  transform: rotate(180deg);
}

.expandable {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.2s ease;
}

.expandable.open {
  grid-template-rows: 1fr;
}

.expandable-inner {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.expandable.open .expandable-inner {
  padding-top: 4px;
}

.mode-control--child .mode-label {
  color: var(--color-text-tertiary);
}
</style>
