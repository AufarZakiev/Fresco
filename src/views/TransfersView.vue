<script setup lang="ts">
import { computed, ref } from "vue";
import { useTransfersStore } from "../stores/transfers";
import type { FileTransfer, SortDir } from "../types/boinc";
import { SORT_DIR } from "../types/boinc";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import PageHeader from "../components/PageHeader.vue";
import DataTable from "../components/DataTable.vue";
import type { DataTableColumn } from "../components/DataTable.vue";
import EmptyState from "../components/EmptyState.vue";
import ContextMenu from "../components/ContextMenu.vue";
import type { ContextMenuItem } from "../components/ContextMenu.vue";
import ColumnCustomizationDialog from "../components/ColumnCustomizationDialog.vue";
import Tooltip from "../components/Tooltip.vue";
import { useKeyboard } from "../composables/useKeyboard";
import { useColumnState } from "../composables/useColumnState";
import { useToastStore } from "../stores/toast";

const store = useTransfersStore();
const toast = useToastStore();
const actionBusy = ref(false);

const selectedKeys = ref<Set<string>>(new Set());
const lastClickedIndex = ref<number | null>(null);
const confirmAbort = ref(false);
const { sortKey, sortDir, visibleKeys } = useColumnState(
  "transfers",
  ["file", "project", "direction", "progress", "size", "speed"],
  "file",
  SORT_DIR.ASC,
);
const showColumns = ref(false);

// Context menu state
const ctxOpen = ref(false);
const ctxX = ref(0);
const ctxY = ref(0);

const allColumns: DataTableColumn[] = [
  { key: "file", label: "File", sortable: true },
  { key: "project", label: "Project", sortable: true },
  { key: "direction", label: "Direction", sortable: true },
  { key: "progress", label: "Progress", sortable: true },
  { key: "size", label: "Size", sortable: true, align: "right" },
  { key: "speed", label: "Speed", sortable: true, align: "right" },
];

const columns = computed(() =>
  allColumns.map((c) => ({ ...c, visible: visibleKeys.value.includes(c.key) })),
);

function transferKey(t: FileTransfer): string {
  return `${t.project_url}:${t.name}`;
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return "---";
  return `${formatSize(bytesPerSec)}/s`;
}

function transferProgress(t: FileTransfer): number {
  if (t.nbytes <= 0) return 0;
  return t.bytes_xferred / t.nbytes;
}

function transferProgressText(t: FileTransfer): string {
  return `${(transferProgress(t) * 100).toFixed(1)}%`;
}

function transferDirection(t: FileTransfer): string {
  return t.is_upload ? "Upload" : "Download";
}

function getSortValue(t: FileTransfer, key: string): number | string {
  switch (key) {
    case "file": return t.name;
    case "project": return t.project_name;
    case "direction": return t.is_upload ? "Upload" : "Download";
    case "progress": return transferProgress(t);
    case "size": return t.nbytes;
    case "speed": return t.xfer_speed;
    default: return 0;
  }
}

const sortedTransfers = computed(() => {
  const transfers = [...store.transfers];
  const key = sortKey.value;
  const dir = sortDir.value === SORT_DIR.ASC ? 1 : -1;
  return transfers.sort((a, b) => {
    const va = getSortValue(a, key);
    const vb = getSortValue(b, key);
    if (typeof va === "string" && typeof vb === "string") {
      return dir * va.localeCompare(vb);
    }
    return dir * ((va as number) - (vb as number));
  });
});

const selectedTransfers = computed(() =>
  store.transfers.filter((t) => selectedKeys.value.has(transferKey(t))),
);

const hasSelection = computed(() => selectedKeys.value.size > 0);

const allSelected = computed(() =>
  sortedTransfers.value.length > 0 &&
  sortedTransfers.value.every((t) => selectedKeys.value.has(transferKey(t))),
);

function handleRowClick(transfer: FileTransfer, index: number, event: MouseEvent) {
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
    const start = Math.min(lastClickedIndex.value, index);
    const end = Math.max(lastClickedIndex.value, index);
    const next = new Set(selectedKeys.value);
    for (let i = start; i <= end; i++) {
      next.add(transferKey(sortedTransfers.value[i]));
    }
    selectedKeys.value = next;
  } else {
    selectedKeys.value = new Set([key]);
  }
  lastClickedIndex.value = index;
}

function handleSelectAll(selected: boolean) {
  if (selected) {
    selectedKeys.value = new Set(sortedTransfers.value.map(transferKey));
  } else {
    selectedKeys.value = new Set();
  }
}

function isSelected(transfer: FileTransfer): boolean {
  return selectedKeys.value.has(transferKey(transfer));
}

function handleSort(key: string, dir: SortDir) {
  sortKey.value = key;
  sortDir.value = dir;
}

function handleRowContext(event: MouseEvent, transfer: FileTransfer, index: number) {
  event.preventDefault();
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
  { label: "Retry", action: "retry" },
  { label: "", action: "", divider: true },
  { label: "Abort", action: "abort", danger: true },
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
    toast.show("Transfer retry requested", "success");
  } catch (e) {
    toast.show(`Retry failed: ${e}`, "error");
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
    toast.show("Transfer aborted", "success");
  } catch (e) {
    toast.show(`Abort failed: ${e}`, "error");
  } finally {
    actionBusy.value = false;
    selectedKeys.value = new Set();
    confirmAbort.value = false;
  }
}

useKeyboard({
  onSelectAll: () => handleSelectAll(true),
  onDeselect: () => { selectedKeys.value = new Set(); },
  onDelete: () => {
    if (hasSelection.value) confirmAbort.value = true;
  },
});

function isColVisible(key: string): boolean {
  return visibleKeys.value.includes(key);
}
</script>

<template>
  <div class="transfers-view">
    <PageHeader title="Transfers">
      <template v-if="hasSelection">
        <button class="btn" :disabled="actionBusy" @click="handleRetry">Retry</button>
        <button class="btn btn-danger" :disabled="actionBusy" @click="confirmAbort = true">Abort</button>
      </template>
      <Tooltip text="Columns">
        <button class="btn btn-icon" @click="showColumns = true">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
          </svg>
        </button>
      </Tooltip>
    </PageHeader>

    <p v-if="store.error" class="error">{{ store.error }}</p>

    <EmptyState
      v-else-if="store.loading && store.transfers.length === 0"
      icon="&#8987;"
      message="Loading transfers..."
    />

    <EmptyState
      v-else-if="store.transfers.length === 0"
      icon="&#128259;"
      message="No active file transfers."
    />

    <DataTable
      v-if="store.transfers.length > 0"
      :columns="columns"
      :sort-key="sortKey"
      :sort-dir="sortDir"
      selectable
      :all-selected="allSelected"
      @sort="handleSort"
      @select-all="handleSelectAll"
    >
      <tr
        v-for="(transfer, index) in sortedTransfers"
        :key="transferKey(transfer)"
        :class="{ 'row-selected': isSelected(transfer) }"
        @click="handleRowClick(transfer, index, $event)"
        @contextmenu="handleRowContext($event, transfer, index)"
      >
        <td class="col-checkbox">
          <input
            type="checkbox"
            :checked="isSelected(transfer)"
            @click.stop
            @change="handleRowClick(transfer, index, { ctrlKey: true } as MouseEvent)"
          />
        </td>
        <td v-if="isColVisible('file')" class="col-name" :title="transfer.name">{{ transfer.name }}</td>
        <td v-if="isColVisible('project')">{{ transfer.project_name }}</td>
        <td v-if="isColVisible('direction')">{{ transferDirection(transfer) }}</td>
        <td v-if="isColVisible('progress')" class="col-progress">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: transferProgressText(transfer) }"
            ></div>
            <span class="progress-text">{{ transferProgressText(transfer) }}</span>
          </div>
        </td>
        <td v-if="isColVisible('size')" class="col-number">{{ formatSize(transfer.nbytes) }}</td>
        <td v-if="isColVisible('speed')" class="col-number">{{ formatSpeed(transfer.xfer_speed) }}</td>
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
      title="Abort Transfer"
      :message="`Abort ${selectedKeys.size} selected transfer(s)?`"
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
  </div>
</template>

<style scoped>
.transfers-view {
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

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  min-width: 32px;
}
</style>
