<script setup lang="ts">
import { computed, ref } from "vue";
import { useTasksStore } from "../stores/tasks";
import type { TaskResult } from "../types/boinc";
import {
  RESULT_STATE,
  ACTIVE_TASK_STATE,
  SCHEDULER_STATE,
} from "../types/boinc";
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
import { useKeyboard } from "../composables/useKeyboard";
import { useColumnState } from "../composables/useColumnState";
import { launchGraphics, launchRemoteDesktop } from "../composables/useRpc";
import { useToastStore } from "../stores/toast";

const store = useTasksStore();
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
  "desc",
);
const showColumns = ref(false);
const showProperties = ref(false);
const propertiesTask = ref<TaskResult | null>(null);

// Context menu state
const ctxOpen = ref(false);
const ctxX = ref(0);
const ctxY = ref(0);

const allColumns: DataTableColumn[] = [
  { key: "task", label: "Task", sortable: true },
  { key: "project", label: "Project", sortable: true },
  { key: "progress", label: "Progress", sortable: true },
  { key: "elapsed", label: "Elapsed", sortable: true, align: "right" },
  { key: "remaining", label: "Remaining", sortable: true, align: "right" },
  { key: "status", label: "Status", sortable: true },
];

const columns = computed(() =>
  allColumns.map((c) => ({ ...c, visible: visibleKeys.value.includes(c.key) })),
);

function formatTime(seconds: number): string {
  if (seconds <= 0) return "---";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
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
  if (task.ready_to_report) return "Ready to report";
  if (task.suspended_via_gui) return "Suspended";
  if (task.state === RESULT_STATE.FILES_DOWNLOADING) return "Downloading";
  if (task.state === RESULT_STATE.FILES_UPLOADING) return "Uploading";
  if (task.state === RESULT_STATE.COMPUTE_ERROR) return "Computation error";
  if (task.state === RESULT_STATE.ABORTED) return "Aborted";
  if (task.active_task) {
    if (task.active_task_state === ACTIVE_TASK_STATE.EXECUTING) {
      return task.scheduler_state === SCHEDULER_STATE.SCHEDULED
        ? "Running"
        : "Waiting to run";
    }
    if (task.active_task_state === ACTIVE_TASK_STATE.SUSPENDED)
      return "Suspended";
  }
  return "Waiting";
}

function statusVariant(status: string): "default" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "Running":
      return "success";
    case "Waiting to run":
    case "Waiting":
    case "Downloading":
    case "Uploading":
      return "info";
    case "Suspended":
      return "warning";
    case "Computation error":
    case "Aborted":
      return "danger";
    case "Ready to report":
      return "default";
    default:
      return "default";
  }
}

function getSortValue(task: TaskResult, key: string): number | string {
  switch (key) {
    case "task": return task.wu_name;
    case "project": return task.project_url;
    case "progress": return task.fraction_done;
    case "elapsed": return task.elapsed_time;
    case "remaining": return task.estimated_cpu_time_remaining;
    case "status": return taskStatus(task);
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
  const dir = sortDir.value === "asc" ? 1 : -1;
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
  allSelectedSuspended.value ? "Resume" : "Suspend",
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

function handleSort(key: string, dir: "asc" | "desc") {
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
    label: isSuspended ? "Resume" : "Suspend",
    action: "suspend-resume",
  });
  items.push({
    label: "Show Graphics",
    action: "graphics",
    disabled: !hasGraphics.value,
  });
  items.push({
    label: "Show VM Console",
    action: "vm-console",
    disabled: !hasVmConsole.value,
  });
  items.push({ label: "", action: "", divider: true });
  items.push({
    label: "Abort",
    action: "abort",
    danger: true,
  });
  items.push({ label: "", action: "", divider: true });
  items.push({
    label: "Properties",
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
    toast.show(allSelectedSuspended.value ? "Tasks resumed" : "Tasks suspended", "success");
  } catch (e) {
    toast.show(`Action failed: ${e}`, "error");
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
    toast.show("Tasks aborted", "success");
  } catch (e) {
    toast.show(`Abort failed: ${e}`, "error");
  } finally {
    actionBusy.value = false;
    selectedNames.value = new Set();
    confirmAbort.value = false;
  }
}

// Keyboard shortcuts
useKeyboard({
  onSelectAll: () => handleSelectAll(true),
  onDeselect: () => { selectedNames.value = new Set(); },
  onDelete: () => {
    if (hasSelection.value) confirmAbort.value = true;
  },
});

function isColVisible(key: string): boolean {
  return visibleKeys.value.includes(key);
}
</script>

<template>
  <div class="tasks-view">
    <PageHeader title="Tasks">
      <button
        :class="['btn', { 'btn-toggle-active': activeTasksOnly }]"
        @click="activeTasksOnly = !activeTasksOnly"
      >
        Active Tasks Only
      </button>
      <template v-if="hasSelection">
        <button class="btn" :disabled="actionBusy" @click="handleSuspendResume">
          {{ suspendResumeLabel }}
        </button>
        <button v-if="hasGraphics" class="btn" :disabled="actionBusy" @click="handleShowGraphics">
          Graphics
        </button>
        <button class="btn btn-danger" :disabled="actionBusy" @click="confirmAbort = true">
          Abort
        </button>
        <button v-if="selectedNames.size === 1" class="btn" @click="openProperties">
          Properties
        </button>
      </template>
      <button class="btn btn-icon" title="Columns" @click="showColumns = true">
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
          <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
        </svg>
      </button>
    </PageHeader>

    <p v-if="store.error" class="error">{{ store.error }}</p>

    <EmptyState
      v-else-if="store.loading && store.tasks.length === 0"
      icon="&#8987;"
      message="Loading tasks..."
    />

    <EmptyState
      v-else-if="store.tasks.length === 0"
      icon="&#128203;"
      message="No tasks. Attach a project to start computing."
    />

    <DataTable
      v-if="filteredTasks.length > 0"
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
        <td v-if="isColVisible('task')" class="col-name" :title="task.name">{{ task.wu_name }}</td>
        <td v-if="isColVisible('project')" class="col-project">{{ task.project_url }}</td>
        <td v-if="isColVisible('progress')" class="col-progress">
          <div class="progress-bar">
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
          <StatusBadge :variant="statusVariant(taskStatus(task))">
            {{ taskStatus(task) }}
          </StatusBadge>
        </td>
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
      title="Abort Tasks"
      :message="`Abort ${selectedNames.size} selected task(s)? This cannot be undone.`"
      confirm-label="Abort"
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
}

.col-checkbox input[type="checkbox"] {
  width: 15px;
  height: 15px;
  accent-color: var(--color-accent);
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
  width: 120px;
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

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  min-width: 32px;
}
</style>
