<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { getCcConfig, setCcConfig } from "../composables/useRpc";
import type { CcConfig, LogFlags } from "../types/boinc";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const config = ref<CcConfig | null>(null);

const flagLabels = computed<{ key: keyof LogFlags; label: string }[]>(() => [
  { key: "task", label: t("logFlags.task") },
  { key: "file_xfer", label: t("logFlags.fileTransfers") },
  { key: "sched_ops", label: t("logFlags.schedulerOps") },
  { key: "cpu_sched", label: t("logFlags.cpuScheduling") },
  { key: "network_xfer", label: t("logFlags.networkTransfers") },
  { key: "mem_usage", label: t("logFlags.memoryUsage") },
  { key: "disk_usage", label: t("logFlags.diskUsage") },
  { key: "http_debug", label: t("logFlags.httpDebug") },
  { key: "state_debug", label: t("logFlags.stateDebug") },
  { key: "statefile_debug", label: t("logFlags.stateFileDebug") },
]);

onKeyStroke("Escape", () => {
  if (!props.open) return;
  emit("close");
});

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      loading.value = true;
      error.value = "";
      try {
        const cc = await getCcConfig();
        config.value = {
          ...cc,
          log_flags: { ...cc.log_flags },
          exclusive_apps: [...cc.exclusive_apps],
          exclusive_gpu_apps: [...cc.exclusive_gpu_apps],
        };
      } catch (e) {
        error.value = String(e);
      } finally {
        loading.value = false;
      }
    }
  },
);

async function save() {
  if (!config.value) return;
  saving.value = true;
  error.value = "";
  try {
    await setCcConfig(config.value);
    emit("close");
  } catch (e) {
    error.value = String(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay" @click.self="emit('close')">
      <div class="logflags-dialog" role="dialog" aria-modal="true" aria-labelledby="log-flags-dialog-title">
        <div class="logflags-header">
          <h3 id="log-flags-dialog-title">{{ $t('logFlags.title') }}</h3>
          <button class="close-btn" aria-label="Close" @click="emit('close')">&times;</button>
        </div>

        <div v-if="loading" class="logflags-loading">{{ $t('logFlags.loading') }}</div>

        <template v-else-if="config">
          <div class="logflags-body">
            <div class="logflags-section">
              <label
                v-for="flag in flagLabels"
                :key="flag.key"
                class="pref-row"
                @click="config.log_flags[flag.key] = !config.log_flags[flag.key]"
              >
                <span>{{ flag.label }}</span>
                <span
                  class="toggle-switch"
                  :class="{ on: config.log_flags[flag.key] }"
                  role="button"
                  tabindex="0"
                  @click.stop="config.log_flags[flag.key] = !config.log_flags[flag.key]"
                  @keydown.enter.prevent="config.log_flags[flag.key] = !config.log_flags[flag.key]"
                  @keydown.space.prevent="config.log_flags[flag.key] = !config.log_flags[flag.key]"
                >
                  <span class="toggle-knob" />
                </span>
              </label>
            </div>

            <div class="logflags-divider"></div>

            <div class="logflags-section">
              <label class="pref-row">
                <span>{{ $t('logFlags.maxFileTransfers') }}</span>
                <input
                  v-model.number="config.max_file_xfers"
                  type="number"
                  min="0"
                  step="1"
                />
              </label>
              <label class="pref-row">
                <span>{{ $t('logFlags.maxCpus') }}</span>
                <input
                  v-model.number="config.max_ncpus"
                  type="number"
                  min="0"
                  step="1"
                />
              </label>
              <label class="pref-row" @click="config.report_results_immediately = !config.report_results_immediately">
                <span>{{ $t('logFlags.reportImmediately') }}</span>
                <span
                  class="toggle-switch"
                  :class="{ on: config.report_results_immediately }"
                  role="button"
                  tabindex="0"
                  @click.stop="config.report_results_immediately = !config.report_results_immediately"
                  @keydown.enter.prevent="config.report_results_immediately = !config.report_results_immediately"
                  @keydown.space.prevent="config.report_results_immediately = !config.report_results_immediately"
                >
                  <span class="toggle-knob" />
                </span>
              </label>
            </div>
          </div>

          <div v-if="error" class="logflags-error">{{ error }}</div>

          <div class="logflags-footer">
            <button class="btn" @click="emit('close')">{{ $t('logFlags.cancel') }}</button>
            <button class="btn btn-primary" :disabled="saving" @click="save">
              {{ saving ? $t('logFlags.saving') : $t('logFlags.save') }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  backdrop-filter: blur(2px);
}

.logflags-dialog {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  width: min(420px, 95vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.logflags-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.logflags-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.close-btn:hover {
  color: var(--color-text-primary);
}

.logflags-loading {
  padding: var(--space-2xl);
  text-align: center;
  color: var(--color-text-secondary);
}

.logflags-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.logflags-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.logflags-divider {
  height: 1px;
  background: var(--color-border);
  margin: var(--space-lg) 0;
}

.pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border-light);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  cursor: pointer;
}

.pref-row:last-child {
  border-bottom: none;
}

.pref-row input[type="number"]::-webkit-inner-spin-button,
.pref-row input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.pref-row input[type="number"] {
  -moz-appearance: textfield;
  width: 100px;
  padding: 5px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  text-align: right;
  background: var(--color-bg);
}

.toggle-switch {
  -webkit-appearance: none;
  appearance: none;
  display: inline-block;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: var(--color-text-tertiary);
  opacity: 0.4;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  transition: background 0.2s, opacity 0.2s;
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

.logflags-error {
  padding: 8px 20px;
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.logflags-footer {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
}
</style>
