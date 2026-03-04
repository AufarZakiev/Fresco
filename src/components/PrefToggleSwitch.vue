<script setup lang="ts">
import { computed, ref } from "vue";
import { usePreferencesStore } from "../stores/preferences";
import type { GlobalPreferences } from "../types/boinc";
import { BOINC_BOOL_DEFAULTS } from "../constants/boincDefaults";
import PrefSourcePopover from "./PrefSourcePopover.vue";

const props = defineProps<{
  modelValue: boolean;
  label: string;
  field: keyof GlobalPreferences;
}>();

const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();

const store = usePreferencesStore();

const initialVal = computed(() => BOINC_BOOL_DEFAULTS[props.field] ?? false);
const fileVal = computed(() => store.getBoolFileValue(props.field));
const hasFileVal = computed(
  () => fileVal.value != null && fileVal.value !== initialVal.value,
);

const sourceType = computed(() => {
  if (
    props.modelValue !== initialVal.value &&
    (!hasFileVal.value || props.modelValue !== fileVal.value)
  ) {
    return "override";
  }
  if (hasFileVal.value && props.modelValue === fileVal.value) return "file";
  if (hasFileVal.value && props.modelValue !== fileVal.value) return "override";
  return "initial";
});

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
  if (typeof val === "boolean") {
    emit("update:modelValue", val);
  }
  store.activePopoverField = null;
}

function onClearOverride() {
  const fallback = fileVal.value ?? initialVal.value;
  emit("update:modelValue", fallback);
  store.activePopoverField = null;
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
      <span
        class="toggle-switch"
        :class="{ on: modelValue }"
        role="switch"
        :aria-checked="modelValue"
        tabindex="0"
        @click.prevent="emit('update:modelValue', !modelValue)"
        @keydown.enter.prevent="emit('update:modelValue', !modelValue)"
        @keydown.space.prevent="emit('update:modelValue', !modelValue)"
      >
        <span class="toggle-knob" />
      </span>
    </span>
  </label>
  <PrefSourcePopover
    :open="popoverOpen"
    :anchor-el="dotRef"
    :field="field"
    :override-value="modelValue"
    :is-boolean-field="true"
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

.toggle-switch {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: var(--color-text-tertiary);
  opacity: 0.4;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  transition:
    background 0.2s,
    opacity 0.2s;
}

.toggle-switch.on {
  background: var(--color-accent);
  opacity: 1;
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  transition: left 0.2s;
}

.toggle-switch.on .toggle-knob {
  left: 18px;
}
</style>
