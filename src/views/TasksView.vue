<script setup lang="ts">
import { computed, h, ref } from "vue";
import { useI18n } from "vue-i18n";
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
import type { ColumnMeta } from "../components/DataTable.vue";
import EmptyState from "../components/EmptyState.vue";
import StatusBadge from "../components/StatusBadge.vue";
import ContextMenu from "../components/ContextMenu.vue";
import type { ContextMenuItem } from "../components/ContextMenu.vue";
import ItemPropertiesDialog from "../components/ItemPropertiesDialog.vue";
import Tooltip from "../components/Tooltip.vue";
import { onKeyStroke } from "@vueuse/core";
import { useTableState } from "../composables/useTableState";
import { launchGraphics, launchRemoteDesktop } from "../composables/useRpc";
import { useProjectsStore } from "../stores/projects";
import { useToastStore } from "../stores/toast";
import type { ColumnDef } from "@tanstack/vue-table";
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
} from "@tanstack/vue-table";

const { t } = useI18n();
const store = useTasksStore();
const projectsStore = useProjectsStore();
const toast = useToastStore();
const actionBusy = ref(false);

const selectedNames = ref<Set<string>>(new Set());
const lastClickedIndex = ref<number | null>(null);
const confirmAbort = ref(false);
const activeTasksOnly = ref(false);
const allColumnKeys = [
  "project",
  "progress",
  "elapsed",
  "remaining",
  "status",
  "resources",
  "task",
];
const {
  sorting,
  columnVisibility,
  columnOrder,
  onSortingChange,
  onColumnVisibilityChange,
  onColumnOrderChange,
} = useTableState("tasks", allColumnKeys, "progress", true);
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
  if (task.state === RESULT_STATE.FILES_DOWNLOADING)
    return t("tasks.status.downloading");
  if (task.state === RESULT_STATE.FILES_UPLOADING)
    return t("tasks.status.uploading");
  if (task.state === RESULT_STATE.COMPUTE_ERROR)
    return t("tasks.status.computeError");
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

function statusVariant(
  task: TaskResult,
): "default" | "success" | "warning" | "danger" | "info" {
  if (task.ready_to_report) return "default";
  if (task.suspended_via_gui) return "warning";
  if (
    task.state === RESULT_STATE.FILES_DOWNLOADING ||
    task.state === RESULT_STATE.FILES_UPLOADING
  )
    return "info";
  if (
    task.state === RESULT_STATE.COMPUTE_ERROR ||
    task.state === RESULT_STATE.ABORTED
  )
    return "danger";
  if (task.active_task) {
    if (task.active_task_state === ACTIVE_TASK_STATE.EXECUTING) {
      return task.scheduler_state === SCHEDULER_STATE.SCHEDULED
        ? "success"
        : "info";
    }
    if (task.active_task_state === ACTIVE_TASK_STATE.SUSPENDED)
      return "warning";
  }
  return "default";
}

const columns: ColumnDef<TaskResult, unknown>[] = [
  {
    id: "project",
    accessorFn: (row) => projectName(row.project_url),
    header: () => t("tasks.col.project"),
    meta: { class: "col-project" } satisfies ColumnMeta,
  },
  {
    id: "progress",
    accessorFn: (row) => row.fraction_done,
    header: () => t("tasks.col.progress"),
    cell: (info) => {
      const fraction = info.getValue() as number;
      const task = info.row.original;
      return h(
        "div",
        {
          class: "progress-bar",
          role: "progressbar",
          "aria-valuenow": Math.min(
            100,
            Math.max(0, Math.round(fraction * 100)),
          ),
          "aria-valuemin": 0,
          "aria-valuemax": 100,
          "aria-label": projectName(task.project_url),
          "aria-valuetext": formatPercent(fraction),
        },
        [
          h("div", {
            class: "progress-fill",
            style: { width: formatPercent(fraction) },
          }),
          h("span", { class: "progress-text" }, formatPercent(fraction)),
        ],
      );
    },
    meta: { class: "col-progress" } satisfies ColumnMeta,
  },
  {
    id: "elapsed",
    accessorFn: (row) => row.elapsed_time,
    header: () => t("tasks.col.elapsed"),
    cell: (info) => formatTime(info.getValue() as number),
    meta: { align: "right", class: "col-time" } satisfies ColumnMeta,
  },
  {
    id: "remaining",
    accessorFn: (row) => row.estimated_cpu_time_remaining,
    header: () => t("tasks.col.remaining"),
    cell: (info) => formatTime(info.getValue() as number),
    meta: { align: "right", class: "col-time" } satisfies ColumnMeta,
  },
  {
    id: "status",
    accessorFn: (row) => taskStatus(row),
    header: () => t("tasks.col.status"),
    cell: (info) =>
      h(
        StatusBadge,
        { variant: statusVariant(info.row.original) },
        () => info.getValue() as string,
      ),
  },
  {
    id: "resources",
    accessorFn: (row) => row.resources,
    header: () => t("tasks.col.resources"),
    cell: (info) =>
      (info.getValue() as string) || t("tasks.defaultResources"),
  },
  {
    id: "task",
    accessorFn: (row) => row.wu_name,
    header: () => t("tasks.col.task"),
    meta: { class: "col-name" } satisfies ColumnMeta,
  },
];

const filteredTasks = computed(() => {
  let tasks = store.tasks;
  if (activeTasksOnly.value) {
    tasks = tasks.filter((t) => t.active_task);
  }
  return tasks;
});

const table = useVueTable({
  get data() {
    return filteredTasks.value;
  },
  columns,
  state: {
    get sorting() {
      return sorting.value;
    },
    get columnVisibility() {
      return columnVisibility.value;
    },
    get columnOrder() {
      return columnOrder.value;
    },
  },
  onSortingChange,
  onColumnVisibilityChange,
  onColumnOrderChange,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
});

const selectedTasks = computed(() =>
  store.tasks.filter((t) => selectedNames.value.has(t.name)),
);

const hasSelection = computed(() => selectedNames.value.size > 0);

const singleSelectedTask = computed(() =>
  selectedTasks.value.length === 1 ? selectedTasks.value[0] : null,
);

const allSelectedSuspended = computed(
  () =>
    selectedTasks.value.length > 0 &&
    selectedTasks.value.every((t) => t.suspended_via_gui),
);

const suspendResumeLabel = computed(() =>
  allSelectedSuspended.value ? t("tasks.resume") : t("tasks.suspend"),
);

const allSelected = computed(() => {
  const rows = table.getRowModel().rows;
  return (
    rows.length > 0 &&
    rows.every((r) => selectedNames.value.has(r.original.name))
  );
});

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
    const rows = table.getRowModel().rows;
    const start = Math.min(lastClickedIndex.value, index);
    const end = Math.max(lastClickedIndex.value, index);
    const next = new Set(selectedNames.value);
    for (let i = start; i <= end; i++) {
      next.add(rows[i].original.name);
    }
    selectedNames.value = next;
  } else {
    selectedNames.value = new Set([task.name]);
  }
  lastClickedIndex.value = index;
}

function handleSelectAll(selected: boolean) {
  if (selected) {
    selectedNames.value = new Set(
      table.getRowModel().rows.map((r) => r.original.name),
    );
  } else {
    selectedNames.value = new Set();
  }
}

function isSelected(task: TaskResult): boolean {
  return selectedNames.value.has(task.name);
}

function handleRowContext(event: MouseEvent, task: TaskResult, index: number) {
  if (!selectedNames.value.has(task.name)) {
    selectedNames.value = new Set([task.name]);
    lastClickedIndex.value = index;
  }
  ctxX.value = event.clientX;
  ctxY.value = event.clientY;
  ctxOpen.value = true;
}

function handleRowDblClick(task: TaskResult) {
  propertiesTask.value = task;
  showProperties.value = true;
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
    toast.show(
      allSelectedSuspended.value
        ? t("tasks.toast.resumed")
        : t("tasks.toast.suspended"),
      "success",
    );
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
</script>

<template>
  <div class="tasks-view">
    <PageHeader>
      <label
        class="active-filter-toggle"
        @click.prevent="activeTasksOnly = !activeTasksOnly"
      >
        <span
          class="toggle-switch"
          :class="{ on: activeTasksOnly }"
          role="switch"
          :aria-checked="!!activeTasksOnly"
          aria-labelledby="active-tasks-only-label"
          tabindex="0"
          @keydown.enter.prevent="activeTasksOnly = !activeTasksOnly"
          @keydown.space.prevent="activeTasksOnly = !activeTasksOnly"
        >
          <span class="toggle-knob" />
        </span>
        <span id="active-tasks-only-label" class="toggle-label">{{
          $t("tasks.activeOnly")
        }}</span>
      </label>
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
      :message="
        activeTasksOnly ? $t('tasks.emptyActive') : $t('tasks.emptyAll')
      "
    />

    <div v-else class="content-row">
      <div class="content-main">
        <DataTable
          :table="table"
          selectable
          reorderable
          :all-selected="allSelected"
          :is-row-selected="isSelected"
          @row-click="handleRowClick"
          @row-contextmenu="handleRowContext"
          @row-dblclick="handleRowDblClick"
          @select-all="handleSelectAll"
        />
      </div>

      <Transition name="drawer">
        <div v-if="hasSelection" class="drawer-panel">
          <div class="drawer-header">
            <h3>
              {{
                singleSelectedTask?.wu_name ??
                $t("tasks.nTasks", selectedNames.size)
              }}
            </h3>
          </div>

          <div class="drawer-section">
            <Tooltip
              :text="
                allSelectedSuspended
                  ? $t('tasks.tooltip.resume')
                  : $t('tasks.tooltip.suspend')
              "
            >
              <button
                class="btn"
                :disabled="actionBusy"
                @click="handleSuspendResume"
              >
                {{ suspendResumeLabel }}
              </button>
            </Tooltip>
            <Tooltip
              v-if="hasGraphics"
              :text="$t('tasks.context.showGraphics')"
            >
              <button
                class="btn"
                :disabled="actionBusy"
                @click="handleShowGraphics"
              >
                {{ $t("tasks.graphics") }}
              </button>
            </Tooltip>
            <Tooltip
              v-if="selectedNames.size === 1"
              :text="$t('tasks.tooltip.properties')"
            >
              <button class="btn" @click="openProperties">
                {{ $t("tasks.properties") }}
              </button>
            </Tooltip>
          </div>

          <div class="drawer-section drawer-danger">
            <Tooltip :text="$t('tasks.tooltip.abort')">
              <button
                class="btn btn-danger"
                :disabled="actionBusy"
                @click="confirmAbort = true"
              >
                {{ $t("tasks.abort") }}
              </button>
            </Tooltip>
          </div>
        </div>
      </Transition>
    </div>

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
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.error {
  color: var(--color-danger);
  font-size: var(--font-size-md);
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

.active-filter-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  cursor: pointer;
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
  transition:
    background 0.2s,
    opacity 0.2s;
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

.toggle-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  user-select: none;
}

/* Content layout */
.content-row {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 0;
}

.content-main {
  flex: 1;
  min-width: 0;
  overflow: auto;
  margin-right: var(--space-md);
}

/* Side drawer */
.drawer-panel {
  width: 260px;
  flex-shrink: 0;
  background: var(--color-bg);
  border-left: 1px solid var(--color-border);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  overflow-y: auto;
  overflow-x: visible;
}

.drawer-header h3 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.drawer-section .btn {
  width: 100%;
  text-align: left;
}

.drawer-danger {
  border-top: 1px solid var(--color-border-light);
  padding-top: var(--space-md);
}

/* Drawer transition */
.drawer-enter-active,
.drawer-leave-active {
  transition:
    width 0.2s ease,
    opacity 0.2s ease;
  overflow: hidden;
}

.drawer-enter-from,
.drawer-leave-to {
  width: 0;
  padding-left: 0;
  padding-right: 0;
  opacity: 0;
}
</style>
