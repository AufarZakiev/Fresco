<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from "vue";

const props = withDefaults(
  defineProps<{
    startHour: number;
    endHour: number;
    label?: string;
  }>(),
  { label: "" },
);

const emit = defineEmits<{
  "update:startHour": [value: number];
  "update:endHour": [value: number];
}>();

const trackRef = ref<HTMLElement>();
const dragging = ref<"start" | "end" | null>(null);

const STEP = 0.5;
const MAX = 24;
const TICKS = [0, 6, 12, 18, 24];

function snapToStep(value: number): number {
  return Math.round(value / STEP) * STEP;
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toPercent(hour: number): number {
  return (hour / MAX) * 100;
}

function hourFromX(e: MouseEvent): number {
  if (!trackRef.value) return 0;
  const rect = trackRef.value.getBoundingClientRect();
  return snapToStep(
    clampValue(((e.clientX - rect.left) / rect.width) * MAX, 0, MAX),
  );
}

function formatTime(hour: number): string {
  const hrs = Math.floor(hour);
  const min = Math.round((hour - hrs) * 60);
  return `${String(hrs).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

const isAllDay = computed(() => props.startHour === 0 && props.endHour === 0);
const startPct = computed(() =>
  isAllDay.value ? 0 : toPercent(props.startHour),
);
const endPct = computed(() =>
  isAllDay.value ? 100 : toPercent(props.endHour),
);
const rangeLabel = computed(() => {
  if (props.startHour === 0 && props.endHour === 0) return "All day";
  return `${formatTime(props.startHour)} – ${formatTime(props.endHour)}`;
});

function onHandleDown(which: "start" | "end", e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  dragging.value = which;
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

function onMouseMove(e: MouseEvent) {
  if (!dragging.value) return;
  const hour = hourFromX(e);
  // Use effective values (all-day displays as 0–24)
  const effEnd = isAllDay.value ? MAX : props.endHour;
  if (dragging.value === "start") {
    emit("update:startHour", clampValue(hour, 0, effEnd));
    // Break out of all-day: pin end at 24
    if (isAllDay.value) emit("update:endHour", MAX);
  } else {
    emit("update:endHour", clampValue(hour, props.startHour, MAX));
  }
}

function onMouseUp() {
  dragging.value = null;
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);
}

onBeforeUnmount(() => {
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);
});

function onTrackClick(e: MouseEvent) {
  if (dragging.value) return;
  const hour = hourFromX(e);
  const effEnd = isAllDay.value ? MAX : props.endHour;
  const distToStart = Math.abs(hour - props.startHour);
  const distToEnd = Math.abs(hour - effEnd);
  if (distToStart < distToEnd) {
    emit("update:startHour", clampValue(hour, 0, effEnd));
    if (isAllDay.value) emit("update:endHour", MAX);
  } else {
    emit("update:endHour", clampValue(hour, props.startHour, MAX));
  }
}
</script>

<template>
  <div class="range-slider">
    <div class="range-header">
      <span v-if="label" class="range-label">{{ label }}</span>
      <span class="range-value">{{ rangeLabel }}</span>
    </div>
    <div ref="trackRef" class="range-track" @mousedown="onTrackClick">
      <!-- Filled range -->
      <div
        class="range-fill"
        :style="{ left: startPct + '%', width: endPct - startPct + '%' }"
      />
      <!-- Start handle -->
      <div
        class="range-handle"
        :class="{ active: dragging === 'start' }"
        :style="{ left: startPct + '%' }"
        @mousedown="onHandleDown('start', $event)"
      />
      <!-- End handle -->
      <div
        class="range-handle"
        :class="{ active: dragging === 'end' }"
        :style="{ left: endPct + '%' }"
        @mousedown="onHandleDown('end', $event)"
      />
    </div>
    <div class="range-ticks">
      <span
        v-for="t in TICKS"
        :key="t"
        class="range-tick"
        :style="{ left: toPercent(t) + '%' }"
        >{{ t }}</span
      >
    </div>
  </div>
</template>

<style scoped>
.range-slider {
  flex: 1;
  min-width: 0;
  user-select: none;
}

.range-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.range-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  width: 28px;
  flex-shrink: 0;
}

.range-value {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.range-track {
  position: relative;
  height: 6px;
  background: var(--color-bg-tertiary);
  border-radius: 3px;
  cursor: pointer;
}

.range-fill {
  position: absolute;
  top: 0;
  height: 100%;
  background: var(--color-accent);
  border-radius: 3px;
  opacity: 0.5;
  pointer-events: none;
}

.range-handle {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-accent);
  border: 2px solid var(--color-bg);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transform: translate(-50%, -50%);
  cursor: grab;
  z-index: 1;
  transition: box-shadow 0.15s ease;
}

.range-handle:hover,
.range-handle.active {
  box-shadow: 0 0 0 4px var(--color-accent-light);
  cursor: grabbing;
}

.range-ticks {
  position: relative;
  height: 14px;
  margin-top: 2px;
}

.range-tick {
  position: absolute;
  transform: translateX(-50%);
  font-size: 9px;
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}
</style>
