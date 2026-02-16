<script setup lang="ts">
import { ref, watch } from "vue";
import { usePreferencesStore } from "../stores/preferences";
import type { GlobalPreferences } from "../types/boinc";
import ProxySettingsDialog from "./ProxySettingsDialog.vue";
import ExclusiveAppsDialog from "./ExclusiveAppsDialog.vue";
import LogFlagsDialog from "./LogFlagsDialog.vue";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const store = usePreferencesStore();
const activeTab = ref<"computing" | "network" | "storage" | "schedule" | "advanced">("computing");
const form = ref<GlobalPreferences | null>(null);
const showProxy = ref(false);
const showExclusiveApps = ref(false);
const showLogFlags = ref(false);

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await store.fetchPreferences();
      if (store.prefs) {
        form.value = { ...store.prefs };
      }
    }
  },
);

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getDayPref(dayOfWeek: number) {
  if (!form.value) return { day_of_week: dayOfWeek, start_hour: 0, end_hour: 0, net_start_hour: 0, net_end_hour: 0 };
  if (!form.value.day_prefs) form.value.day_prefs = [];
  let dp = form.value.day_prefs.find((d) => d.day_of_week === dayOfWeek);
  if (!dp) {
    dp = { day_of_week: dayOfWeek, start_hour: 0, end_hour: 0, net_start_hour: 0, net_end_hour: 0 };
    form.value.day_prefs.push(dp);
  }
  return dp;
}

async function save() {
  if (!form.value) return;
  await store.savePreferences(form.value);
  if (!store.error) {
    emit("close");
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay" @click.self="emit('close')">
      <div class="prefs-dialog">
        <div class="prefs-header">
          <h3>Preferences</h3>
          <button class="close-btn" @click="emit('close')">&times;</button>
        </div>

        <div v-if="store.loading" class="prefs-loading">Loading preferences...</div>

        <template v-else-if="form">
          <div class="tabs">
            <button
              class="tab"
              :class="{ active: activeTab === 'computing' }"
              @click="activeTab = 'computing'"
            >
              Computing
            </button>
            <button
              class="tab"
              :class="{ active: activeTab === 'network' }"
              @click="activeTab = 'network'"
            >
              Network
            </button>
            <button
              class="tab"
              :class="{ active: activeTab === 'storage' }"
              @click="activeTab = 'storage'"
            >
              Storage
            </button>
            <button class="tab" :class="{ active: activeTab === 'schedule' }" @click="activeTab = 'schedule'">Schedule</button>
            <button class="tab" :class="{ active: activeTab === 'advanced' }" @click="activeTab = 'advanced'">Advanced</button>
          </div>

          <div class="prefs-body">
            <!-- Computing tab -->
            <div v-if="activeTab === 'computing'" class="prefs-section">
              <label class="pref-row">
                <span>Run on batteries</span>
                <input v-model="form.run_on_batteries" type="checkbox" />
              </label>
              <label class="pref-row">
                <span>Run if user is active</span>
                <input v-model="form.run_if_user_active" type="checkbox" />
              </label>
              <label class="pref-row">
                <span>Idle time before running (min)</span>
                <input
                  v-model.number="form.idle_time_to_run"
                  type="number"
                  min="0"
                  step="1"
                />
              </label>
              <label class="pref-row">
                <span>Max CPUs used (%)</span>
                <input
                  v-model.number="form.max_ncpus_pct"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                />
              </label>
              <label class="pref-row">
                <span>CPU usage limit (%)</span>
                <input
                  v-model.number="form.cpu_usage_limit"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                />
              </label>
              <label class="pref-row">
                <span>RAM when busy (%)</span>
                <input
                  v-model.number="form.ram_max_used_busy_frac"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                />
              </label>
              <label class="pref-row">
                <span>RAM when idle (%)</span>
                <input
                  v-model.number="form.ram_max_used_idle_frac"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                />
              </label>
              <label class="pref-row">
                <span>Computing start hour</span>
                <input
                  v-model.number="form.start_hour"
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                />
              </label>
              <label class="pref-row">
                <span>Computing end hour</span>
                <input
                  v-model.number="form.end_hour"
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                />
              </label>
              <label class="pref-row">
                <span>Suspend if no recent input (min)</span>
                <input v-model.number="form.suspend_if_no_recent_input" type="number" min="0" step="1" />
              </label>
              <label class="pref-row">
                <span>Suspend if CPU usage above (%)</span>
                <input v-model.number="form.suspend_cpu_usage" type="number" min="0" max="100" step="1" />
              </label>
              <label class="pref-row">
                <span>Leave apps in memory</span>
                <input v-model="form.leave_apps_in_memory" type="checkbox" />
              </label>
              <label class="pref-row">
                <span>Additional work buffer (days)</span>
                <input v-model.number="form.work_buf_additional_days" type="number" min="0" step="0.1" />
              </label>
              <label class="pref-row">
                <span>CPU scheduling period (min)</span>
                <input v-model.number="form.cpu_scheduling_period_minutes" type="number" min="1" step="1" />
              </label>
            </div>

            <!-- Network tab -->
            <div v-if="activeTab === 'network'" class="prefs-section">
              <label class="pref-row">
                <span>Max download rate (bytes/s)</span>
                <input
                  v-model.number="form.max_bytes_sec_down"
                  type="number"
                  min="0"
                  step="1024"
                />
              </label>
              <label class="pref-row">
                <span>Max upload rate (bytes/s)</span>
                <input
                  v-model.number="form.max_bytes_sec_up"
                  type="number"
                  min="0"
                  step="1024"
                />
              </label>
              <label class="pref-row">
                <span>Daily transfer limit (MB)</span>
                <input
                  v-model.number="form.daily_xfer_limit_mb"
                  type="number"
                  min="0"
                  step="100"
                />
              </label>
              <label class="pref-row">
                <span>Network start hour</span>
                <input
                  v-model.number="form.net_start_hour"
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                />
              </label>
              <label class="pref-row">
                <span>Network end hour</span>
                <input
                  v-model.number="form.net_end_hour"
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                />
              </label>
            </div>

            <!-- Storage tab -->
            <div v-if="activeTab === 'storage'" class="prefs-section">
              <label class="pref-row">
                <span>Max disk used (GB)</span>
                <input
                  v-model.number="form.disk_max_used_gb"
                  type="number"
                  min="0"
                  step="1"
                />
              </label>
              <label class="pref-row">
                <span>Max disk used (%)</span>
                <input
                  v-model.number="form.disk_max_used_pct"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                />
              </label>
              <label class="pref-row">
                <span>Min free disk (GB)</span>
                <input
                  v-model.number="form.disk_min_free_gb"
                  type="number"
                  min="0"
                  step="0.1"
                />
              </label>
              <label class="pref-row">
                <span>Work buffer (days)</span>
                <input
                  v-model.number="form.work_buf_min_days"
                  type="number"
                  min="0"
                  step="0.1"
                />
              </label>
            </div>

            <!-- Schedule tab -->
            <div v-if="activeTab === 'schedule'" class="prefs-section">
              <p class="section-desc">Set per-day computing and network hours (0-24). Leave at 0-0 to use the default hours above.</p>
              <table class="schedule-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>CPU Start</th>
                    <th>CPU End</th>
                    <th>Net Start</th>
                    <th>Net End</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(day, i) in dayNames" :key="i">
                    <td class="day-label">{{ day }}</td>
                    <td><input v-model.number="getDayPref(i).start_hour" type="number" min="0" max="24" step="0.5" class="schedule-input" /></td>
                    <td><input v-model.number="getDayPref(i).end_hour" type="number" min="0" max="24" step="0.5" class="schedule-input" /></td>
                    <td><input v-model.number="getDayPref(i).net_start_hour" type="number" min="0" max="24" step="0.5" class="schedule-input" /></td>
                    <td><input v-model.number="getDayPref(i).net_end_hour" type="number" min="0" max="24" step="0.5" class="schedule-input" /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Advanced tab -->
            <div v-if="activeTab === 'advanced'" class="prefs-section">
              <div class="advanced-group">
                <button class="btn" @click="showProxy = true">Proxy Settings...</button>
                <button class="btn" @click="showExclusiveApps = true">Exclusive Applications...</button>
                <button class="btn" @click="showLogFlags = true">Log Flags &amp; Config...</button>
              </div>
            </div>
          </div>

          <div v-if="store.error" class="prefs-error">{{ store.error }}</div>

          <div class="prefs-footer">
            <button class="btn" @click="emit('close')">Cancel</button>
            <button class="btn btn-primary" :disabled="store.saving" @click="save">
              {{ store.saving ? "Saving..." : "Save" }}
            </button>
          </div>
        </template>
      </div>
    </div>
    <ProxySettingsDialog :open="showProxy" @close="showProxy = false" />
    <ExclusiveAppsDialog :open="showExclusiveApps" @close="showExclusiveApps = false" />
    <LogFlagsDialog :open="showLogFlags" @close="showLogFlags = false" />
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

.prefs-dialog {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  width: 520px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.prefs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.prefs-header h3 {
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

.prefs-loading {
  padding: var(--space-2xl);
  text-align: center;
  color: var(--color-text-secondary);
}

.tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  padding: 0 16px;
}

.tab {
  padding: 10px 16px;
  border: none;
  background: none;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.tab:hover {
  color: var(--color-text-primary);
}

.tab.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.prefs-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.prefs-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
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

.pref-row input[type="number"] {
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

.prefs-error {
  padding: 8px 20px;
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.prefs-footer {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
}

.section-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-md);
  line-height: 1.5;
}

.schedule-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.schedule-table th {
  text-align: left;
  padding: 6px 4px;
  font-weight: 600;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  border-bottom: 1px solid var(--color-border);
}

.schedule-table td {
  padding: 4px;
}

.day-label {
  font-weight: 500;
  padding-right: 8px;
}

.schedule-input {
  width: 60px;
  padding: 4px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  text-align: right;
}

.advanced-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.advanced-group .btn {
  text-align: left;
}
</style>
