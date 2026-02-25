<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { usePreferencesStore } from "../stores/preferences";
import { useManagerSettingsStore } from "../stores/managerSettings";
import type { GlobalPreferences } from "../types/boinc";
import PrefNumericInput from "./PrefNumericInput.vue";
import PrefTimeInput from "./PrefTimeInput.vue";
import PrefToggleSwitch from "./PrefToggleSwitch.vue";
import Tooltip from "./Tooltip.vue";
import ProxySettingsDialog from "./ProxySettingsDialog.vue";
import ExclusiveAppsDialog from "./ExclusiveAppsDialog.vue";
import TimeRangeSlider from "./TimeRangeSlider.vue";
import { decimalHoursToTimeString } from "../utils/timeConversion";

type TabName = "computing" | "network" | "storage" | "schedule" | "manager";

const props = withDefaults(defineProps<{ open: boolean; initialTab?: TabName }>(), {
  initialTab: "computing",
});
const emit = defineEmits<{ close: [] }>();

const store = usePreferencesStore();
const managerStore = useManagerSettingsStore();
const activeTab = ref<TabName>("computing");
const managerForm = ref({ ...managerStore.settings });
const form = ref<GlobalPreferences | null>(null);
const showProxy = ref(false);
const showExclusiveApps = ref(false);
const exclusiveAppsRef = ref<InstanceType<typeof ExclusiveAppsDialog> | null>(null);
const dayEnabled = ref<boolean[]>([false, false, false, false, false, false, false]);
const originalSnapshot = ref("");

const hasChanges = computed(() => {
  const prefsChanged = form.value && JSON.stringify(form.value) !== originalSnapshot.value;
  const managerChanged = JSON.stringify(managerForm.value) !== JSON.stringify(managerStore.settings);
  return prefsChanged || managerChanged;
});

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      activeTab.value = props.initialTab;
      managerForm.value = { ...managerStore.settings };
      exclusiveAppsRef.value?.prefetch();
      if (store.prefetched && store.prefs) {
        // Data already cached — show instantly
        initForm(store.prefs);
      } else {
        // First open before prefetch completed — fetch with spinner
        await store.fetchPreferences();
        if (store.prefs) {
          initForm(store.prefs);
        }
      }
    }
  },
);

function initForm(prefs: GlobalPreferences) {
  // Deep clone to avoid mutating store state (day_prefs is an array of objects)
  const snapshot = JSON.stringify(prefs);
  form.value = JSON.parse(snapshot);
  originalSnapshot.value = snapshot;
  // Initialize dayEnabled from existing day_prefs
  const enabled = [false, false, false, false, false, false, false];
  if (form.value!.day_prefs) {
    for (const dp of form.value!.day_prefs) {
      if (dp.start_hour !== 0 || dp.end_hour !== 0 || dp.net_start_hour !== 0 || dp.net_end_hour !== 0) {
        enabled[dp.day_of_week] = true;
      }
    }
  }
  dayEnabled.value = enabled;
}

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

function toggleDay(dayOfWeek: number, enabled: boolean) {
  dayEnabled.value[dayOfWeek] = enabled;
  if (!enabled) {
    // Reset day prefs to defaults (0 = use global)
    const dp = getDayPref(dayOfWeek);
    dp.start_hour = 0;
    dp.end_hour = 0;
    dp.net_start_hour = 0;
    dp.net_end_hour = 0;
  }
}

function fmtRange(start: number, end: number): string {
  if (start === 0 && end === 0) return "All day";
  return `${decimalHoursToTimeString(start)} – ${decimalHoursToTimeString(end)}`;
}

function defaultBadge(): string {
  if (!form.value) return "Uses default";
  const cpu = fmtRange(form.value.start_hour, form.value.end_hour);
  const net = fmtRange(form.value.net_start_hour, form.value.net_end_hour);
  return `CPU ${cpu} · Net ${net}`;
}

function setDayField(dayOfWeek: number, field: "start_hour" | "end_hour" | "net_start_hour" | "net_end_hour", value: number) {
  getDayPref(dayOfWeek)[field] = value;
}

async function save() {
  // Always save manager settings
  Object.assign(managerStore.settings, managerForm.value);
  if (!form.value) {
    emit("close");
    return;
  }
  await store.savePreferences(form.value);
  if (!store.error) {
    emit("close");
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay">
      <div class="prefs-dialog">
        <div class="prefs-header">
          <h3>Preferences</h3>
          <button class="close-btn" @click="emit('close')">&times;</button>
        </div>

        <div v-if="store.loading && !form" class="prefs-loading">Loading preferences...</div>

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
            <button class="tab" :class="{ active: activeTab === 'manager' }" @click="activeTab = 'manager'">Manager</button>
          </div>

          <div class="prefs-body">
            <!-- Computing tab -->
            <div v-if="activeTab === 'computing'" class="prefs-section">
              <PrefToggleSwitch
                v-model="form.run_on_batteries"
                label="Run on batteries"
                field="run_on_batteries"
              />
              <PrefToggleSwitch
                v-model="form.run_if_user_active"
                label="Run if user is active"
                field="run_if_user_active"
              />
              <PrefNumericInput
                v-model="form.idle_time_to_run"
                label="Idle time before running (min)"
                field="idle_time_to_run"
                :min="0"
                :step="1"
                zero-label="No wait"
              />
              <PrefNumericInput
                v-model="form.max_ncpus_pct"
                label="Max CPUs used (%)"
                field="max_ncpus_pct"
                :min="0"
                :max="100"
                :step="1"
                zero-label="Use all"
              />
              <PrefNumericInput
                v-model="form.cpu_usage_limit"
                label="CPU usage limit (%)"
                field="cpu_usage_limit"
                :min="0"
                :max="100"
                :step="1"
                zero-label="No limit"
              />
              <PrefNumericInput
                v-model="form.ram_max_used_busy_frac"
                label="RAM when busy (fraction)"
                field="ram_max_used_busy_frac"
                :min="0"
                :max="1"
                :step="0.05"
              />
              <PrefNumericInput
                v-model="form.ram_max_used_idle_frac"
                label="RAM when idle (fraction)"
                field="ram_max_used_idle_frac"
                :min="0"
                :max="1"
                :step="0.05"
              />
              <PrefTimeInput
                v-model="form.start_hour"
                label="Computing start hour"
                field="start_hour"
                zero-label="All day"
              />
              <PrefTimeInput
                v-model="form.end_hour"
                label="Computing end hour"
                field="end_hour"
                zero-label="All day"
              />
              <PrefNumericInput
                v-model="form.suspend_if_no_recent_input"
                label="Suspend if no recent input (min)"
                field="suspend_if_no_recent_input"
                :min="0"
                :step="1"
                zero-label="Disabled"
              />
              <PrefNumericInput
                v-model="form.suspend_cpu_usage"
                label="Suspend if CPU usage above (%)"
                field="suspend_cpu_usage"
                :min="0"
                :max="100"
                :step="1"
                zero-label="Disabled"
              />
              <PrefToggleSwitch
                v-model="form.leave_apps_in_memory"
                label="Leave apps in memory"
                field="leave_apps_in_memory"
              />
              <PrefNumericInput
                v-model="form.work_buf_additional_days"
                label="Additional work buffer (days)"
                field="work_buf_additional_days"
                :min="0"
                :step="0.1"
              />
              <PrefNumericInput
                v-model="form.cpu_scheduling_period_minutes"
                label="CPU scheduling period (min)"
                field="cpu_scheduling_period_minutes"
                :min="0"
                :step="1"
              />
              <Tooltip text="Apps that should suspend BOINC while running" placement="bottom">
                <button class="btn section-btn" @click="showExclusiveApps = true">Exclusive Applications...</button>
              </Tooltip>
            </div>

            <!-- Network tab -->
            <div v-if="activeTab === 'network'" class="prefs-section">
              <PrefNumericInput
                v-model="form.max_bytes_sec_down"
                label="Max download rate (bytes/s)"
                field="max_bytes_sec_down"
                :min="0"
                :step="1024"
                zero-label="No limit"
              />
              <PrefNumericInput
                v-model="form.max_bytes_sec_up"
                label="Max upload rate (bytes/s)"
                field="max_bytes_sec_up"
                :min="0"
                :step="1024"
                zero-label="No limit"
              />
              <PrefNumericInput
                v-model="form.daily_xfer_limit_mb"
                label="Daily transfer limit (MB)"
                field="daily_xfer_limit_mb"
                :min="0"
                :step="100"
                zero-label="No limit"
              />
              <PrefTimeInput
                v-model="form.net_start_hour"
                label="Network start hour"
                field="net_start_hour"
                zero-label="All day"
              />
              <PrefTimeInput
                v-model="form.net_end_hour"
                label="Network end hour"
                field="net_end_hour"
                zero-label="All day"
              />
              <button class="btn section-btn" @click="showProxy = true">Proxy Settings...</button>
            </div>

            <!-- Storage tab -->
            <div v-if="activeTab === 'storage'" class="prefs-section">
              <PrefNumericInput
                v-model="form.disk_max_used_gb"
                label="Max disk used (GB)"
                field="disk_max_used_gb"
                :min="0"
                :step="1"
                zero-label="No limit"
              />
              <PrefNumericInput
                v-model="form.disk_max_used_pct"
                label="Max disk used (%)"
                field="disk_max_used_pct"
                :min="0"
                :max="100"
                :step="1"
                zero-label="No limit"
              />
              <PrefNumericInput
                v-model="form.disk_min_free_gb"
                label="Min free disk (GB)"
                field="disk_min_free_gb"
                :min="0"
                :step="0.1"
              />
              <PrefNumericInput
                v-model="form.work_buf_min_days"
                label="Work buffer (days)"
                field="work_buf_min_days"
                :min="0"
                :step="0.1"
              />
            </div>

            <!-- Schedule tab -->
            <div v-if="activeTab === 'schedule'" class="prefs-section">
              <p class="section-desc">Override computing and network hours for specific days. Unchecked days use the global hours set above.</p>
              <div class="schedule-days">
                <div v-for="(day, i) in dayNames" :key="i" class="schedule-day">
                  <div class="schedule-day-header">
                    <label class="day-toggle">
                      <span class="toggle-switch toggle-sm" :class="{ on: dayEnabled[i] }" role="button" tabindex="0" @click.prevent="toggleDay(i, !dayEnabled[i])" @keydown.enter.prevent="toggleDay(i, !dayEnabled[i])" @keydown.space.prevent="toggleDay(i, !dayEnabled[i])">
                        <span class="toggle-knob" />
                      </span>
                      <span class="day-name">{{ day }}</span>
                    </label>
                    <span v-if="!dayEnabled[i]" class="uses-default-badge">{{ defaultBadge() }}</span>
                  </div>
                  <div v-if="dayEnabled[i]" class="schedule-day-fields">
                    <TimeRangeSlider
                      :start-hour="getDayPref(i).start_hour"
                      :end-hour="getDayPref(i).end_hour"
                      label="CPU"
                      @update:start-hour="setDayField(i, 'start_hour', $event)"
                      @update:end-hour="setDayField(i, 'end_hour', $event)"
                    />
                    <TimeRangeSlider
                      :start-hour="getDayPref(i).net_start_hour"
                      :end-hour="getDayPref(i).net_end_hour"
                      label="Net"
                      @update:start-hour="setDayField(i, 'net_start_hour', $event)"
                      @update:end-hour="setDayField(i, 'net_end_hour', $event)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Manager tab -->
            <div v-if="activeTab === 'manager'" class="prefs-section">
              <div class="manager-row">
                <span class="manager-label">Appearance</span>
                <select v-model="managerForm.theme" class="manager-select">
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div class="manager-row">
                <span class="manager-label">Language</span>
                <select v-model="managerForm.language" class="manager-select">
                  <option value="auto">Auto-detect</option>
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                  <option value="fr">Français</option>
                  <option value="es">Español</option>
                  <option value="pt">Português</option>
                  <option value="zh">中文</option>
                  <option value="ja">日本語</option>
                  <option value="ru">Русский</option>
                </select>
              </div>

              <div class="manager-row">
                <span class="manager-label">Notice reminder</span>
                <select v-model="managerForm.reminderFrequency" class="manager-select">
                  <option value="always">Every time</option>
                  <option value="1h">Every hour</option>
                  <option value="6h">Every 6 hours</option>
                  <option value="1d">Once a day</option>
                  <option value="1w">Once a week</option>
                  <option value="never">Never</option>
                </select>
              </div>

              <label class="pref-row">
                <span>Show exit confirmation</span>
                <span class="toggle-switch" :class="{ on: managerForm.showExitConfirmation }" role="button" tabindex="0" @click.prevent="managerForm.showExitConfirmation = !managerForm.showExitConfirmation" @keydown.enter.prevent="managerForm.showExitConfirmation = !managerForm.showExitConfirmation" @keydown.space.prevent="managerForm.showExitConfirmation = !managerForm.showExitConfirmation">
                  <span class="toggle-knob" />
                </span>
              </label>

              <label class="pref-row">
                <span>Show shutdown confirmation</span>
                <span class="toggle-switch" :class="{ on: managerForm.showShutdownConfirmation }" role="button" tabindex="0" @click.prevent="managerForm.showShutdownConfirmation = !managerForm.showShutdownConfirmation" @keydown.enter.prevent="managerForm.showShutdownConfirmation = !managerForm.showShutdownConfirmation" @keydown.space.prevent="managerForm.showShutdownConfirmation = !managerForm.showShutdownConfirmation">
                  <span class="toggle-knob" />
                </span>
              </label>

              <label class="pref-row">
                <span>Minimize to tray on close</span>
                <span class="toggle-switch" :class="{ on: managerForm.minimizeToTrayOnClose }" role="button" tabindex="0" @click.prevent="managerForm.minimizeToTrayOnClose = !managerForm.minimizeToTrayOnClose" @keydown.enter.prevent="managerForm.minimizeToTrayOnClose = !managerForm.minimizeToTrayOnClose" @keydown.space.prevent="managerForm.minimizeToTrayOnClose = !managerForm.minimizeToTrayOnClose">
                  <span class="toggle-knob" />
                </span>
              </label>

              <label class="pref-row">
                <span>Start minimized to tray</span>
                <span class="toggle-switch" :class="{ on: managerForm.startMinimizedToTray }" role="button" tabindex="0" @click.prevent="managerForm.startMinimizedToTray = !managerForm.startMinimizedToTray" @keydown.enter.prevent="managerForm.startMinimizedToTray = !managerForm.startMinimizedToTray" @keydown.space.prevent="managerForm.startMinimizedToTray = !managerForm.startMinimizedToTray">
                  <span class="toggle-knob" />
                </span>
              </label>
            </div>
          </div>

          <div v-if="store.error" class="prefs-error">{{ store.error }}</div>

          <div class="prefs-footer">
            <button class="btn" @click="emit('close')">Cancel</button>
            <button class="btn btn-primary" :disabled="store.saving || !hasChanges" @click="save">
              {{ store.saving ? "Saving..." : "Save" }}
            </button>
          </div>
        </template>
      </div>
    </div>
    <ProxySettingsDialog :open="showProxy" @close="showProxy = false" />
    <ExclusiveAppsDialog ref="exclusiveAppsRef" :open="showExclusiveApps" @close="showExclusiveApps = false" />
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

.prefs-dialog {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  width: min(580px, 95vw);
  height: min(80vh, 700px);
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
  padding: 8px 20px 16px;
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
  height: 42px;
  padding: 0;
  border-bottom: 1px solid var(--color-border-light);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  cursor: default;
}

.pref-row:last-child {
  border-bottom: none;
}

.toggle-switch {
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
  margin-bottom: var(--space-xs);
  line-height: 1.5;
}

/* ── Schedule tab ──────────────────────────────────────────────── */

.schedule-days {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.schedule-day {
  border-bottom: 1px solid var(--color-border-light);
  padding: 8px 0;
}

.schedule-day:last-child {
  border-bottom: none;
}

.schedule-day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.day-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.toggle-sm {
  width: 28px !important;
  height: 16px !important;
  border-radius: 8px !important;
}

.toggle-sm .toggle-knob {
  width: 12px !important;
  height: 12px !important;
}

.toggle-sm.on .toggle-knob {
  left: 14px !important;
}

.day-name {
  font-size: var(--font-size-md);
  font-weight: 500;
  color: var(--color-text-primary);
}

.uses-default-badge {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.schedule-day-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  padding-left: 24px;
}

.section-btn {
  margin-top: var(--space-md);
}

/* ── Manager tab ─────────────────────────────────────────────────── */

.manager-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 42px;
  padding: 0;
  border-bottom: 1px solid var(--color-border-light);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.manager-row:last-child {
  border-bottom: none;
}

.manager-select {
  width: min(130px, 40vw);
  padding: 5px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}
</style>
