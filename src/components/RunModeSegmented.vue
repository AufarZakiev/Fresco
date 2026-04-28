<script setup lang="ts">
import { RUN_MODE } from "../types/boinc";

defineProps<{
  current: number | null;
  ariaLabel: string;
}>();

const emit = defineEmits<{ (e: "select", value: number): void }>();

type IconName = "bolt" | "clock" | "stop";

const modes: ReadonlyArray<{ value: number; icon: IconName; tooltipKey: string }> = [
  { value: RUN_MODE.ALWAYS, icon: "bolt", tooltipKey: "activity.alwaysTooltip" },
  { value: RUN_MODE.AUTO, icon: "clock", tooltipKey: "activity.autoTooltip" },
  { value: RUN_MODE.NEVER, icon: "stop", tooltipKey: "activity.suspendTooltip" },
];

function onClick(current: number | null, target: number) {
  if (current === target) return;
  emit("select", target);
}
</script>

<template>
  <div class="segmented" role="radiogroup" :aria-label="ariaLabel">
    <button
      v-for="m in modes"
      :key="m.value"
      type="button"
      role="radio"
      :aria-checked="current === m.value"
      :aria-label="$t(m.tooltipKey)"
      :title="$t(m.tooltipKey)"
      :class="['segment', { active: current === m.value }]"
      :data-mode="m.value"
      @click="onClick(current, m.value)"
    >
      <svg v-if="m.icon === 'bolt'" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093z"
          clip-rule="evenodd"
        />
      </svg>
      <svg v-else-if="m.icon === 'clock'" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5z"
          clip-rule="evenodd"
        />
      </svg>
      <svg v-else viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <rect x="5" y="5" width="10" height="10" rx="1.5" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: flex;
  flex: 1;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-bg);
}

.segment {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 0;
  background: transparent;
  border: none;
  border-right: 1px solid var(--color-border);
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;
}

.segment:last-child {
  border-right: none;
}

.segment:hover:not(.active) {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.segment.active {
  background: var(--color-accent-light);
  color: var(--color-text-secondary);
  cursor: default;
}

.segment:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
}

.segment svg {
  width: 12px;
  height: 12px;
}
</style>
