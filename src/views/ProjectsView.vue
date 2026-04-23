<script setup lang="ts">
import { computed, h, inject, nextTick, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useProjectsStore } from "../stores/projects";
import type { Project } from "../types/boinc";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import DataTable from "../components/DataTable.vue";
import type { ColumnMeta } from "../components/DataTable.vue";
import EmptyState from "../components/EmptyState.vue";
import StatusBadge from "../components/StatusBadge.vue";
import ContextMenu from "../components/ContextMenu.vue";
import type { ContextMenuItem } from "../components/ContextMenu.vue";
import ItemPropertiesDialog from "../components/ItemPropertiesDialog.vue";
import ColumnCustomizationDialog from "../components/ColumnCustomizationDialog.vue";
import Tooltip from "../components/Tooltip.vue";
import { onKeyStroke } from "@vueuse/core";
import { useTableState } from "../composables/useTableState";
import { useToastStore } from "../stores/toast";
import type { ColumnDef } from "@tanstack/vue-table";
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
} from "@tanstack/vue-table";

const { t } = useI18n();
const store = useProjectsStore();
const toast = useToastStore();
const actionBusy = ref(false);
const openAttachWizard = inject<() => void>("openAttachWizard", () => {});
const openAcctMgr = inject<() => void>("openAcctMgr", () => {});

const selectedUrls = ref<Set<string>>(new Set());
const lastClickedIndex = ref<number | null>(null);
const allColumnKeys = [
  "project",
  "account",
  "team",
  "totalCredit",
  "avgCredit",
  "resourceShare",
  "status",
  "source",
];
const {
  sorting,
  columnVisibility,
  columnOrder,
  onSortingChange,
  onColumnVisibilityChange,
  onColumnOrderChange,
} = useTableState("projects", allColumnKeys, "project");
const showProperties = ref(false);
const showColumnDialog = ref(false);
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
const selectedViaContext = ref(false);

function formatCredit(credit: number): string {
  return credit.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const totalResourceShare = computed(() =>
  store.projects.reduce((sum, p) => sum + (p.resource_share || 0), 0),
);

function resourceSharePercent(share: number): number {
  const total = totalResourceShare.value;
  if (total <= 0) return 0;
  return (share / total) * 100;
}

function projectStatus(project: Project): string {
  if (project.suspended_via_gui) return t("projects.status.suspended");
  if (project.dont_request_more_work) return t("projects.status.noNewTasks");
  return t("projects.status.active");
}

function statusVariant(
  project: Project,
): "default" | "success" | "warning" | "danger" | "info" {
  if (project.suspended_via_gui) return "warning";
  if (project.dont_request_more_work) return "info";
  return "success";
}

const columns: ColumnDef<Project, unknown>[] = [
  {
    id: "project",
    accessorFn: (row) => row.project_name,
    header: () => t("projects.col.project"),
    meta: { class: "col-name" } satisfies ColumnMeta,
  },
  {
    id: "account",
    accessorFn: (row) => row.user_name,
    header: () => t("projects.col.account"),
  },
  {
    id: "team",
    accessorFn: (row) => row.team_name,
    header: () => t("projects.col.team"),
    cell: (info) => (info.getValue() as string) || "---",
  },
  {
    id: "totalCredit",
    accessorFn: (row) => row.user_total_credit,
    header: () => t("projects.col.totalCredit"),
    cell: (info) => formatCredit(info.getValue() as number),
    meta: { align: "right", class: "col-number" } satisfies ColumnMeta,
  },
  {
    id: "avgCredit",
    accessorFn: (row) => row.user_expavg_credit,
    header: () => t("projects.col.avgCredit"),
    cell: (info) => formatCredit(info.getValue() as number),
    meta: { align: "right", class: "col-number" } satisfies ColumnMeta,
  },
  {
    id: "resourceShare",
    accessorFn: (row) => row.resource_share,
    header: () => t("projects.col.resourceShare"),
    cell: (info) => {
      const share = info.getValue() as number;
      const pct = resourceSharePercent(share);
      const shareStr = share.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      });
      const pctStr = pct.toFixed(2);
      const total = totalResourceShare.value;
      return h(
        "div",
        {
          class: "share-bar",
          title: total > 0 ? `${shareStr} (${pctStr}%)` : shareStr,
          role: "progressbar",
          "aria-valuenow": Math.round(pct),
          "aria-valuemin": 0,
          "aria-valuemax": 100,
          "aria-valuetext": total > 0 ? `${pctStr}%` : shareStr,
        },
        [
          h("div", { class: "share-track" }, [
            h("div", {
              class: "share-fill",
              style: { width: `${Math.min(100, Math.max(0, pct))}%` },
            }),
          ]),
          h(
            "span",
            { class: "share-text" },
            total > 0 ? `${shareStr} (${pctStr}%)` : shareStr,
          ),
        ],
      );
    },
    meta: { class: "col-share" } satisfies ColumnMeta,
  },
  {
    id: "status",
    accessorFn: (row) => projectStatus(row),
    header: () => t("projects.col.status"),
    cell: (info) =>
      h(
        StatusBadge,
        { variant: statusVariant(info.row.original) },
        () => info.getValue() as string,
      ),
  },
  {
    id: "source",
    accessorFn: (row) =>
      row.attached_via_acct_mgr
        ? t("projects.source.manager")
        : t("projects.source.user"),
    header: () => t("projects.col.source"),
    cell: (info) => {
      const project = info.row.original;
      const isManager = project.attached_via_acct_mgr;
      return h(
        "span",
        {
          class: [
            "source-badge",
            isManager ? "source-manager" : "source-user",
          ],
          title: info.getValue() as string,
        },
        h("span", { class: "source-label" }, info.getValue() as string),
      );
    },
    meta: { class: "col-source" } satisfies ColumnMeta,
  },
];

const table = useVueTable({
  get data() {
    return store.projects;
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

const selectedProjects = computed(() =>
  store.projects.filter((p) => selectedUrls.value.has(p.master_url)),
);

const hasSelection = computed(() => selectedUrls.value.size > 0);
const singleSelected = computed(() =>
  selectedProjects.value.length === 1 ? selectedProjects.value[0] : null,
);

const allSelected = computed(() => {
  const rows = table.getRowModel().rows;
  return (
    rows.length > 0 &&
    rows.every((r) => selectedUrls.value.has(r.original.master_url))
  );
});

function handleRowClick(project: Project, index: number, event: MouseEvent) {
  ctxOpen.value = false;
  selectedViaContext.value = false;
  if (event.ctrlKey || event.metaKey) {
    const next = new Set(selectedUrls.value);
    if (next.has(project.master_url)) {
      next.delete(project.master_url);
    } else {
      next.add(project.master_url);
    }
    selectedUrls.value = next;
  } else if (event.shiftKey && lastClickedIndex.value !== null) {
    const rows = table.getRowModel().rows;
    const start = Math.min(lastClickedIndex.value, index);
    const end = Math.max(lastClickedIndex.value, index);
    const next = new Set(selectedUrls.value);
    for (let i = start; i <= end; i++) {
      next.add(rows[i].original.master_url);
    }
    selectedUrls.value = next;
  } else {
    const isOnlySelected = selectedUrls.value.size === 1 && selectedUrls.value.has(project.master_url);
    selectedUrls.value = isOnlySelected ? new Set() : new Set([project.master_url]);
  }
  lastClickedIndex.value = index;
}

function handleSelectAll(selected: boolean) {
  if (selected) {
    selectedUrls.value = new Set(
      table.getRowModel().rows.map((r) => r.original.master_url),
    );
  } else {
    selectedUrls.value = new Set();
  }
}

function isSelected(project: Project): boolean {
  return selectedUrls.value.has(project.master_url);
}

async function handleRowContext(
  event: MouseEvent,
  project: Project,
  index: number,
) {
  selectedViaContext.value = true;
  if (!selectedUrls.value.has(project.master_url)) {
    selectedUrls.value = new Set([project.master_url]);
    lastClickedIndex.value = index;
  }
  ctxOpen.value = false;
  await nextTick();
  ctxX.value = event.clientX;
  ctxY.value = event.clientY;
  ctxOpen.value = true;
}

const contextMenuItems = computed<ContextMenuItem[]>(() => {
  const items: ContextMenuItem[] = [];
  const p = singleSelected.value;
  items.push({ label: t("projects.context.update"), action: "update" });
  items.push({
    label: p?.suspended_via_gui
      ? t("projects.drawer.resume")
      : t("projects.drawer.suspend"),
    action: "suspend-resume",
  });
  items.push({
    label: p?.dont_request_more_work
      ? t("projects.drawer.allowNewTasks")
      : t("projects.drawer.noNewTasks"),
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
  items.push({
    label: t("projects.context.reset"),
    action: "reset",
    danger: true,
  });
  items.push({
    label: t("projects.context.detach"),
    action: "detach",
    danger: true,
  });
  items.push({ label: "", action: "", divider: true });
  items.push({
    label: t("projects.context.properties"),
    action: "properties",
    disabled: selectedUrls.value.size !== 1,
  });
  const filtered = items.filter((item) => !item.disabled);
  return filtered.filter(
    (item, i, arr) =>
      !item.divider ||
      (i > 0 && i < arr.length - 1 && !arr[i - 1].divider),
  );
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

onKeyStroke(["Delete", "Backspace"], (e) => {
  if (isTypingInInput(e)) return;
  if (hasSelection.value) handleDetach();
});
</script>

<template>
  <div class="projects-view" @click="selectedUrls = new Set()">
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
          :table="table"
          selectable
          reorderable
          hideable
          :all-selected="allSelected"
          :is-row-selected="isSelected"
          @row-click="handleRowClick"
          @row-contextmenu="handleRowContext"
          @select-all="handleSelectAll"
        />
      </div>

      <Transition name="drawer">
        <div v-if="hasSelection && !selectedViaContext" class="drawer-panel" @click.stop>
          <div class="drawer-header">
            <h3>
              {{
                singleSelected?.project_name ??
                $t("projects.nProjects", selectedUrls.size)
              }}
            </h3>
          </div>

          <div class="drawer-section">
            <Tooltip :text="$t('projects.tooltip.update')">
              <button class="btn icon-btn" :disabled="actionBusy" @click="handleUpdate">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
                {{ $t("projects.drawer.update") }}
              </button>
            </Tooltip>
            <Tooltip
              :text="
                singleSelected?.suspended_via_gui
                  ? $t('projects.tooltip.resume')
                  : $t('projects.tooltip.suspend')
              "
            >
              <button
                class="btn icon-btn"
                :disabled="actionBusy"
                @click="handleSuspendResume"
              >
                <svg v-if="singleSelected?.suspended_via_gui" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" /></svg>
                {{
                  singleSelected?.suspended_via_gui
                    ? $t("projects.drawer.resume")
                    : $t("projects.drawer.suspend")
                }}
              </button>
            </Tooltip>
            <Tooltip
              :text="
                singleSelected?.dont_request_more_work
                  ? $t('projects.tooltip.allowNewTasks')
                  : $t('projects.tooltip.noNewTasks')
              "
            >
              <button
                class="btn icon-btn"
                :disabled="actionBusy"
                @click="handleNoNewAllowTasks"
              >
                <svg v-if="singleSelected?.dont_request_more_work" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                {{
                  singleSelected?.dont_request_more_work
                    ? $t("projects.drawer.allowNewTasks")
                    : $t("projects.drawer.noNewTasks")
                }}
              </button>
            </Tooltip>
            <Tooltip
              v-if="selectedUrls.size === 1"
              :text="$t('projects.tooltip.properties')"
            >
              <button class="btn icon-btn" @click="openProperties">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>
                {{ $t("projects.drawer.properties") }}
              </button>
            </Tooltip>
          </div>

          <div class="drawer-section drawer-danger">
            <Tooltip :text="$t('projects.tooltip.reset')">
              <button class="btn btn-danger icon-btn" @click="handleReset">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
                {{ $t("projects.drawer.reset") }}
              </button>
            </Tooltip>
            <Tooltip :text="$t('projects.tooltip.detach')">
              <button class="btn btn-danger icon-btn" @click="handleDetach">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                {{ $t("projects.drawer.detach") }}
              </button>
            </Tooltip>
          </div>

          <div
            v-if="singleSelected?.gui_urls?.length"
            class="drawer-section drawer-links"
          >
            <div class="drawer-section-label">
              {{ $t("projects.drawer.webLinks") }}
            </div>
            <a
              v-for="(gu, i) in singleSelected.gui_urls"
              :key="gu.url"
              class="web-link"
              href="#"
              @click.prevent="openWebPage(i)"
            >
              {{ gu.name || $t("projects.drawer.webPage") }}
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

    <ItemPropertiesDialog
      :open="showProperties"
      type="project"
      :project="propertiesProject ?? undefined"
      @close="showProperties = false"
    />

    <ColumnCustomizationDialog
      :open="showColumnDialog"
      :table="table"
      @update-visibility="onColumnVisibilityChange"
      @update-order="onColumnOrderChange"
      @close="showColumnDialog = false"
    />

    <div class="fab-group">
      <Tooltip :text="$t('projects.customizeColumns')">
        <button class="fab fab-small" @click.stop="showColumnDialog = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
        </button>
      </Tooltip>
      <Tooltip :text="$t('sidebar.accountManager')">
        <button class="fab fab-small" @click.stop="openAcctMgr">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        </button>
      </Tooltip>
      <Tooltip :text="$t('sidebar.addProject')">
        <button class="fab" @click.stop="openAttachWizard">
          <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
            <path
              fill-rule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </Tooltip>
    </div>
  </div>
</template>

<style scoped>
.projects-view {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
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
  color: var(--color-accent-text);
}

.source-user {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
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

.col-share {
  min-width: 160px;
}

:deep(.share-bar) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.share-track) {
  flex: 1;
  height: 8px;
  min-width: 60px;
  background: var(--color-bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

:deep(.share-fill) {
  height: 100%;
  background: var(--color-accent);
  border-radius: 4px;
  transition: width var(--transition-normal);
}

:deep(.share-text) {
  font-family: monospace;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
  text-align: right;
  min-width: 80px;
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
  min-height: 0;
  display: flex;
  flex-direction: column;
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

.drawer-section .icon-btn {
  padding-left: 8px;
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

.fab-group {
  position: absolute;
  right: 24px;
  bottom: 24px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 12px;
}

.fab {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  border: none;
  background: var(--color-accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow:
    0 3px 5px -1px rgba(0, 0, 0, 0.2),
    0 6px 10px 0 rgba(0, 0, 0, 0.14),
    0 1px 18px 0 rgba(0, 0, 0, 0.12);
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.fab-small {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--color-bg-elevated, var(--color-bg));
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.fab:hover {
  background: var(--color-accent-hover);
  box-shadow:
    0 5px 5px -3px rgba(0, 0, 0, 0.2),
    0 8px 10px 1px rgba(0, 0, 0, 0.14),
    0 3px 14px 2px rgba(0, 0, 0, 0.12);
  transform: scale(1.05);
}

.fab-small:hover {
  background: var(--color-accent-light);
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.fab:active {
  transform: scale(0.97);
}
</style>
