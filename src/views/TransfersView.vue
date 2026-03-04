<script setup lang="ts">
import { computed, h, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useTransfersStore } from "../stores/transfers";
import type { FileTransfer } from "../types/boinc";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import DataTable from "../components/DataTable.vue";
import type { ColumnMeta } from "../components/DataTable.vue";
import EmptyState from "../components/EmptyState.vue";
import ContextMenu from "../components/ContextMenu.vue";
import type { ContextMenuItem } from "../components/ContextMenu.vue";
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
const store = useTransfersStore();
const toast = useToastStore();
const actionBusy = ref(false);

const selectedKeys = ref<Set<string>>(new Set());
const lastClickedIndex = ref<number | null>(null);
const confirmAbort = ref(false);
const allColumnKeys = [
  "file",
  "project",
  "direction",
  "progress",
  "size",
  "speed",
];
const {
  sorting,
  columnVisibility,
  columnOrder,
  onSortingChange,
  onColumnVisibilityChange,
  onColumnOrderChange,
} = useTableState("transfers", allColumnKeys, "file");
// Context menu state
const ctxOpen = ref(false);
const ctxX = ref(0);
const ctxY = ref(0);
const selectedViaContext = ref(false);

function transferKey(transfer: FileTransfer): string {
  return `${transfer.project_url}:${transfer.name}`;
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return "---";
  return `${formatSize(bytesPerSec)}/s`;
}

function transferProgress(transfer: FileTransfer): number {
  if (transfer.nbytes <= 0) return 0;
  return transfer.bytes_xferred / transfer.nbytes;
}

function transferProgressText(transfer: FileTransfer): string {
  return `${(transferProgress(transfer) * 100).toFixed(1)}%`;
}

function transferDirection(transfer: FileTransfer): string {
  return transfer.is_upload
    ? t("transfers.direction.upload")
    : t("transfers.direction.download");
}

const columns: ColumnDef<FileTransfer, unknown>[] = [
  {
    id: "file",
    accessorFn: (row) => row.name,
    header: () => t("transfers.col.file"),
    meta: { class: "col-name" } satisfies ColumnMeta,
  },
  {
    id: "project",
    accessorFn: (row) => row.project_name,
    header: () => t("transfers.col.project"),
  },
  {
    id: "direction",
    accessorFn: (row) => (row.is_upload ? "1" : "0"),
    header: () => t("transfers.col.direction"),
    cell: (info) => transferDirection(info.row.original),
  },
  {
    id: "progress",
    accessorFn: (row) => transferProgress(row),
    header: () => t("transfers.col.progress"),
    cell: (info) => {
      const transfer = info.row.original;
      const progress = transferProgress(transfer);
      return h(
        "div",
        {
          class: "progress-bar",
          role: "progressbar",
          "aria-valuenow": Math.min(
            100,
            Math.max(0, Math.round(progress * 100)),
          ),
          "aria-valuemin": 0,
          "aria-valuemax": 100,
          "aria-label": transfer.project_name,
          "aria-valuetext": transferProgressText(transfer),
        },
        [
          h("div", {
            class: "progress-fill",
            style: { width: transferProgressText(transfer) },
          }),
          h(
            "span",
            { class: "progress-text" },
            transferProgressText(transfer),
          ),
        ],
      );
    },
    meta: { class: "col-progress" } satisfies ColumnMeta,
  },
  {
    id: "size",
    accessorFn: (row) => row.nbytes,
    header: () => t("transfers.col.size"),
    cell: (info) => formatSize(info.getValue() as number),
    meta: { align: "right", class: "col-number" } satisfies ColumnMeta,
  },
  {
    id: "speed",
    accessorFn: (row) => row.xfer_speed,
    header: () => t("transfers.col.speed"),
    cell: (info) => formatSpeed(info.getValue() as number),
    meta: { align: "right", class: "col-number" } satisfies ColumnMeta,
  },
];

const table = useVueTable({
  get data() {
    return store.transfers;
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

const selectedTransfers = computed(() =>
  store.transfers.filter((t) => selectedKeys.value.has(transferKey(t))),
);

const hasSelection = computed(() => selectedKeys.value.size > 0);

const singleSelectedTransfer = computed(() =>
  selectedTransfers.value.length === 1 ? selectedTransfers.value[0] : null,
);

const allSelected = computed(() => {
  const rows = table.getRowModel().rows;
  return (
    rows.length > 0 &&
    rows.every((r) => selectedKeys.value.has(transferKey(r.original)))
  );
});

function handleRowClick(
  transfer: FileTransfer,
  index: number,
  event: MouseEvent,
) {
  selectedViaContext.value = false;
  const key = transferKey(transfer);
  if (event.ctrlKey || event.metaKey) {
    const next = new Set(selectedKeys.value);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    selectedKeys.value = next;
  } else if (event.shiftKey && lastClickedIndex.value !== null) {
    const rows = table.getRowModel().rows;
    const start = Math.min(lastClickedIndex.value, index);
    const end = Math.max(lastClickedIndex.value, index);
    const next = new Set(selectedKeys.value);
    for (let i = start; i <= end; i++) {
      next.add(transferKey(rows[i].original));
    }
    selectedKeys.value = next;
  } else {
    selectedKeys.value = new Set([key]);
  }
  lastClickedIndex.value = index;
}

function handleSelectAll(selected: boolean) {
  if (selected) {
    selectedKeys.value = new Set(
      table.getRowModel().rows.map((r) => transferKey(r.original)),
    );
  } else {
    selectedKeys.value = new Set();
  }
}

function isSelected(transfer: FileTransfer): boolean {
  return selectedKeys.value.has(transferKey(transfer));
}

function handleRowContext(
  event: MouseEvent,
  transfer: FileTransfer,
  index: number,
) {
  selectedViaContext.value = true;
  const key = transferKey(transfer);
  if (!selectedKeys.value.has(key)) {
    selectedKeys.value = new Set([key]);
    lastClickedIndex.value = index;
  }
  ctxX.value = event.clientX;
  ctxY.value = event.clientY;
  ctxOpen.value = true;
}

const contextMenuItems = computed<ContextMenuItem[]>(() => [
  { label: t("transfers.retry"), action: "retry" },
  { label: "", action: "", divider: true },
  { label: t("transfers.abort"), action: "abort", danger: true },
]);

async function handleContextAction(action: string) {
  switch (action) {
    case "retry":
      await handleRetry();
      break;
    case "abort":
      confirmAbort.value = true;
      break;
  }
}

async function handleRetry() {
  actionBusy.value = true;
  try {
    for (const t of selectedTransfers.value) {
      await store.retryTransfer(t.project_url, t.name);
    }
    toast.show(t("transfers.toast.retryRequested"), "success");
  } catch (e) {
    toast.show(t("transfers.toast.retryFailed", { error: String(e) }), "error");
  } finally {
    actionBusy.value = false;
  }
}

async function doAbort() {
  actionBusy.value = true;
  try {
    for (const t of selectedTransfers.value) {
      await store.abortTransfer(t.project_url, t.name);
    }
    toast.show(t("transfers.toast.aborted"), "success");
  } catch (e) {
    toast.show(t("transfers.toast.abortFailed", { error: String(e) }), "error");
  } finally {
    actionBusy.value = false;
    selectedKeys.value = new Set();
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
  selectedKeys.value = new Set();
});

onKeyStroke(["Delete", "Backspace"], (e) => {
  if (isTypingInInput(e)) return;
  if (hasSelection.value) confirmAbort.value = true;
});
</script>

<template>
  <div class="transfers-view">
    <p v-if="store.error" class="error">{{ store.error }}</p>

    <EmptyState
      v-else-if="store.loading && store.transfers.length === 0"
      icon="&#8987;"
      :message="$t('transfers.loading')"
    />

    <EmptyState
      v-else-if="store.transfers.length === 0"
      icon="&#128259;"
      :message="$t('transfers.empty')"
    />

    <div v-else class="content-row">
      <div class="content-main">
        <DataTable
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
        <div v-if="hasSelection && !selectedViaContext" class="drawer-panel">
          <div class="drawer-header">
            <h3>
              {{
                singleSelectedTransfer?.name ??
                $t("transfers.nTransfers", selectedKeys.size)
              }}
            </h3>
          </div>

          <div class="drawer-section">
            <Tooltip :text="$t('transfers.tooltip.retry')">
              <button class="btn" :disabled="actionBusy" @click="handleRetry">
                {{ $t("transfers.retry") }}
              </button>
            </Tooltip>
          </div>

          <div class="drawer-section drawer-danger">
            <Tooltip :text="$t('transfers.tooltip.abort')">
              <button
                class="btn btn-danger"
                :disabled="actionBusy"
                @click="confirmAbort = true"
              >
                {{ $t("transfers.abort") }}
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
      :title="$t('transfers.abortDialog.title')"
      :message="$t('transfers.abortDialog.message', selectedKeys.size)"
      :confirm-label="$t('transfers.abortDialog.confirm')"
      @confirm="doAbort"
      @cancel="confirmAbort = false"
    />

  </div>
</template>

<style scoped>
.transfers-view {
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

.col-number {
  font-family: monospace;
  text-align: right;
  white-space: nowrap;
}

.col-progress {
  width: 120px;
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
