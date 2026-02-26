<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useProjectsStore } from "../stores/projects";
import type { Project, SortDir } from "../types/boinc";
import { SORT_DIR } from "../types/boinc";
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
import AccountManagerWizard from "../components/AccountManagerWizard.vue";
import Tooltip from "../components/Tooltip.vue";
import { onKeyStroke } from "@vueuse/core";
import { useColumnState } from "../composables/useColumnState";
import { useToastStore } from "../stores/toast";

const { t } = useI18n();
const store = useProjectsStore();
const toast = useToastStore();
const actionBusy = ref(false);

const selectedUrls = ref<Set<string>>(new Set());
const lastClickedIndex = ref<number | null>(null);
const showAttachWizard = ref(false);
const { sortKey, sortDir, visibleKeys } = useColumnState(
  "projects",
  ["project", "account", "team", "totalCredit", "avgCredit", "source", "status"],
  "project",
  SORT_DIR.ASC,
);
const showColumns = ref(false);
const showProperties = ref(false);
const showAcctMgr = ref(false);
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

const allColumns = computed<DataTableColumn[]>(() => [
  { key: "project", label: t("projects.col.project"), sortable: true },
  { key: "account", label: t("projects.col.account"), sortable: true },
  { key: "team", label: t("projects.col.team"), sortable: true },
  { key: "totalCredit", label: t("projects.col.totalCredit"), sortable: true, align: "right" },
  { key: "avgCredit", label: t("projects.col.avgCredit"), sortable: true, align: "right" },
  { key: "status", label: t("projects.col.status"), sortable: true },
  { key: "source", label: t("projects.col.source"), sortable: true },
]);

const columns = computed(() =>
  allColumns.value.map((c) => ({ ...c, visible: visibleKeys.value.includes(c.key) })),
);

function formatCredit(credit: number): string {
  return credit.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function projectStatus(project: Project): string {
  if (project.suspended_via_gui) return t("projects.status.suspended");
  if (project.dont_request_more_work) return t("projects.status.noNewTasks");
  return t("projects.status.active");
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
    case "source": return project.attached_via_acct_mgr ? t("projects.source.manager") : t("projects.source.user");
    case "status": return projectStatus(project);
    default: return 0;
  }
}

const sortedProjects = computed(() => {
  const projects = [...store.projects];
  const key = sortKey.value;
  const dir = sortDir.value === SORT_DIR.ASC ? 1 : -1;
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

function handleSort(key: string, dir: SortDir) {
  sortKey.value = key;
  sortDir.value = dir;
}

function handleRowContext(event: MouseEvent, _project: Project, _index: number) {
  event.preventDefault();
  ctxX.value = event.clientX;
  ctxY.value = event.clientY;
  ctxOpen.value = true;
}

const contextMenuItems = computed<ContextMenuItem[]>(() => {
  const items: ContextMenuItem[] = [];
  const p = singleSelected.value;
  items.push({ label: t("projects.context.update"), action: "update" });
  items.push({
    label: p?.suspended_via_gui ? t("projects.drawer.resume") : t("projects.drawer.suspend"),
    action: "suspend-resume",
  });
  items.push({
    label: p?.dont_request_more_work ? t("projects.drawer.allowNewTasks") : t("projects.drawer.noNewTasks"),
    action: "no-new-allow",
  });
  if (p && p.gui_urls && p.gui_urls.length > 1) {
    for (let i = 0; i < p.gui_urls.length; i++) {
      items.push({
        label: p.gui_urls[i].name || `${t("projects.drawer.webPage")} ${i + 1}`,
        action: `webpage-${i}`,
      });
    }
  } else {
    items.push({
      label: t("projects.drawer.webPage"),
      action: "webpage-0",
      disabled: !p || !p.gui_urls || p.gui_urls.length === 0,
    });
  }
  items.push({ label: "", action: "", divider: true });
  items.push({ label: t("projects.context.reset"), action: "reset", danger: true });
  items.push({ label: t("projects.context.detach"), action: "detach", danger: true });
  items.push({ label: "", action: "", divider: true });
  items.push({
    label: t("projects.context.properties"),
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
    toast.show(t("projects.toast.updated"), "success");
  } catch (e) {
    toast.show(t("projects.toast.actionFailed", { error: String(e) }), "error");
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
    toast.show(t("projects.toast.taskPrefUpdated"), "success");
  } catch (e) {
    toast.show(t("projects.toast.actionFailed", { error: String(e) }), "error");
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
    toast.show(t("projects.toast.updateRequested"), "success");
  } catch (e) {
    toast.show(t("projects.toast.updateFailed", { error: String(e) }), "error");
  } finally {
    actionBusy.value = false;
  }
}

function handleReset() {
  if (selectedProjects.value.length === 0) return;
  const urls = selectedProjects.value.map((p) => p.master_url);
  const names = selectedProjects.value.map((p) => p.project_name).join(", ");
  confirmAction.value = {
    title: t("projects.resetDialog.title"),
    message: t("projects.resetDialog.message", { names }),
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
    title: t("projects.detachDialog.title"),
    message: t("projects.detachDialog.message", { names }),
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
  selectedUrls.value = new Set();
});

function isColVisible(key: string): boolean {
  return visibleKeys.value.includes(key);
}
</script>

<template>
  <div class="projects-view">
    <PageHeader :title="$t('projects.title')">
      <button class="btn btn-primary" @click="showAttachWizard = true">{{ $t('projects.addProject') }}</button>
      <button class="btn" @click="showAcctMgr = true">{{ $t('projects.accountManager') }}</button>
      <Tooltip :text="$t('projects.columns')">
        <button class="btn-columns" @click="showColumns = true">
          <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
            <rect x="1" y="2" width="3" height="12" rx="0.5" />
            <rect x="6.5" y="2" width="3" height="12" rx="0.5" />
            <rect x="12" y="2" width="3" height="12" rx="0.5" />
          </svg>
        </button>
      </Tooltip>
    </PageHeader>

    <div class="content-row">
      <div class="content-main">
        <p v-if="store.error" class="error">{{ store.error }}</p>

        <EmptyState
          v-else-if="store.loading && store.projects.length === 0"
          icon="&#8987;"
          :message="$t('projects.loading')"
        />

        <EmptyState
          v-else-if="store.projects.length === 0"
          icon="&#128194;"
          :message="$t('projects.empty')"
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
            <td v-if="isColVisible('source')" class="col-source">
              <span
                class="source-badge"
                :class="project.attached_via_acct_mgr ? 'source-manager' : 'source-user'"
                :title="project.attached_via_acct_mgr ? $t('projects.source.manager') : $t('projects.source.user')"
              >
                <span class="source-label">{{ project.attached_via_acct_mgr ? $t('projects.source.manager') : $t('projects.source.user') }}</span>
              </span>
            </td>
          </tr>
        </DataTable>
      </div>

      <Transition name="drawer">
        <div v-if="hasSelection" class="drawer-panel">
          <div class="drawer-header">
            <h3>{{ singleSelected?.project_name ?? $t('projects.nProjects', selectedUrls.size) }}</h3>
          </div>

          <div class="drawer-section">
            <Tooltip :text="$t('projects.tooltip.update')">
              <button class="btn" :disabled="actionBusy" @click="handleUpdate">{{ $t('projects.drawer.update') }}</button>
            </Tooltip>
            <Tooltip :text="singleSelected?.suspended_via_gui ? $t('projects.tooltip.resume') : $t('projects.tooltip.suspend')">
              <button class="btn" :disabled="actionBusy" @click="handleSuspendResume">
                {{ singleSelected?.suspended_via_gui ? $t('projects.drawer.resume') : $t('projects.drawer.suspend') }}
              </button>
            </Tooltip>
            <Tooltip :text="singleSelected?.dont_request_more_work ? $t('projects.tooltip.allowNewTasks') : $t('projects.tooltip.noNewTasks')">
              <button class="btn" :disabled="actionBusy" @click="handleNoNewAllowTasks">
                {{ singleSelected?.dont_request_more_work ? $t('projects.drawer.allowNewTasks') : $t('projects.drawer.noNewTasks') }}
              </button>
            </Tooltip>
            <Tooltip v-if="selectedUrls.size === 1" :text="$t('projects.tooltip.properties')">
              <button class="btn" @click="openProperties">{{ $t('projects.drawer.properties') }}</button>
            </Tooltip>
          </div>

          <div class="drawer-section drawer-danger">
            <Tooltip :text="$t('projects.tooltip.reset')">
              <button class="btn btn-danger" @click="handleReset">{{ $t('projects.drawer.reset') }}</button>
            </Tooltip>
            <Tooltip :text="$t('projects.tooltip.detach')">
              <button class="btn btn-danger" @click="handleDetach">{{ $t('projects.drawer.detach') }}</button>
            </Tooltip>
          </div>

          <div v-if="singleSelected?.gui_urls?.length" class="drawer-section drawer-links">
            <div class="drawer-section-label">{{ $t('projects.drawer.webLinks') }}</div>
            <a
              v-for="(gu, i) in singleSelected.gui_urls"
              :key="gu.url"
              class="web-link"
              href="#"
              @click.prevent="openWebPage(i)"
            >
              {{ gu.name || $t('projects.drawer.webPage') }}
            </a>
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

    <AccountManagerWizard
      :open="showAcctMgr"
      @close="showAcctMgr = false"
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
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
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
  font-weight: 500;
}

.col-source {
  white-space: nowrap;
}

.source-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 500;
  line-height: 1.5;
  min-width: 10px;
  min-height: 10px;
  cursor: default;
}

.source-manager {
  background: var(--color-accent-light);
  color: #1d4ed8;
}

.source-user {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

/* Collapse to dot when column is narrow */
@container (max-width: 0px) {
  .source-label { display: none; }
}

/* Use a resize-aware approach: hide label when table is tight */
.data-table-wrapper:has(.col-source) .source-label {
  /* label always visible by default */
}

@media (max-width: 900px) {
  .source-label {
    display: none;
  }

  .source-badge {
    width: 10px;
    height: 10px;
    padding: 0;
    border-radius: 50%;
  }
}

:root[data-theme="dark"] .source-manager,
[data-theme="dark"] .source-manager {
  color: #93c5fd;
}

.col-number {
  font-family: monospace;
  text-align: right;
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

.drawer-links {
  border-top: 1px solid var(--color-border-light);
  padding-top: var(--space-md);
}

.drawer-section-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-xs);
}

.web-link {
  color: var(--color-accent);
  text-decoration: none;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: color var(--transition-fast);
  padding: 2px 0;
}

.web-link:hover {
  color: var(--color-accent-hover);
  text-decoration: underline;
}

/* Drawer transition */
.drawer-enter-active,
.drawer-leave-active {
  transition: width 0.2s ease, opacity 0.2s ease;
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
