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
  }>(),
  {
    min: 0,
    step: 1,
  },
);

const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const store = usePreferencesStore();

const hasOverride = computed(() => props.modelValue !== 0);

const fileVal = computed(() => store.getFileValue(props.field));

const initialVal = computed(() => BOINC_DEFAULTS[props.field] ?? 0);
const hasFileVal = computed(
  () => fileVal.value != null && fileVal.value !== 0 && fileVal.value !== initialVal.value,
);

const sourceType = computed(() => {
  if (hasOverride.value && (!hasFileVal.value || props.modelValue !== fileVal.value)) return "override";
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

const displayValue = computed(() => {
  if (effectiveValue.value === 0) return "";
  return String(effectiveValue.value);
});

const placeholder = computed(() => {
  if (effectiveValue.value === 0 && props.zeroLabel) return props.zeroLabel;
  return "";
});

const dotRef = ref<HTMLElement | null>(null);
const popoverOpen = computed(() => store.activePopoverField === props.field);

let openTimeout: ReturnType<typeof setTimeout> | null = null;
let closeTimeout: ReturnType<typeof setTimeout> | null = null;

function cancelTimers() {
  if (openTimeout) { clearTimeout(openTimeout); openTimeout = null; }
  if (closeTimeout) { clearTimeout(closeTimeout); closeTimeout = null; }
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

function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const raw = target.value.trim();
  if (raw === "") {
    emit("update:modelValue", 0);
    return;
  }
  const num = Number(raw);
  if (!isNaN(num)) {
    emit("update:modelValue", num);
  }
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
      <input
        type="text"
        inputmode="decimal"
        :value="displayValue"
        :placeholder="placeholder"
        @input="onInput"
      />
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

.pref-row input[type="text"] {
  width: min(130px, 40vw);
  padding: 5px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  text-align: right;
  background: var(--color-bg);
  color: var(--color-text-primary);
  transition: border-color var(--transition-fast);
}

.pref-row input[type="text"]::placeholder {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
</style>
