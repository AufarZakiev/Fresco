<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from "vue";

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

/* ── state ── */
const isOpen = ref(false);
const phase = ref<"hours" | "minutes">("hours");
const selectedHour = ref(0);
const selectedMinute = ref(0);
const triggerRef = ref<HTMLElement>();
const clockRef = ref<HTMLElement>();
const menuStyle = ref<Record<string, string>>({});

/* ── sync with v-model ── */
watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      const [hour, minute] = v.split(":").map(Number);
      selectedHour.value = hour;
      selectedMinute.value = minute;
    }
  },
  { immediate: true },
);

/* ── display helpers ── */
const hourStr = computed(() => String(selectedHour.value).padStart(2, "0"));
const minuteStr = computed(() => String(selectedMinute.value).padStart(2, "0"));

/* ── clock geometry ── */
const CLOCK_SIZE = 230;
const CENTER = CLOCK_SIZE / 2;
const OUTER_R = 96;
const INNER_R = 64;

const outerHours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const innerHours = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const minuteNums = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function getNumberPosition(index: number, radius: number): Record<string, string> {
  const angle = (index * 30 - 90) * (Math.PI / 180);
  return {
    left: `${CENTER + radius * Math.cos(angle)}px`,
    top: `${CENTER + radius * Math.sin(angle)}px`,
  };
}

/* ── clock hand ── */
const handAngle = computed(() => {
  if (phase.value === "hours") return (selectedHour.value % 12) * 30;
  return selectedMinute.value * 6;
});

const handLength = computed(() => {
  if (phase.value === "hours") {
    const isInner = selectedHour.value >= 13 || selectedHour.value === 0;
    return isInner ? INNER_R : OUTER_R;
  }
  return OUTER_R;
});

/* ── pointer interaction on clock face ── */
function onClockPointerDown(e: PointerEvent) {
  if (!clockRef.value) return;
  const rect = clockRef.value.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  updateSelection(e.clientX, e.clientY, cx, cy);

  const onMove = (ev: PointerEvent) => updateSelection(ev.clientX, ev.clientY, cx, cy);
  const onUp = (ev: PointerEvent) => {
    updateSelection(ev.clientX, ev.clientY, cx, cy);
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);

    if (phase.value === "hours") {
      phase.value = "minutes";
    } else {
      confirmAndClose();
    }
  };

  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
}

function updateSelection(px: number, py: number, cx: number, cy: number) {
  const dx = px - cx;
  const dy = py - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 16) return; // too close to center

  let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  if (angle < 0) angle += 360;

  if (phase.value === "hours") {
    const idx = Math.round(angle / 30) % 12;
    const threshold = (OUTER_R + INNER_R) / 2;
    selectedHour.value = dist < threshold ? innerHours[idx] : outerHours[idx];
  } else {
    selectedMinute.value = Math.round(angle / 6) % 60;
  }
}

/* ── open / close / confirm ── */
function open() {
  if (!triggerRef.value) return;
  if (props.modelValue) {
    const [hour, minute] = props.modelValue.split(":").map(Number);
    selectedHour.value = hour;
    selectedMinute.value = minute;
  } else {
    selectedHour.value = 0;
    selectedMinute.value = 0;
  }
  phase.value = "hours";
  isOpen.value = true;
  nextTick(updateMenuPosition);
}

function updateMenuPosition() {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  const menuHeight = 350;
  const menuWidth = 270;
  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow >= menuHeight ? rect.bottom + 4 : rect.top - menuHeight - 4;
  const left = Math.min(rect.left, window.innerWidth - menuWidth - 8);
  menuStyle.value = { top: `${top}px`, left: `${left}px` };
}

function close() {
  isOpen.value = false;
}

function confirmAndClose() {
  const hourStr = String(selectedHour.value).padStart(2, "0");
  const minuteStr = String(selectedMinute.value).padStart(2, "0");
  emit("update:modelValue", `${hourStr}:${minuteStr}`);
  close();
}

function clear() {
  emit("update:modelValue", "");
  close();
}

function onOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains("clock-overlay")) close();
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
      :class="{ 'has-value': modelValue, compact }"
      @click="open"
    >
      <span v-if="modelValue" class="trigger-value">{{ modelValue }}</span>
      <span v-else class="trigger-placeholder">{{ placeholder }}</span>
    </button>

    <Teleport to="body">
      <div v-if="isOpen" class="clock-overlay" @mousedown="onOverlayClick">
        <div class="clock-menu" :style="menuStyle">
          <!-- Digital time display -->
          <div class="time-display">
            <span
              class="time-seg"
              :class="{ active: phase === 'hours' }"
              @click="phase = 'hours'"
            >{{ hourStr }}</span>
            <span class="time-colon">:</span>
            <span
              class="time-seg"
              :class="{ active: phase === 'minutes' }"
              @click="phase = 'minutes'"
            >{{ minuteStr }}</span>
          </div>

          <!-- Analog clock face -->
          <div
            ref="clockRef"
            class="clock-face"
            :style="{ width: CLOCK_SIZE + 'px', height: CLOCK_SIZE + 'px' }"
            @pointerdown.prevent="onClockPointerDown"
          >
            <!-- Hand -->
            <div
              class="clock-hand"
              :style="{
                transform: `rotate(${handAngle}deg)`,
                height: `${handLength}px`,
              }"
            />
            <div class="clock-center-dot" />

            <!-- Hour numbers -->
            <template v-if="phase === 'hours'">
              <span
                v-for="(h, i) in outerHours"
                :key="'oh' + h"
                class="clock-num"
                :class="{ selected: selectedHour === h }"
                :style="getNumberPosition(i, OUTER_R)"
              >{{ h }}</span>
              <span
                v-for="(h, i) in innerHours"
                :key="'ih' + h"
                class="clock-num inner"
                :class="{ selected: selectedHour === h }"
                :style="getNumberPosition(i, INNER_R)"
              >{{ h }}</span>
            </template>

            <!-- Minute numbers -->
            <template v-else>
              <span
                v-for="(m, i) in minuteNums"
                :key="'m' + m"
                class="clock-num"
                :class="{ selected: selectedMinute === m }"
                :style="getNumberPosition(i, OUTER_R)"
              >{{ String(m).padStart(2, '0') }}</span>
            </template>
          </div>

          <!-- Actions -->
          <div class="clock-actions">
            <button type="button" class="action-btn" @click="clear">{{ $t('timePicker.clear') }}</button>
            <div style="flex:1" />
            <button type="button" class="action-btn" @click="close">{{ $t('timePicker.cancel') }}</button>
            <button type="button" class="action-btn primary" @click="confirmAndClose">{{ $t('timePicker.ok') }}</button>
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

/* ── trigger button ── */
.clock-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
  padding: 5px 8px;
  cursor: pointer;
  width: min(130px, 40vw);
  transition: border-color var(--transition-fast);
}

.clock-trigger:hover {
  border-color: var(--color-accent);
}

.clock-trigger.compact {
  font-size: var(--font-size-sm);
  padding: 4px 8px;
  width: auto;
  min-width: 64px;
}

.trigger-placeholder {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

/* ── overlay ── */
.clock-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-context-menu);
}

/* ── popup menu ── */
.clock-menu {
  position: fixed;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: calc(var(--z-context-menu) + 1);
  width: 270px;
}

/* ── digital time display ── */
.time-display {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 0 10px;
  gap: 2px;
}

.time-seg {
  font-size: 26px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-tertiary);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.time-seg.active {
  color: var(--color-accent);
}

.time-seg:hover:not(.active) {
  background: var(--color-bg-tertiary);
}

.time-colon {
  font-size: 26px;
  font-weight: 500;
  color: var(--color-text-tertiary);
}

/* ── clock face ── */
.clock-face {
  position: relative;
  margin: 0 auto 8px;
  border-radius: 50%;
  background: var(--color-bg-secondary);
  cursor: pointer;
  user-select: none;
  touch-action: none;
}

/* ── numbers ── */
.clock-num {
  position: absolute;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: var(--font-size-sm);
  font-weight: 400;
  color: var(--color-text-primary);
  transform: translate(-50%, -50%);
  z-index: 1;
  pointer-events: none;
  transition: background 100ms ease, color 100ms ease;
}

.clock-num.inner {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  width: 28px;
  height: 28px;
}

.clock-num.selected {
  background: var(--color-accent);
  color: #ffffff;
}

.clock-num.inner.selected {
  color: #ffffff;
}

/* ── hand ── */
.clock-hand {
  position: absolute;
  bottom: 50%;
  left: 50%;
  width: 2px;
  margin-left: -1px;
  background: var(--color-accent);
  transform-origin: bottom center;
  z-index: 0;
  transition: transform 150ms ease, height 150ms ease;
}

/* small dot at the tip of the hand */
.clock-hand::after {
  content: "";
  position: absolute;
  top: -4px;
  left: 50%;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  border-radius: 50%;
  background: var(--color-accent);
}

.clock-center-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 6px;
  margin: -3px 0 0 -3px;
  border-radius: 50%;
  background: var(--color-accent);
  z-index: 1;
}

/* ── actions ── */
.clock-actions {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  border-top: 1px solid var(--color-border);
  gap: 4px;
}

.action-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.action-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.action-btn.primary {
  color: var(--color-accent);
  font-weight: 500;
}

.action-btn.primary:hover {
  background: var(--color-accent-light);
}
</style>
