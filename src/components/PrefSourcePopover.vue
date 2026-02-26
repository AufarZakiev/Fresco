<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import Tooltip from "./Tooltip.vue";
import { usePreferencesStore } from "../stores/preferences";
import type { GlobalPreferences } from "../types/boinc";
import { decimalHoursToTimeString } from "../utils/timeConversion";
import { BOINC_DEFAULTS, BOINC_BOOL_DEFAULTS } from "../constants/boincDefaults";

const props = defineProps<{
  open: boolean;
  anchorEl: HTMLElement | null;
  field: keyof GlobalPreferences;
  overrideValue: number | boolean;
  isTimeField?: boolean;
  isBooleanField?: boolean;
  zeroLabel?: string;
}>();

const emit = defineEmits<{
  close: [];
  "adopt-value": [value: number | boolean];
  "clear-override": [];
  "popover-enter": [];
  "popover-leave": [];
}>();

const { t } = useI18n();
const store = usePreferencesStore();
const popoverRef = ref<HTMLElement | null>(null);
const popoverStyle = ref<Record<string, string>>({});

const fileValue = computed(() =>
  props.isBooleanField ? store.getBoolFileValue(props.field) : store.getFileValue(props.field),
);

const initialValue = computed(() =>
  props.isBooleanField
    ? (BOINC_BOOL_DEFAULTS[props.field] ?? false)
    : (BOINC_DEFAULTS[props.field] ?? 0),
);

const hasFileValue = computed(() => {
  if (props.isBooleanField) {
    return fileValue.value != null && fileValue.value !== initialValue.value;
  }
  return fileValue.value != null && fileValue.value !== 0 && fileValue.value !== initialValue.value;
});

const hasOverride = computed(() => {
  if (props.isBooleanField) {
    return props.overrideValue !== initialValue.value
      && (!hasFileValue.value || props.overrideValue !== fileValue.value);
  }
  return props.overrideValue !== 0 && (!hasFileValue.value || props.overrideValue !== fileValue.value);
});

function formatValue(val: number | boolean): string {
  if (typeof val === "boolean") return val ? t("prefSource.on") : t("prefSource.off");
  if (val === 0) return props.zeroLabel ?? t("prefSource.default");
  if (props.isTimeField) return decimalHoursToTimeString(val);
  return String(val);
}

function updatePosition() {
  if (!props.anchorEl) return;
  const rect = props.anchorEl.getBoundingClientRect();
  popoverStyle.value = {
    position: "fixed",
    top: `${rect.bottom + 6}px`,
    left: `${rect.left - 80}px`,
    zIndex: "2000",
  };
}

function handleClickOutside(e: MouseEvent) {
  if (
    popoverRef.value &&
    !popoverRef.value.contains(e.target as Node) &&
    !props.anchorEl?.contains(e.target as Node)
  ) {
    emit("close");
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    emit("close");
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      updatePosition();
      setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
        document.addEventListener("keydown", handleKeydown);
      }, 0);
    } else {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeydown);
    }
  },
);

onMounted(() => {
  if (props.open) {
    updatePosition();
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeydown);
  }
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="popoverRef"
      class="pref-source-popover"
      :style="popoverStyle"
      @mouseenter="emit('popover-enter')"
      @mouseleave="emit('popover-leave')"
    >
      <div class="popover-header">{{ $t('prefSource.title') }}</div>

      <!-- Your override -->
      <div v-if="hasOverride" class="source-row">
        <span class="source-dot override" />
        <span class="source-label">{{ $t('prefSource.yourOverride') }}</span>
        <span class="source-value">{{ formatValue(overrideValue) }}</span>
        <Tooltip :text="$t('prefSource.clearOverride')">
          <button class="source-action clear" @click="emit('clear-override')">
            &times;
          </button>
        </Tooltip>
      </div>

      <!-- Project default -->
      <div v-if="hasFileValue" class="source-row">
        <span class="source-dot file" />
        <span class="source-label">{{ $t('prefSource.accountManager') }}</span>
        <span class="source-value">{{ formatValue(fileValue!) }}</span>
        <Tooltip :text="$t('prefSource.useThisValue')">
          <button
            class="source-action adopt"
            @click="emit('adopt-value', fileValue!)"
          >
            &rarr;
          </button>
        </Tooltip>
      </div>

      <!-- Initial (hardcoded BOINC default) -->
      <div class="source-row">
        <span class="source-dot initial" />
        <span class="source-label">{{ $t('prefSource.default') }}</span>
        <span class="source-value">{{ formatValue(initialValue) }}</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pref-source-popover {
  min-width: 200px;
  max-width: 280px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 8px 0;
  font-size: var(--font-size-sm);
}

.popover-header {
  padding: 4px 12px 8px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--color-border-light);
  margin-bottom: 4px;
}

.source-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
}

.source-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
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

.source-label {
  color: var(--color-text-secondary);
  flex: 1;
  min-width: 0;
}

.source-value {
  font-weight: 500;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}

.source-action {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  color: var(--color-text-tertiary);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.source-action:hover {
  background: var(--color-accent-light);
  color: var(--color-accent);
}

.source-action.clear:hover {
  background: var(--color-danger-light);
  color: var(--color-danger);
}
</style>
