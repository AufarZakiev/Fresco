<script setup lang="ts">
import { ref, watch } from "vue";
import { getCcConfig, setCcConfig } from "../composables/useRpc";
import type { CcConfig, LogFlags } from "../types/boinc";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const loading = ref(false);
const saving = ref(false);
const error = ref("");
const config = ref<CcConfig | null>(null);

const flagLabels: { key: keyof LogFlags; label: string }[] = [
  { key: "task", label: "Task" },
  { key: "file_xfer", label: "File transfers" },
  { key: "sched_ops", label: "Scheduler operations" },
  { key: "cpu_sched", label: "CPU scheduling" },
  { key: "network_xfer", label: "Network transfers" },
  { key: "mem_usage", label: "Memory usage" },
  { key: "disk_usage", label: "Disk usage" },
  { key: "http_debug", label: "HTTP debug" },
  { key: "state_debug", label: "State debug" },
  { key: "statefile_debug", label: "State file debug" },
];

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
      <div class="logflags-dialog">
        <div class="logflags-header">
          <h3>Diagnostic Log Flags</h3>
          <button class="close-btn" @click="emit('close')">&times;</button>
        </div>

        <div v-if="loading" class="logflags-loading">Loading configuration...</div>

        <template v-else-if="config">
          <div class="logflags-body">
            <div class="logflags-section">
              <label
                v-for="flag in flagLabels"
                :key="flag.key"
                class="pref-row"
              >
                <span>{{ flag.label }}</span>
                <input v-model="config.log_flags[flag.key]" type="checkbox" />
              </label>
            </div>

            <div class="logflags-divider"></div>

            <div class="logflags-section">
              <label class="pref-row">
                <span>Max file transfers</span>
                <input
                  v-model.number="config.max_file_xfers"
                  type="number"
                  min="0"
                  step="1"
                />
              </label>
              <label class="pref-row">
                <span>Max CPUs</span>
                <input
                  v-model.number="config.max_ncpus"
                  type="number"
                  min="0"
                  step="1"
                />
              </label>
              <label class="pref-row">
                <span>Report results immediately</span>
                <input v-model="config.report_results_immediately" type="checkbox" />
              </label>
            </div>
          </div>

          <div v-if="error" class="logflags-error">{{ error }}</div>

          <div class="logflags-footer">
            <button class="btn" @click="emit('close')">Cancel</button>
            <button class="btn btn-primary" :disabled="saving" @click="save">
              {{ saving ? "Saving..." : "Save" }}
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
  z-index: 1000;
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
  cursor: default;
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

.pref-row input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--color-accent);
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
