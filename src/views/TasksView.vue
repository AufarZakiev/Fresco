<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useTasksStore } from "../stores/tasks";
import type { TaskResult } from "../types/boinc";
import {
  RESULT_STATE,
  ACTIVE_TASK_STATE,
  SCHEDULER_STATE,
  SORT_DIR,
} from "../types/boinc";
import type { SortDir } from "../types/boinc";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import PageHeader from "../components/PageHeader.vue";
import DataTable from "../components/DataTable.vue";
import type { DataTableColumn } from "../components/DataTable.vue";
import EmptyState from "../components/EmptyState.vue";
import StatusBadge from "../components/StatusBadge.vue";
import ContextMenu from "../components/ContextMenu.vue";
import type { ContextMenuItem } from "../components/ContextMenu.vue";
import ColumnCustomizationDialog from "../components/ColumnCustomizationDialog.vue";
import ItemPropertiesDialog from "../components/ItemPropertiesDialog.vue";
import Tooltip from "../components/Tooltip.vue";
import { onKeyStroke } from "@vueuse/core";
import { useColumnState } from "../composables/useColumnState";
import { launchGraphics, launchRemoteDesktop } from "../composables/useRpc";
import { useProjectsStore } from "../stores/projects";
import { useToastStore } from "../stores/toast";

const { t } = useI18n();
const store = useTasksStore();
const projectsStore = useProjectsStore();
const toast = useToastStore();
const actionBusy = ref(false);

const selectedNames = ref<Set<string>>(new Set());
const lastClickedIndex = ref<number | null>(null);
const confirmAbort = ref(false);
const activeTasksOnly = ref(false);
const { sortKey, sortDir, visibleKeys } = useColumnState(
  "tasks",
  ["task", "project", "progress", "elapsed", "remaining", "status"],
  "progress",
  SORT_DIR.DESC,
);
const showColumns = ref(false);
const showProperties = ref(false);
const propertiesTask = ref<TaskResult | null>(null);

// Context menu state
const ctxOpen = ref(false);
const ctxX = ref(0);
const ctxY = ref(0);

const projectNameByUrl = computed(() => {
  const map = new Map<string, string>();
  for (const p of projectsStore.projects) {
    map.set(p.master_url, p.project_name);
  }
  return map;
});

function projectName(url: string): string {
  return projectNameByUrl.value.get(url) || url;
}

const allColumns = computed<DataTableColumn[]>(() => [
  { key: "project", label: t("tasks.col.project"), sortable: true },
  { key: "progress", label: t("tasks.col.progress"), sortable: true },
  { key: "elapsed", label: t("tasks.col.elapsed"), sortable: true, align: "right" },
  { key: "remaining", label: t("tasks.col.remaining"), sortable: true, align: "right" },
  { key: "status", label: t("tasks.col.status"), sortable: true },
  { key: "resources", label: t("tasks.col.resources"), sortable: true },
  { key: "task", label: t("tasks.col.task"), sortable: true },
]);

const columns = computed(() =>
  allColumns.value.map((c) => ({ ...c, visible: visibleKeys.value.includes(c.key) })),
);

function formatTime(seconds: number): string {
  if (seconds <= 0) return "---";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(2)}%`;
}

function taskStatus(task: {
  state: number;
  active_task: boolean;
  active_task_state: number;
  scheduler_state: number;
  suspended_via_gui: boolean;
  ready_to_report: boolean;
}): string {
  if (task.ready_to_report) return t("tasks.status.readyToReport");
  if (task.suspended_via_gui) return t("tasks.status.suspended");
  if (task.state === RESULT_STATE.FILES_DOWNLOADING) return t("tasks.status.downloading");
  if (task.state === RESULT_STATE.FILES_UPLOADING) return t("tasks.status.uploading");
  if (task.state === RESULT_STATE.COMPUTE_ERROR) return t("tasks.status.computeError");
  if (task.state === RESULT_STATE.ABORTED) return t("tasks.status.aborted");
  if (task.active_task) {
    if (task.active_task_state === ACTIVE_TASK_STATE.EXECUTING) {
      return task.scheduler_state === SCHEDULER_STATE.SCHEDULED
        ? t("tasks.status.running")
        : t("tasks.status.waitingToRun");
    }
    if (task.active_task_state === ACTIVE_TASK_STATE.SUSPENDED)
      return t("tasks.status.suspended");
  }
  return t("tasks.status.waiting");
}

function statusVariant(task: TaskResult): "default" | "success" | "warning" | "danger" | "info" {
  if (task.ready_to_report) return "default";
  if (task.suspended_via_gui) return "warning";
  if (task.state === RESULT_STATE.FILES_DOWNLOADING || task.state === RESULT_STATE.FILES_UPLOADING) return "info";
  if (task.state === RESULT_STATE.COMPUTE_ERROR || task.state === RESULT_STATE.ABORTED) return "danger";
  if (task.active_task) {
    if (task.active_task_state === ACTIVE_TASK_STATE.EXECUTING) {
      return task.scheduler_state === SCHEDULER_STATE.SCHEDULED ? "success" : "info";
    }
    if (task.active_task_state === ACTIVE_TASK_STATE.SUSPENDED) return "warning";
  }
  return "default";
}

function getSortValue(task: TaskResult, key: string): number | string {
  switch (key) {
    case "task": return task.wu_name;
    case "project": return projectName(task.project_url);
    case "progress": return task.fraction_done;
    case "elapsed": return task.elapsed_time;
    case "remaining": return task.estimated_cpu_time_remaining;
    case "status": return taskStatus(task);
    case "resources": return task.resources;
    default: return 0;
  }
}

const filteredTasks = computed(() => {
  let tasks = store.tasks;
  if (activeTasksOnly.value) {
    tasks = tasks.filter((t) => t.active_task);
  }
  return tasks;
});

const sortedTasks = computed(() => {
  const tasks = [...filteredTasks.value];
  const key = sortKey.value;
  const dir = sortDir.value === SORT_DIR.ASC ? 1 : -1;
  return tasks.sort((a, b) => {
    const va = getSortValue(a, key);
    const vb = getSortValue(b, key);
    if (typeof va === "string" && typeof vb === "string") {
      return dir * va.localeCompare(vb);
    }
    return dir * ((va as number) - (vb as number));
  });
});

const selectedTasks = computed(() =>
  store.tasks.filter((t) => selectedNames.value.has(t.name)),
);

const hasSelection = computed(() => selectedNames.value.size > 0);

const allSelectedSuspended = computed(() =>
  selectedTasks.value.length > 0 &&
  selectedTasks.value.every((t) => t.suspended_via_gui),
);

const suspendResumeLabel = computed(() =>
  allSelectedSuspended.value ? t("tasks.resume") : t("tasks.suspend"),
);

const allSelected = computed(() =>
  sortedTasks.value.length > 0 &&
  sortedTasks.value.every((t) => selectedNames.value.has(t.name)),
);

function handleRowClick(task: TaskResult, index: number, event: MouseEvent) {
  if (event.ctrlKey || event.metaKey) {
    const next = new Set(selectedNames.value);
    if (next.has(task.name)) {
      next.delete(task.name);
    } else {
      next.add(task.name);
    }
    selectedNames.value = next;
  } else if (event.shiftKey && lastClickedIndex.value !== null) {
    const start = Math.min(lastClickedIndex.value, index);
    const end = Math.max(lastClickedIndex.value, index);
    const next = new Set(selectedNames.value);
    for (let i = start; i <= end; i++) {
      next.add(sortedTasks.value[i].name);
    }
    selectedNames.value = next;
  } else {
    selectedNames.value = new Set([task.name]);
  }
  lastClickedIndex.value = index;
}

function handleSelectAll(selected: boolean) {
  if (selected) {
    selectedNames.value = new Set(sortedTasks.value.map((t) => t.name));
  } else {
    selectedNames.value = new Set();
  }
}

function isSelected(task: TaskResult): boolean {
  return selectedNames.value.has(task.name);
}

function handleSort(key: string, dir: SortDir) {
  sortKey.value = key;
  sortDir.value = dir;
}

function handleRowContext(event: MouseEvent, task: TaskResult, index: number) {
  event.preventDefault();
  if (!selectedNames.value.has(task.name)) {
    selectedNames.value = new Set([task.name]);
    lastClickedIndex.value = index;
  }
  ctxX.value = event.clientX;
  ctxY.value = event.clientY;
  ctxOpen.value = true;
}

const contextMenuItems = computed<ContextMenuItem[]>(() => {
  const items: ContextMenuItem[] = [];
  const isSuspended = allSelectedSuspended.value;
  items.push({
    label: isSuspended ? t("tasks.resume") : t("tasks.suspend"),
    action: "suspend-resume",
  });
  items.push({
    label: t("tasks.context.showGraphics"),
    action: "graphics",
    disabled: !hasGraphics.value,
  });
  items.push({
    label: t("tasks.context.showVmConsole"),
    action: "vm-console",
    disabled: !hasVmConsole.value,
  });
  items.push({ label: "", action: "", divider: true });
  items.push({
    label: t("tasks.abort"),
    action: "abort",
    danger: true,
  });
  items.push({ label: "", action: "", divider: true });
  items.push({
    label: t("tasks.properties"),
    action: "properties",
    disabled: selectedNames.value.size !== 1,
  });
  return items;
});

function openProperties() {
  const tasks = selectedTasks.value;
  if (tasks.length === 1) {
    propertiesTask.value = tasks[0];
    showProperties.value = true;
  }
}

function handleRowDblClick(task: TaskResult) {
  propertiesTask.value = task;
  showProperties.value = true;
}

async function handleShowGraphics() {
  const task = selectedTasks.value[0];
  if (!task) return;
  if (task.web_graphics_url) {
    window.open(task.web_graphics_url, "_blank");
  } else if (task.graphics_exec_path) {
    await launchGraphics(task.graphics_exec_path);
  }
}

async function handleShowVmConsole() {
  const task = selectedTasks.value[0];
  if (!task || !task.remote_desktop_addr) return;
  await launchRemoteDesktop(task.remote_desktop_addr);
}

const hasGraphics = computed(() => {
  const task = selectedTasks.value.length === 1 ? selectedTasks.value[0] : null;
  return task && (task.graphics_exec_path || task.web_graphics_url);
});

const hasVmConsole = computed(() => {
  const task = selectedTasks.value.length === 1 ? selectedTasks.value[0] : null;
  return task && task.remote_desktop_addr;
});

async function handleContextAction(action: string) {
  switch (action) {
    case "suspend-resume":
      await handleSuspendResume();
      break;
    case "abort":
      confirmAbort.value = true;
      break;
    case "properties":
      openProperties();
      break;
    case "graphics":
      await handleShowGraphics();
      break;
    case "vm-console":
      await handleShowVmConsole();
      break;
  }
}

async function handleSuspendResume() {
  actionBusy.value = true;
  try {
    for (const task of selectedTasks.value) {
      if (task.suspended_via_gui) {
        await store.resumeTask(task.project_url, task.name);
      } else {
        await store.suspendTask(task.project_url, task.name);
      }
    }
    toast.show(allSelectedSuspended.value ? t("tasks.toast.resumed") : t("tasks.toast.suspended"), "success");
  } catch (e) {
    toast.show(t("tasks.toast.actionFailed", { error: String(e) }), "error");
  } finally {
    actionBusy.value = false;
  }
}

async function doAbort() {
  actionBusy.value = true;
  try {
    for (const task of selectedTasks.value) {
      await store.abortTask(task.project_url, task.name);
    }
    toast.show(t("tasks.toast.aborted"), "success");
  } catch (e) {
    toast.show(t("tasks.toast.abortFailed", { error: String(e) }), "error");
  } finally {
    actionBusy.value = false;
    selectedNames.value = new Set();
    confirmAbort.value = false;
  }
}

// Keyboard shortcuts (ignore when typing in form fields)
function isTypingInInput(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

onKeyStroke("a", (e) => {
  if (isTypingInInput(e) || !(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  handleSelectAll(true);
});

onKeyStroke("Escape", (e) => {
  if (isTypingInInput(e)) return;
  selectedNames.value = new Set();
});

onKeyStroke(["Delete", "Backspace"], (e) => {
  if (isTypingInInput(e)) return;
  if (hasSelection.value) confirmAbort.value = true;
});

function isColVisible(key: string): boolean {
  return visibleKeys.value.includes(key);
}
</script>

<template>
  <div class="tasks-view">
    <PageHeader :title="$t('tasks.title')">
      <button
        :class="['btn', { 'btn-toggle-active': activeTasksOnly }]"
        @click="activeTasksOnly = !activeTasksOnly"
      >
        {{ $t('tasks.activeOnly') }}
      </button>
      <template v-if="hasSelection">
        <button class="btn" :disabled="actionBusy" @click="handleSuspendResume">
          {{ suspendResumeLabel }}
        </button>
        <button v-if="hasGraphics" class="btn" :disabled="actionBusy" @click="handleShowGraphics">
          {{ $t('tasks.graphics') }}
        </button>
        <button class="btn btn-danger" :disabled="actionBusy" @click="confirmAbort = true">
          {{ $t('tasks.abort') }}
        </button>
        <button v-if="selectedNames.size === 1" class="btn" @click="openProperties">
          {{ $t('tasks.properties') }}
        </button>
      </template>
      <Tooltip :text="$t('tasks.columns')">
        <button class="btn-columns" @click="showColumns = true">
          <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
            <rect x="1" y="2" width="3" height="12" rx="0.5" />
            <rect x="6.5" y="2" width="3" height="12" rx="0.5" />
            <rect x="12" y="2" width="3" height="12" rx="0.5" />
          </svg>
        </button>
      </Tooltip>
    </PageHeader>

    <p v-if="store.error" class="error">{{ store.error }}</p>

    <EmptyState
      v-else-if="store.loading && store.tasks.length === 0"
      icon="&#8987;"
      :message="$t('tasks.loading')"
    />

    <EmptyState
      v-else-if="filteredTasks.length === 0"
      icon="&#128203;"
      :message="activeTasksOnly
        ? $t('tasks.emptyActive')
        : $t('tasks.emptyAll')"
    />

    <DataTable
      v-else
      :columns="columns"
      :sort-key="sortKey"
      :sort-dir="sortDir"
      selectable
      :all-selected="allSelected"
      @sort="handleSort"
      @select-all="handleSelectAll"
    >
      <tr
        v-for="(task, index) in sortedTasks"
        :key="task.name"
        :class="{ 'row-selected': isSelected(task) }"
        @click="handleRowClick(task, index, $event)"
        @dblclick="handleRowDblClick(task)"
        @contextmenu="handleRowContext($event, task, index)"
      >
        <td class="col-checkbox">
          <input
            type="checkbox"
            :checked="isSelected(task)"
            @click.stop
            @change="handleRowClick(task, index, { ctrlKey: true } as MouseEvent)"
          />
        </td>
        <td v-if="isColVisible('project')" class="col-project" :title="task.project_url">{{ projectName(task.project_url) }}</td>
        <td v-if="isColVisible('progress')" class="col-progress">
          <div
            class="progress-bar"
            role="progressbar"
            :aria-valuenow="Math.min(100, Math.max(0, Math.round(task.fraction_done * 100)))"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="projectName(task.project_url)"
            :aria-valuetext="formatPercent(task.fraction_done)"
          >
            <div
              class="progress-fill"
              :style="{ width: formatPercent(task.fraction_done) }"
            ></div>
            <span class="progress-text">{{
              formatPercent(task.fraction_done)
            }}</span>
          </div>
        </td>
        <td v-if="isColVisible('elapsed')" class="col-time">{{ formatTime(task.elapsed_time) }}</td>
        <td v-if="isColVisible('remaining')" class="col-time">
          {{ formatTime(task.estimated_cpu_time_remaining) }}
        </td>
        <td v-if="isColVisible('status')">
          <StatusBadge :variant="statusVariant(task)">
            {{ taskStatus(task) }}
          </StatusBadge>
        </td>
        <td v-if="isColVisible('resources')">{{ task.resources || $t('tasks.defaultResources') }}</td>
        <td v-if="isColVisible('task')" class="col-name" :title="task.name">{{ task.wu_name }}</td>
      </tr>
    </DataTable>

    <ContextMenu
      :open="ctxOpen"
      :x="ctxX"
      :y="ctxY"
      :items="contextMenuItems"
      @action="handleContextAction"
      @close="ctxOpen = false"
    />

    <ConfirmDialog
      :open="confirmAbort"
      :title="$t('tasks.abortDialog.title')"
      :message="$t('tasks.abortDialog.message', selectedNames.size)"
      :confirm-label="$t('tasks.abortDialog.confirm')"
      @confirm="doAbort"
      @cancel="confirmAbort = false"
    />

    <ColumnCustomizationDialog
      :open="showColumns"
      :columns="allColumns"
      :visible-keys="visibleKeys"
      @update="visibleKeys = $event"
      @close="showColumns = false"
    />

    <ItemPropertiesDialog
      :open="showProperties"
      type="task"
      :task="propertiesTask ?? undefined"
      @close="showProperties = false"
    />
  </div>
</template>

<style scoped>
.tasks-view {
  padding: var(--space-lg);
}

.error {
  color: var(--color-danger);
  font-size: var(--font-size-md);
}

.col-checkbox {
  width: 36px;
  text-align: center;
  vertical-align: middle;
}

.col-checkbox input[type="checkbox"] {
  width: 15px;
  height: 15px;
}

.col-name {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-project {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.col-time {
  font-family: monospace;
  white-space: nowrap;
  text-align: right;
}

.progress-bar {
  position: relative;
  width: min(120px, 18vw);
  height: 18px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-accent);
  transition: width var(--transition-normal);
}

.progress-text {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  text-align: center;
  font-size: var(--font-size-xs);
  line-height: 18px;
  color: var(--color-text-primary);
}

.btn-toggle-active {
  background: var(--color-accent-light);
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.btn-columns {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  background: none;
  color: var(--color-text-tertiary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color 0.15s;
}

.btn-columns:hover {
  color: var(--color-text-primary);
}
</style>
