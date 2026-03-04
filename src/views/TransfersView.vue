<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
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
import { onKeyStroke } from "@vueuse/core";
import { useColumnState } from "../composables/useColumnState";
import { useToastStore } from "../stores/toast";

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
const { sortKey, sortDir, visibleKeys, columnOrder, orderedVisibleKeys } =
  useColumnState(
    "transfers",
    ["file", "project", "direction", "progress", "size", "speed"],
    "file",
    SORT_DIR.ASC,
    allColumnKeys,
  );
const showColumns = ref(false);

// Context menu state
const ctxOpen = ref(false);
const ctxX = ref(0);
const ctxY = ref(0);

const allColumns = computed<DataTableColumn[]>(() => [
  { key: "file", label: t("transfers.col.file"), sortable: true },
  { key: "project", label: t("transfers.col.project"), sortable: true },
  { key: "direction", label: t("transfers.col.direction"), sortable: true },
  { key: "progress", label: t("transfers.col.progress"), sortable: true },
  {
    key: "size",
    label: t("transfers.col.size"),
    sortable: true,
    align: "right",
  },
  {
    key: "speed",
    label: t("transfers.col.speed"),
    sortable: true,
    align: "right",
  },
]);

const columns = computed(() =>
  allColumns.value.map((c) => ({
    ...c,
    visible: visibleKeys.value.includes(c.key),
  })),
);

function handleUpdateOrder(order: string[]) {
  columnOrder.value = order;
}

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

function getSortValue(transfer: FileTransfer, key: string): number | string {
  switch (key) {
    case "file":
      return transfer.name;
    case "project":
      return transfer.project_name;
    case "direction":
      return transfer.is_upload ? "1" : "0";
    case "progress":
      return transferProgress(transfer);
    case "size":
      return transfer.nbytes;
    case "speed":
      return transfer.xfer_speed;
    default:
      return 0;
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

const singleSelectedTransfer = computed(() =>
  selectedTransfers.value.length === 1 ? selectedTransfers.value[0] : null,
);

const allSelected = computed(
  () =>
    sortedTransfers.value.length > 0 &&
    sortedTransfers.value.every((t) => selectedKeys.value.has(transferKey(t))),
);

function handleRowClick(
  transfer: FileTransfer,
  index: number,
  event: MouseEvent,
) {
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

function handleRowContext(
  event: MouseEvent,
  transfer: FileTransfer,
  index: number,
) {
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
    <PageHeader>
      <Tooltip :text="$t('transfers.columns')">
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
          :columns="columns"
          :column-order="columnOrder"
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
                @change="
                  handleRowClick(transfer, index, {
                    ctrlKey: true,
                  } as MouseEvent)
                "
              />
            </td>
            <template v-for="colKey in orderedVisibleKeys" :key="colKey">
              <td
                v-if="colKey === 'file'"
                class="col-name"
                :title="transfer.name"
              >
                {{ transfer.name }}
              </td>
              <td v-else-if="colKey === 'project'">
                {{ transfer.project_name }}
              </td>
              <td v-else-if="colKey === 'direction'">
                {{ transferDirection(transfer) }}
              </td>
              <td v-else-if="colKey === 'progress'" class="col-progress">
                <div
                  class="progress-bar"
                  role="progressbar"
                  :aria-valuenow="
                    Math.min(
                      100,
                      Math.max(0, Math.round(transferProgress(transfer) * 100)),
                    )
                  "
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-label="transfer.project_name"
                  :aria-valuetext="transferProgressText(transfer)"
                >
                  <div
                    class="progress-fill"
                    :style="{ width: transferProgressText(transfer) }"
                  ></div>
                  <span class="progress-text">{{
                    transferProgressText(transfer)
                  }}</span>
                </div>
              </td>
              <td v-else-if="colKey === 'size'" class="col-number">
                {{ formatSize(transfer.nbytes) }}
              </td>
              <td v-else-if="colKey === 'speed'" class="col-number">
                {{ formatSpeed(transfer.xfer_speed) }}
              </td>
            </template>
          </tr>
        </DataTable>
      </div>

      <Transition name="drawer">
        <div v-if="hasSelection" class="drawer-panel">
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

    <ColumnCustomizationDialog
      :open="showColumns"
      :columns="allColumns"
      :visible-keys="visibleKeys"
      :column-order="columnOrder"
      @update="visibleKeys = $event"
      @update-order="handleUpdateOrder"
      @close="showColumns = false"
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
