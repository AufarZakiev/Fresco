<script setup lang="ts">
import { computed, ref } from "vue";
import { useProjectsStore } from "../stores/projects";
import type { Project } from "../types/boinc";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import ProjectAttachWizard from "../components/ProjectAttachWizard.vue";
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
import { useToastStore } from "../stores/toast";

const store = useProjectsStore();
const toast = useToastStore();
const actionBusy = ref(false);

const selectedUrls = ref<Set<string>>(new Set());
const lastClickedIndex = ref<number | null>(null);
const showAttachWizard = ref(false);
const { sortKey, sortDir, visibleKeys } = useColumnState(
  "projects",
  ["project", "account", "team", "totalCredit", "avgCredit", "status"],
  "project",
  "asc",
);
const showColumns = ref(false);
const showProperties = ref(false);
const propertiesProject = ref<Project | null>(null);
const confirmAction = ref<{
  title: string;
  message: string;
  action: () => Promise<void>;
} | null>(null);

// Context menu state
const ctxOpen = ref(false);
const ctxX = ref(0);
const ctxY = ref(0);

const allColumns: DataTableColumn[] = [
  { key: "project", label: "Project", sortable: true },
  { key: "account", label: "Account", sortable: true },
  { key: "team", label: "Team", sortable: true },
  { key: "totalCredit", label: "Total Credit", sortable: true, align: "right" },
  { key: "avgCredit", label: "Avg Credit", sortable: true, align: "right" },
  { key: "status", label: "Status", sortable: true },
];

const columns = computed(() =>
  allColumns.map((c) => ({ ...c, visible: visibleKeys.value.includes(c.key) })),
);

function formatCredit(credit: number): string {
  return credit.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function projectStatus(project: Project): string {
  if (project.suspended_via_gui) return "Suspended";
  if (project.dont_request_more_work) return "No new tasks";
  return "Active";
}

function statusVariant(status: string): "default" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "Active":
      return "success";
    case "Suspended":
      return "warning";
    case "No new tasks":
      return "info";
    default:
      return "default";
  }
}

function getSortValue(project: Project, key: string): number | string {
  switch (key) {
    case "project": return project.project_name;
    case "account": return project.user_name;
    case "team": return project.team_name;
    case "totalCredit": return project.user_total_credit;
    case "avgCredit": return project.user_expavg_credit;
    case "status": return projectStatus(project);
    default: return 0;
  }
}

const sortedProjects = computed(() => {
  const projects = [...store.projects];
  const key = sortKey.value;
  const dir = sortDir.value === "asc" ? 1 : -1;
  return projects.sort((a, b) => {
    const va = getSortValue(a, key);
    const vb = getSortValue(b, key);
    if (typeof va === "string" && typeof vb === "string") {
      return dir * va.localeCompare(vb);
    }
    return dir * ((va as number) - (vb as number));
  });
});

const selectedProjects = computed(() =>
  store.projects.filter((p) => selectedUrls.value.has(p.master_url)),
);

const hasSelection = computed(() => selectedUrls.value.size > 0);
const singleSelected = computed(() =>
  selectedProjects.value.length === 1 ? selectedProjects.value[0] : null,
);

const allSelected = computed(() =>
  sortedProjects.value.length > 0 &&
  sortedProjects.value.every((p) => selectedUrls.value.has(p.master_url)),
);

function handleRowClick(project: Project, index: number, event: MouseEvent) {
  if (event.ctrlKey || event.metaKey) {
    const next = new Set(selectedUrls.value);
    if (next.has(project.master_url)) {
      next.delete(project.master_url);
    } else {
      next.add(project.master_url);
    }
    selectedUrls.value = next;
  } else if (event.shiftKey && lastClickedIndex.value !== null) {
    const start = Math.min(lastClickedIndex.value, index);
    const end = Math.max(lastClickedIndex.value, index);
    const next = new Set(selectedUrls.value);
    for (let i = start; i <= end; i++) {
      next.add(sortedProjects.value[i].master_url);
    }
    selectedUrls.value = next;
  } else {
    selectedUrls.value = new Set([project.master_url]);
  }
  lastClickedIndex.value = index;
}

function handleSelectAll(selected: boolean) {
  if (selected) {
    selectedUrls.value = new Set(sortedProjects.value.map((p) => p.master_url));
  } else {
    selectedUrls.value = new Set();
  }
}

function isSelected(project: Project): boolean {
  return selectedUrls.value.has(project.master_url);
}

function handleSort(key: string, dir: "asc" | "desc") {
  sortKey.value = key;
  sortDir.value = dir;
}

function handleRowContext(event: MouseEvent, project: Project, index: number) {
  event.preventDefault();
  if (!selectedUrls.value.has(project.master_url)) {
    selectedUrls.value = new Set([project.master_url]);
    lastClickedIndex.value = index;
  }
  ctxX.value = event.clientX;
  ctxY.value = event.clientY;
  ctxOpen.value = true;
}

const contextMenuItems = computed<ContextMenuItem[]>(() => {
  const items: ContextMenuItem[] = [];
  const p = singleSelected.value;
  items.push({ label: "Update", action: "update" });
  items.push({
    label: p?.suspended_via_gui ? "Resume" : "Suspend",
    action: "suspend-resume",
  });
  items.push({
    label: p?.dont_request_more_work ? "Allow new tasks" : "No new tasks",
    action: "no-new-allow",
  });
  if (p && p.gui_urls && p.gui_urls.length > 1) {
    for (let i = 0; i < p.gui_urls.length; i++) {
      items.push({
        label: p.gui_urls[i].name || `Web Page ${i + 1}`,
        action: `webpage-${i}`,
      });
    }
  } else {
    items.push({
      label: "Web Page",
      action: "webpage-0",
      disabled: !p || !p.gui_urls || p.gui_urls.length === 0,
    });
  }
  items.push({ label: "", action: "", divider: true });
  items.push({ label: "Reset", action: "reset", danger: true });
  items.push({ label: "Detach", action: "detach", danger: true });
  items.push({ label: "", action: "", divider: true });
  items.push({
    label: "Properties",
    action: "properties",
    disabled: selectedUrls.value.size !== 1,
  });
  return items;
});

function openProperties() {
  if (selectedProjects.value.length === 1) {
    propertiesProject.value = selectedProjects.value[0];
    showProperties.value = true;
  }
}

function handleRowDblClick(project: Project) {
  propertiesProject.value = project;
  showProperties.value = true;
}

async function openWebPage(index: number) {
  const p = singleSelected.value;
  if (p && p.gui_urls && p.gui_urls[index]) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(p.gui_urls[index].url);
    } catch {
      window.open(p.gui_urls[index].url, "_blank");
    }
  }
}

async function handleContextAction(action: string) {
  switch (action) {
    case "update":
      await handleUpdate();
      break;
    case "suspend-resume":
      await handleSuspendResume();
      break;
    case "no-new-allow":
      await handleNoNewAllowTasks();
      break;
    case "reset":
      handleReset();
      break;
    case "detach":
      handleDetach();
      break;
    case "properties":
      openProperties();
      break;
    default:
      if (action.startsWith("webpage-")) {
        openWebPage(Number(action.split("-")[1]));
      }
      break;
  }
}

async function handleSuspendResume() {
  actionBusy.value = true;
  try {
    for (const p of selectedProjects.value) {
      if (p.suspended_via_gui) {
        await store.resumeProject(p.master_url);
      } else {
        await store.suspendProject(p.master_url);
      }
    }
    toast.show("Project updated", "success");
  } catch (e) {
    toast.show(`Action failed: ${e}`, "error");
  } finally {
    actionBusy.value = false;
  }
}

async function handleNoNewAllowTasks() {
  actionBusy.value = true;
  try {
    for (const p of selectedProjects.value) {
      if (p.dont_request_more_work) {
        await store.allowNewTasks(p.master_url);
      } else {
        await store.noNewTasks(p.master_url);
      }
    }
    toast.show("Task preference updated", "success");
  } catch (e) {
    toast.show(`Action failed: ${e}`, "error");
  } finally {
    actionBusy.value = false;
  }
}

async function handleUpdate() {
  actionBusy.value = true;
  try {
    for (const p of selectedProjects.value) {
      await store.updateProject(p.master_url);
    }
    toast.show("Project update requested", "success");
  } catch (e) {
    toast.show(`Update failed: ${e}`, "error");
  } finally {
    actionBusy.value = false;
  }
}

function handleReset() {
  if (selectedProjects.value.length === 0) return;
  const urls = selectedProjects.value.map((p) => p.master_url);
  const names = selectedProjects.value.map((p) => p.project_name).join(", ");
  confirmAction.value = {
    title: "Reset Project",
    message: `Reset "${names}"? All tasks for this project will be lost.`,
    action: async () => {
      for (const url of urls) {
        await store.resetProject(url);
      }
      selectedUrls.value = new Set();
    },
  };
}

function handleDetach() {
  if (selectedProjects.value.length === 0) return;
  const urls = selectedProjects.value.map((p) => p.master_url);
  const names = selectedProjects.value.map((p) => p.project_name).join(", ");
  confirmAction.value = {
    title: "Detach Project",
    message: `Detach from "${names}"? You will stop contributing to this project.`,
    action: async () => {
      for (const url of urls) {
        await store.detachProject(url);
      }
      selectedUrls.value = new Set();
    },
  };
}

async function doConfirm() {
  if (confirmAction.value) {
    actionBusy.value = true;
    try {
      await confirmAction.value.action();
      toast.show(`${confirmAction.value.title} completed`, "success");
    } catch (e) {
      toast.show(`${confirmAction.value.title} failed: ${e}`, "error");
    } finally {
      actionBusy.value = false;
      confirmAction.value = null;
    }
  }
}

useKeyboard({
  onSelectAll: () => handleSelectAll(true),
  onDeselect: () => { selectedUrls.value = new Set(); },
});

function isColVisible(key: string): boolean {
  return visibleKeys.value.includes(key);
}
</script>

<template>
  <div class="projects-view">
    <PageHeader title="Projects">
      <button class="btn btn-primary" @click="showAttachWizard = true">Add Project</button>
      <template v-if="hasSelection">
        <button class="btn" :disabled="actionBusy" @click="handleUpdate">Update</button>
        <button class="btn" :disabled="actionBusy" @click="handleSuspendResume">
          {{ singleSelected?.suspended_via_gui ? "Resume" : "Suspend" }}
        </button>
        <button class="btn" :disabled="actionBusy" @click="handleNoNewAllowTasks">
          {{ singleSelected?.dont_request_more_work ? "Allow new tasks" : "No new tasks" }}
        </button>
        <button
          v-if="singleSelected?.gui_urls?.length"
          class="btn"
          @click="openWebPage(0)"
        >
          Web Page
        </button>
        <button class="btn btn-danger" @click="handleReset">Reset</button>
        <button class="btn btn-danger" @click="handleDetach">Detach</button>
        <button v-if="selectedUrls.size === 1" class="btn" @click="openProperties">
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
      v-else-if="store.loading && store.projects.length === 0"
      icon="&#8987;"
      message="Loading projects..."
    />

    <EmptyState
      v-else-if="store.projects.length === 0"
      icon="&#128194;"
      message="No projects attached."
    />

    <DataTable
      v-if="store.projects.length > 0"
      :columns="columns"
      :sort-key="sortKey"
      :sort-dir="sortDir"
      selectable
      :all-selected="allSelected"
      @sort="handleSort"
      @select-all="handleSelectAll"
    >
      <tr
        v-for="(project, index) in sortedProjects"
        :key="project.master_url"
        :class="{ 'row-selected': isSelected(project) }"
        @click="handleRowClick(project, index, $event)"
        @dblclick="handleRowDblClick(project)"
        @contextmenu="handleRowContext($event, project, index)"
      >
        <td class="col-checkbox">
          <input
            type="checkbox"
            :checked="isSelected(project)"
            @click.stop
            @change="handleRowClick(project, index, { ctrlKey: true } as MouseEvent)"
          />
        </td>
        <td v-if="isColVisible('project')" class="col-name">{{ project.project_name }}</td>
        <td v-if="isColVisible('account')">{{ project.user_name }}</td>
        <td v-if="isColVisible('team')">{{ project.team_name || "---" }}</td>
        <td v-if="isColVisible('totalCredit')" class="col-number">{{ formatCredit(project.user_total_credit) }}</td>
        <td v-if="isColVisible('avgCredit')" class="col-number">{{ formatCredit(project.user_expavg_credit) }}</td>
        <td v-if="isColVisible('status')">
          <StatusBadge :variant="statusVariant(projectStatus(project))">
            {{ projectStatus(project) }}
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
      :open="confirmAction !== null"
      :title="confirmAction?.title ?? ''"
      :message="confirmAction?.message ?? ''"
      @confirm="doConfirm"
      @cancel="confirmAction = null"
    />

    <ProjectAttachWizard
      :open="showAttachWizard"
      @close="showAttachWizard = false"
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
      type="project"
      :project="propertiesProject ?? undefined"
      @close="showProperties = false"
    />
  </div>
</template>

<style scoped>
.projects-view {
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
  font-weight: 500;
}

.col-number {
  font-family: monospace;
  text-align: right;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  min-width: 32px;
}
</style>
