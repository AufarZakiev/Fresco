<script setup lang="ts">
import { computed } from "vue";
import { usePreferencesStore } from "../stores/preferences";
import { useManagerSettingsStore } from "../stores/managerSettings";
import type { GlobalPreferences } from "../types/boinc";
import { decimalHoursToTimeString, timeStringToDecimalHours } from "../utils/timeConversion";
import TimeClockPicker from "./TimeClockPicker.vue";

const props = defineProps<{
  modelValue: number;
  label: string;
  field: keyof GlobalPreferences;
  zeroLabel?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const store = usePreferencesStore();
const settingsStore = useManagerSettingsStore();

const isDark = computed(() => {
  if (settingsStore.settings.theme === "dark") return true;
  if (settingsStore.settings.theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
});

const accentColor = computed(() => isDark.value ? "#60a5fa" : "#3b82f6");

const hasOverride = computed(() => props.modelValue !== 0);

const effectiveValue = computed(() => {
  if (hasOverride.value) return props.modelValue;
  const effective = store.getEffectiveValue(props.field);
  return (effective as number) ?? 0;
});

const timeString = computed(() => decimalHoursToTimeString(effectiveValue.value));

const placeholder = computed(() => {
  if (effectiveValue.value === 0 && props.zeroLabel) return props.zeroLabel;
  return "Select time";
});

function onTimeChange(value: string) {
  emit("update:modelValue", timeStringToDecimalHours(value));
}
</script>

<template>
  <div class="pref-row">
    <span class="pref-label">
      <span v-if="hasOverride" class="override-dot" />
      {{ label }}
    </span>
    <TimeClockPicker
      :model-value="timeString"
      :placeholder="placeholder"
      :dark="isDark"
      :accent-color="accentColor"
      @update:model-value="onTimeChange"
    />
  </div>
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
</style>
