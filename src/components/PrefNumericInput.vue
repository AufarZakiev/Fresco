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
    zeroLabel: "Default",
  },
);

const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const store = usePreferencesStore();

const isDefault = computed(() => props.modelValue === 0);

const placeholder = computed(() => {
  const effective = store.getEffectiveValue(props.field);
  if (effective !== null && effective !== 0) {
    return `${props.zeroLabel} (${effective})`;
  }
  return props.zeroLabel;
});

const displayValue = computed(() => {
  if (isDefault.value) return "";
  return String(props.modelValue);
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
    <span>{{ label }}</span>
    <input
      type="number"
      :value="displayValue"
      :placeholder="placeholder"
      :min="min"
      :max="max"
      :step="step"
      :class="{ 'is-default': isDefault }"
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

.pref-row input[type="number"] {
  width: 130px;
  padding: 5px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  text-align: right;
  background: var(--color-bg);
  color: var(--color-text-primary);
  transition: border-color var(--transition-fast);
}

.pref-row input[type="number"].is-default {
  border-style: dashed;
  border-color: var(--color-text-tertiary);
}

.pref-row input[type="number"]::placeholder {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  text-align: right;
}
</style>
