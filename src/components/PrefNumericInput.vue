<script setup lang="ts">
import { computed } from "vue";
import { usePreferencesStore } from "../stores/preferences";
import type { GlobalPreferences } from "../types/boinc";

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

const effectiveValue = computed(() => {
  if (hasOverride.value) return props.modelValue;
  const effective = store.getEffectiveValue(props.field);
  return effective ?? 0;
});

const displayValue = computed(() => {
  if (effectiveValue.value === 0) return "";
  return String(effectiveValue.value);
});

const placeholder = computed(() => {
  if (effectiveValue.value === 0 && props.zeroLabel) return props.zeroLabel;
  return "";
});

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
    <span class="pref-label">
      <span v-if="hasOverride" class="override-dot" />
      {{ label }}
    </span>
    <input
      type="number"
      :value="displayValue"
      :placeholder="placeholder"
      :min="min"
      :max="max"
      :step="step"
      @input="onInput"
    />
  </label>
</template>

<style scoped>
.pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border-light);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  cursor: default;
}

.pref-row:last-child {
  border-bottom: none;
}

.pref-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.override-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent);
  opacity: 0.5;
  flex-shrink: 0;
}

.pref-row input[type="number"]::-webkit-inner-spin-button,
.pref-row input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.pref-row input[type="number"] {
  -moz-appearance: textfield;
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

.pref-row input[type="number"]::placeholder {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
</style>
