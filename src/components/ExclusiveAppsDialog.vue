<script setup lang="ts">
import { ref, watch } from "vue";
import { getCcConfig, setCcConfig } from "../composables/useRpc";
import type { CcConfig } from "../types/boinc";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const loading = ref(false);
const saving = ref(false);
const error = ref("");
const config = ref<CcConfig | null>(null);
const newCpuApp = ref("");
const newGpuApp = ref("");

let cachedConfig: CcConfig | null = null;

/** Fire-and-forget prefetch so the dialog opens instantly. */
async function prefetch() {
  try {
    cachedConfig = await getCcConfig();
  } catch {
    // Silent — dialog will fetch on open if cache miss
  }
}

function initFromConfig(cc: CcConfig) {
  config.value = {
    ...cc,
    exclusive_apps: [...cc.exclusive_apps],
    exclusive_gpu_apps: [...cc.exclusive_gpu_apps],
  };
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      error.value = "";
      newCpuApp.value = "";
      newGpuApp.value = "";

      if (cachedConfig) {
        initFromConfig(cachedConfig);
        cachedConfig = null;
      } else {
        loading.value = true;
        try {
          initFromConfig(await getCcConfig());
        } catch (e) {
          error.value = String(e);
        } finally {
          loading.value = false;
        }
      }
    }
  },
);

defineExpose({ prefetch });

function addCpuApp() {
  const name = newCpuApp.value.trim();
  if (!name || !config.value) return;
  if (!config.value.exclusive_apps.includes(name)) {
    config.value.exclusive_apps.push(name);
  }
  newCpuApp.value = "";
}

function removeCpuApp(index: number) {
  if (!config.value) return;
  config.value.exclusive_apps.splice(index, 1);
}

function addGpuApp() {
  const name = newGpuApp.value.trim();
  if (!name || !config.value) return;
  if (!config.value.exclusive_gpu_apps.includes(name)) {
    config.value.exclusive_gpu_apps.push(name);
  }
  newGpuApp.value = "";
}

function removeGpuApp(index: number) {
  if (!config.value) return;
  config.value.exclusive_gpu_apps.splice(index, 1);
}

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
      <div class="exclusive-dialog">
        <div class="exclusive-header">
          <h3>Exclusive Applications</h3>
          <button class="close-btn" @click="emit('close')">&times;</button>
        </div>

        <div v-if="loading" class="exclusive-loading">Loading configuration...</div>

        <template v-else-if="config">
          <div class="exclusive-body">
            <div class="section-title">Exclusive CPU Applications</div>
            <div class="app-list">
              <div
                v-for="(app, index) in config.exclusive_apps"
                :key="'cpu-' + index"
                class="app-item"
              >
                <span>{{ app }}</span>
                <button class="remove-btn" @click="removeCpuApp(index)">&times;</button>
              </div>
              <div v-if="config.exclusive_apps.length === 0" class="app-empty">
                No exclusive CPU applications configured.
              </div>
            </div>
            <div class="add-row">
              <input
                v-model="newCpuApp"
                type="text"
                placeholder="Application name"
                @keyup.enter="addCpuApp"
              />
              <button class="btn btn-primary" @click="addCpuApp">Add</button>
            </div>

            <div class="section-title">Exclusive GPU Applications</div>
            <div class="app-list">
              <div
                v-for="(app, index) in config.exclusive_gpu_apps"
                :key="'gpu-' + index"
                class="app-item"
              >
                <span>{{ app }}</span>
                <button class="remove-btn" @click="removeGpuApp(index)">&times;</button>
              </div>
              <div v-if="config.exclusive_gpu_apps.length === 0" class="app-empty">
                No exclusive GPU applications configured.
              </div>
            </div>
            <div class="add-row">
              <input
                v-model="newGpuApp"
                type="text"
                placeholder="Application name"
                @keyup.enter="addGpuApp"
              />
              <button class="btn btn-primary" @click="addGpuApp">Add</button>
            </div>
          </div>

          <div v-if="error" class="exclusive-error">{{ error }}</div>

          <div class="exclusive-footer">
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
  z-index: var(--z-modal);
  backdrop-filter: blur(2px);
}

.exclusive-dialog {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  width: min(480px, 95vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.exclusive-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.exclusive-header h3 {
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

.exclusive-loading {
  padding: var(--space-2xl);
  text-align: center;
  color: var(--color-text-secondary);
}

.exclusive-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.section-title {
  font-weight: 600;
  font-size: var(--font-size-md);
  margin-bottom: var(--space-sm);
  margin-top: var(--space-lg);
  color: var(--color-text-primary);
}

.section-title:first-child {
  margin-top: 0;
}

.app-list {
  margin: 8px 0;
}

.app-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-bottom: 1px solid var(--color-border-light);
  font-size: var(--font-size-md);
}

.app-item:last-child {
  border-bottom: none;
}

.app-empty {
  padding: 8px;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  font-style: italic;
}

.remove-btn {
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

.remove-btn:hover {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.add-row {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.add-row input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
}

.exclusive-error {
  padding: 8px 20px;
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.exclusive-footer {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
}
</style>
