<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { TimePicker } from "vue-material-time-picker";
import "vue-material-time-picker/dist/style.css";

const props = withDefaults(
  defineProps<{
    modelValue: string; // "HH:mm" or ""
    placeholder?: string;
    compact?: boolean;
    dark?: boolean;
    accentColor?: string;
  }>(),
  {
    placeholder: "Select time",
    compact: false,
    dark: false,
    accentColor: "#3b82f6",
  },
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const isOpen = ref(false);
const triggerRef = ref<HTMLElement>();
const menuRef = ref<HTMLElement>();
const menuStyle = ref<Record<string, string>>({});

// Internal time value for the picker (never empty — defaults to "00:00")
const pickerValue = ref(props.modelValue || "00:00");

watch(
  () => props.modelValue,
  (v) => {
    if (v) pickerValue.value = v;
  },
);

function open() {
  if (!triggerRef.value) return;
  pickerValue.value = props.modelValue || "00:00";
  isOpen.value = true;
  nextTick(positionMenu);
}

function positionMenu() {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  const menuHeight = 310;
  const menuWidth = 270;
  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow >= menuHeight ? rect.bottom + 4 : rect.top - menuHeight - 4;
  const left = Math.min(rect.left, window.innerWidth - menuWidth - 8);
  menuStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
  };
}

function close() {
  isOpen.value = false;
}

function onOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains("clock-overlay")) {
    close();
  }
}

function onTimeChange(value: string) {
  const time = value.substring(0, 5); // "HH:mm:ss" → "HH:mm"
  emit("update:modelValue", time);
  close();
}

function clear() {
  emit("update:modelValue", "");
  close();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") close();
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="clock-picker-wrapper" :class="{ compact }">
    <button
      ref="triggerRef"
      type="button"
      class="clock-trigger"
      :class="{ 'has-value': modelValue, compact, dark }"
      @click="open"
    >
      <span v-if="modelValue" class="trigger-value">{{ modelValue }}</span>
      <span v-else class="trigger-placeholder">{{ placeholder }}</span>
    </button>
    <Teleport to="body">
      <div v-if="isOpen" class="clock-overlay" @mousedown="onOverlayClick">
        <div ref="menuRef" class="clock-menu" :class="{ dark }" :style="menuStyle">
          <TimePicker
            v-model="pickerValue"
            :color="accentColor"
            :width="260"
            hide-title
            @change="onTimeChange"
          />
          <div class="clock-actions">
            <button type="button" class="clock-action-btn" :class="{ dark }" @click="clear">Clear</button>
            <button type="button" class="clock-action-btn" :class="{ dark }" @click="close">Cancel</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.clock-picker-wrapper {
  display: inline-flex;
}

.clock-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
  padding: 5px 12px;
  cursor: pointer;
  min-width: 80px;
  transition: border-color var(--transition-fast);
}

.clock-trigger:hover {
  border-color: var(--color-accent);
}

.clock-trigger.compact {
  font-size: var(--font-size-sm);
  padding: 4px 8px;
  min-width: 64px;
}

.trigger-placeholder {
  color: var(--color-text-tertiary);
  font-size: inherit;
}

.clock-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
}

.clock-menu {
  position: fixed;
  background: #ffffff;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 2001;
}

.clock-menu.dark {
  background: #1a1a2e;
}

/* Override clock picker colors in dark mode */
.clock-menu.dark :deep(.v-time-picker-clock) {
  background: #16213e;
}

.clock-menu.dark :deep(.v-time-picker-clock__inner) {
  background: #16213e;
}

.clock-menu.dark :deep(span:not(.v-time-picker-clock__item__value--selected)) {
  color: #e4e4e7;
}

.clock-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--color-border);
}

.clock-action-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.clock-action-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}
</style>
