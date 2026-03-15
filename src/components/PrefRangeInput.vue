<script setup lang="ts">
import { computed, ref } from "vue";
import { usePreferencesStore } from "../stores/preferences";
import type { GlobalPreferences } from "../types/boinc";
import { BOINC_DEFAULTS } from "../constants/boincDefaults";
import PrefSourcePopover from "./PrefSourcePopover.vue";

const props = withDefaults(
  defineProps<{
    modelValue: number;
    label: string;
    field: keyof GlobalPreferences;
    min?: number;
    max?: number;
    step?: number;
    zeroLabel?: string;
    /** When true, modelValue is 0–1 fraction but UI shows 0–100 percent */
    fraction?: boolean;
    /** Suffix shown inside the input (e.g. "%") */
    suffix?: string;
  }>(),
  {
    min: 0,
    max: 100,
    step: 10,
    fraction: false,
    suffix: "",
  },
);

const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const store = usePreferencesStore();

const hasOverride = computed(() => props.modelValue !== 0);
const fileVal = computed(() => store.getFileValue(props.field));
const initialVal = computed(() => BOINC_DEFAULTS[props.field] ?? 0);
const hasFileVal = computed(
  () =>
    fileVal.value != null &&
    fileVal.value !== 0 &&
    fileVal.value !== initialVal.value,
);

const sourceType = computed(() => {
  if (
    hasOverride.value &&
    (!hasFileVal.value || props.modelValue !== fileVal.value)
  )
    return "override";
  if (hasFileVal.value) return "file";
  return "initial";
});

const effectiveValue = computed(() => {
  if (hasOverride.value) return props.modelValue;
  const working = store.getEffectiveValue(props.field);
  if (working != null && working !== 0) return working;
  if (fileVal.value != null && fileVal.value !== 0) return fileVal.value;
  return BOINC_DEFAULTS[props.field] ?? 0;
});

/** Value in display units (percent when fraction mode) */
const displayNumeric = computed(() => {
  const val = effectiveValue.value;
  if (val === 0) return 0;
  return props.fraction ? Math.round(val * 100) : val;
});

const displayValue = computed(() => {
  if (effectiveValue.value === 0) return "";
  return String(displayNumeric.value);
});

const placeholder = computed(() => {
  if (effectiveValue.value === 0 && props.zeroLabel) return props.zeroLabel;
  return "";
});

const fillPercent = computed(() => {
  const min = props.fraction ? props.min * 100 : props.min;
  const max = props.fraction ? props.max * 100 : props.max;
  const range = max - min;
  if (range <= 0) return 0;
  return Math.max(0, Math.min(100, ((displayNumeric.value - min) / range) * 100));
});

// ── Source dot popover ──────────────────────────────────────────
const dotRef = ref<HTMLElement | null>(null);
const popoverOpen = computed(() => store.activePopoverField === props.field);

let openTimeout: ReturnType<typeof setTimeout> | null = null;
let closeTimeout: ReturnType<typeof setTimeout> | null = null;

function cancelTimers() {
  if (openTimeout) {
    clearTimeout(openTimeout);
    openTimeout = null;
  }
  if (closeTimeout) {
    clearTimeout(closeTimeout);
    closeTimeout = null;
  }
}

function onDotEnter() {
  cancelTimers();
  openTimeout = setTimeout(() => {
    store.activePopoverField = props.field;
  }, 120);
}

function onDotLeave() {
  cancelTimers();
  closeTimeout = setTimeout(() => {
    if (popoverOpen.value) store.activePopoverField = null;
  }, 200);
}

function onPopoverEnter() {
  cancelTimers();
}

function onPopoverLeave() {
  cancelTimers();
  closeTimeout = setTimeout(() => {
    if (popoverOpen.value) store.activePopoverField = null;
  }, 200);
}

function closePopover() {
  cancelTimers();
  if (popoverOpen.value) store.activePopoverField = null;
}

function onAdoptValue(val: number | boolean) {
  if (typeof val === "number") {
    emit("update:modelValue", val);
  }
  store.activePopoverField = null;
}

function onClearOverride() {
  emit("update:modelValue", 0);
  store.activePopoverField = null;
}

// ── Text input ──────────────────────────────────────────────────
function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const raw = target.value.trim();
  if (raw === "") {
    emit("update:modelValue", 0);
    return;
  }
  const num = Number(raw);
  if (!isNaN(num)) {
    emit("update:modelValue", props.fraction ? num / 100 : num);
  }
}

// ── Slider interaction (click / drag on the input background) ───
const inputRef = ref<HTMLInputElement | null>(null);
const dragging = ref(false);

function snapToStep(value: number, step: number): number {
  const snapped = Math.round(value / step) * step;
  const decimals = String(step).includes(".")
    ? String(step).split(".")[1].length
    : 0;
  return Number(snapped.toFixed(decimals));
}

function valueFromMouseX(event: MouseEvent): number {
  const el = inputRef.value;
  if (!el) return effectiveValue.value;
  const rect = el.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  // Work in display units (percent for fraction fields)
  const min = props.fraction ? props.min * 100 : props.min;
  const max = props.fraction ? props.max * 100 : props.max;
  const step = props.fraction ? props.step * 100 : props.step;
  const raw = min + ratio * (max - min);
  const snapped = snapToStep(Math.max(min, Math.min(max, raw)), step);
  return props.fraction ? snapped / 100 : snapped;
}

function onMouseDown(event: MouseEvent) {
  // Only handle left-click on the fill area, not when user is selecting text
  if (event.button !== 0) return;
  const target = event.target as HTMLInputElement;
  // If user clicked while input is focused (editing text), don't intercept
  if (document.activeElement === target) return;

  event.preventDefault();
  dragging.value = true;
  emit("update:modelValue", valueFromMouseX(event));

  function onMouseMove(e: MouseEvent) {
    emit("update:modelValue", valueFromMouseX(e));
  }

  function onMouseUp() {
    dragging.value = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}
</script>

<template>
  <label class="pref-row">
    <span class="pref-label">{{ label }}</span>
    <span class="pref-input-group">
      <span
        ref="dotRef"
        class="source-dot-wrapper"
        @mouseenter="onDotEnter"
        @mouseleave="onDotLeave"
      >
        <span class="source-dot" :class="sourceType" />
      </span>
      <span class="range-input-wrapper">
        <input
          ref="inputRef"
          type="text"
          inputmode="decimal"
          class="range-input"
          :class="{ dragging, 'has-suffix': suffix }"
          :value="displayValue"
          :placeholder="placeholder"
          :style="{
            backgroundImage: `linear-gradient(to right, var(--range-fill) ${fillPercent}%, transparent ${fillPercent}%)`,
          }"
          @input="onInput"
          @mousedown="onMouseDown"
        />
        <span v-if="suffix" class="input-suffix">{{ suffix }}</span>
      </span>
    </span>
  </label>
  <PrefSourcePopover
    :open="popoverOpen"
    :anchor-el="dotRef"
    :field="field"
    :override-value="modelValue"
    :zero-label="zeroLabel"
    @close="closePopover"
    @adopt-value="onAdoptValue"
    @clear-override="onClearOverride"
    @popover-enter="onPopoverEnter"
    @popover-leave="onPopoverLeave"
  />
</template>

<style scoped>
.pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 42px;
  padding: 0;
  border-bottom: 1px solid var(--color-border-light);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  cursor: default;
}

.pref-row:last-child {
  border-bottom: none;
}

.pref-input-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.source-dot-wrapper {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.source-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  transition: transform 0.15s;
}

.source-dot-wrapper:hover .source-dot {
  transform: scale(1.5);
}

.source-dot.override {
  background: var(--color-accent);
}

.source-dot.file {
  background: var(--color-warning);
}

.source-dot.initial {
  background: var(--color-text-tertiary);
  opacity: 0.3;
}

.range-input-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.input-suffix {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  pointer-events: none;
  user-select: none;
}

.range-input.has-suffix {
  padding-right: 24px;
}

.range-input {
  --range-fill: color-mix(in srgb, var(--color-accent) 20%, transparent);

  width: min(130px, 40vw);
  padding: 5px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  text-align: right;
  background-color: var(--color-bg);
  color: var(--color-text-primary);
  background-repeat: no-repeat;
  background-origin: padding-box;
  transition: border-color var(--transition-fast);
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M4.5 12l4-4v3h7V8l4 4-4 4v-3h-7v3z' fill='%236b7280'/%3E%3C/svg%3E") 12 12, ew-resize;
}

.range-input:focus {
  cursor: text;
}

.range-input.dragging {
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M4.5 12l4-4v3h7V8l4 4-4 4v-3h-7v3z' fill='%233b82f6'/%3E%3C/svg%3E") 12 12, ew-resize;
}

.range-input::placeholder {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
</style>
