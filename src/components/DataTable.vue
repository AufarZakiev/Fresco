<script setup lang="ts" generic="T">
import { ref, computed, onUnmounted } from "vue";
import { FlexRender } from "@tanstack/vue-table";
import type { Table, Header } from "@tanstack/vue-table";
import Tooltip from "./Tooltip.vue";

export interface ColumnMeta {
  align?: "left" | "right" | "center";
  class?: string;
}

const props = defineProps<{
  table: Table<T>;
  selectable?: boolean;
  allSelected?: boolean;
  isRowSelected?: (row: T) => boolean;
  rowClass?: (row: T) => string;
  reorderable?: boolean;
  hideable?: boolean;
}>();

const emit = defineEmits<{
  "row-click": [original: T, index: number, event: MouseEvent];
  "row-contextmenu": [event: MouseEvent, original: T, index: number];
  "row-dblclick": [original: T];
  "select-all": [selected: boolean];
}>();

const isReorderable = computed(() =>
  props.reorderable ?? !!props.table.options.onColumnOrderChange,
);

const isHideable = computed(() =>
  props.hideable ?? !!props.table.options.onColumnVisibilityChange,
);

function canHideColumn(header: Header<T, unknown>): boolean {
  if (!isHideable.value) return false;
  const visibleCount = props.table.getVisibleLeafColumns().length;
  return visibleCount > 1 && header.column.getCanHide();
}

function hideColumn(event: MouseEvent, header: Header<T, unknown>) {
  event.stopPropagation();
  header.column.toggleVisibility(false);
}

// --- Drag state ---
const DRAG_THRESHOLD = 5;
const draggedColIndex = ref<number | null>(null);
const dragDeltaX = ref(0);
const pointerStartX = ref(0);
const isDragging = ref(false);
const headerWidths = ref<number[]>([]);

function onHeaderPointerDown(event: PointerEvent, headerIndex: number, headers: Header<T, unknown>[]) {
  if (!isReorderable.value || headers.length <= 1) return;

  const th = event.currentTarget as HTMLElement;
  th.setPointerCapture(event.pointerId);

  pointerStartX.value = event.clientX;
  draggedColIndex.value = headerIndex;
  dragDeltaX.value = 0;
  isDragging.value = false;

  // Measure all draggable header widths
  const row = th.parentElement!;
  const ths = Array.from(row.querySelectorAll<HTMLElement>("th:not(.col-checkbox)"));
  headerWidths.value = ths.map((el) => el.offsetWidth);

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
}

function onPointerMove(event: PointerEvent) {
  if (draggedColIndex.value === null) return;

  const deltaX = event.clientX - pointerStartX.value;

  if (!isDragging.value && Math.abs(deltaX) < DRAG_THRESHOLD) return;
  isDragging.value = true;
  dragDeltaX.value = deltaX;

  const idx = draggedColIndex.value;

  // Check if crossed midpoint of adjacent header to the right
  if (deltaX > 0 && idx < headerWidths.value.length - 1) {
    const threshold = headerWidths.value[idx + 1] / 2;
    if (deltaX > threshold) {
      performSwap(idx, idx + 1);
    }
  }
  // Check if crossed midpoint of adjacent header to the left
  if (deltaX < 0 && idx > 0) {
    const threshold = headerWidths.value[idx - 1] / 2;
    if (-deltaX > threshold) {
      performSwap(idx, idx - 1);
    }
  }
}

function performSwap(fromIdx: number, toIdx: number) {
  const headers = props.table.getHeaderGroups()[0].headers;
  const visibleIds = headers.map((h) => h.column.id);

  // Build full column order: start from current state or fallback to all leaf columns
  const currentOrder = props.table.getState().columnOrder.length > 0
    ? [...props.table.getState().columnOrder]
    : props.table.getAllLeafColumns().map((c) => c.id);

  const fromId = visibleIds[fromIdx];
  const toId = visibleIds[toIdx];
  const fullFromIdx = currentOrder.indexOf(fromId);
  const fullToIdx = currentOrder.indexOf(toId);

  if (fullFromIdx === -1 || fullToIdx === -1) return;

  // Swap in the full order
  [currentOrder[fullFromIdx], currentOrder[fullToIdx]] = [currentOrder[fullToIdx], currentOrder[fullFromIdx]];
  props.table.setColumnOrder(currentOrder);

  // Swap widths tracker
  [headerWidths.value[fromIdx], headerWidths.value[toIdx]] = [headerWidths.value[toIdx], headerWidths.value[fromIdx]];

  // Adjust baseline so drag feels continuous
  const swappedWidth = fromIdx < toIdx ? headerWidths.value[fromIdx] : -headerWidths.value[toIdx];
  pointerStartX.value += swappedWidth;
  dragDeltaX.value -= swappedWidth;
  draggedColIndex.value = toIdx;
}

function cleanupDrag() {
  draggedColIndex.value = null;
  dragDeltaX.value = 0;
  isDragging.value = false;
  headerWidths.value = [];
  document.removeEventListener("pointermove", onPointerMove);
  document.removeEventListener("pointerup", onPointerUp);
}

function onPointerUp() {
  if (isDragging.value) {
    // Defer reset so click handler still sees isDragging = true and skips sort
    requestAnimationFrame(() => cleanupDrag());
  } else {
    cleanupDrag();
  }
}

onUnmounted(cleanupDrag);

function onHeaderClick(event: MouseEvent, header: Header<T, unknown>) {
  if (isDragging.value) return;
  header.column.getToggleSortingHandler()?.(event);
}

function getHeaderDragStyle(index: number): Record<string, string> {
  if (!isDragging.value) return {};
  if (draggedColIndex.value === index) {
    return {
      transform: `translateX(${dragDeltaX.value}px) scale(1.02)`,
      zIndex: "10",
      boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
      opacity: "0.9",
    };
  }
  return { transition: "transform 0.25s cubic-bezier(0.2, 0, 0, 1)" };
}

// --- Existing helpers ---

function getAlign(header: Header<T, unknown>): string {
  return (header.column.columnDef.meta as ColumnMeta | undefined)?.align ?? "left";
}

function getCellClass(meta: ColumnMeta | undefined): string {
  return meta?.class ?? "";
}

function getCellAlign(meta: ColumnMeta | undefined): string {
  return meta?.align ? `align-${meta.align}` : "";
}

function ariaSort(header: Header<T, unknown>): "ascending" | "descending" | "none" | "other" | undefined {
  if (!header.column.getCanSort()) return undefined;
  const sorted = header.column.getIsSorted();
  if (sorted === "asc") return "ascending";
  if (sorted === "desc") return "descending";
  return "none";
}
</script>

<template>
  <div class="data-table-wrapper">
    <table class="data-table">
      <thead>
        <tr
          v-for="headerGroup in table.getHeaderGroups()"
          :key="headerGroup.id"
        >
          <th v-if="selectable" scope="col" class="col-checkbox">
            <input
              type="checkbox"
              :checked="allSelected"
              @change="
                emit('select-all', ($event.target as HTMLInputElement).checked)
              "
            />
          </th>
          <th
            v-for="(header, headerIndex) in headerGroup.headers"
            :key="header.id"
            scope="col"
            :class="[
              `align-${getAlign(header)}`,
              {
                sortable: header.column.getCanSort(),
                sorted: header.column.getIsSorted(),
                reorderable: isReorderable,
                dragging: isReorderable && isDragging && draggedColIndex === headerIndex,
              },
            ]"
            :style="isReorderable ? getHeaderDragStyle(headerIndex) : undefined"
            :aria-sort="ariaSort(header)"
            @pointerdown="isReorderable ? onHeaderPointerDown($event, headerIndex, headerGroup.headers) : undefined"
            @click="onHeaderClick($event, header)"
          >
            <FlexRender
              v-if="!header.isPlaceholder"
              :render="header.column.columnDef.header"
              :props="header.getContext()"
            />
            <svg
              v-if="header.column.getIsSorted()"
              class="sort-indicator"
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <template v-if="header.column.getIsSorted() === 'asc'">
                <rect x="0" y="10" width="3" height="6" />
                <rect x="5" y="6" width="3" height="10" />
                <rect x="10" y="2" width="3" height="14" />
              </template>
              <template v-else>
                <rect x="0" y="2" width="3" height="14" />
                <rect x="5" y="6" width="3" height="10" />
                <rect x="10" y="10" width="3" height="6" />
              </template>
            </svg>
            <Tooltip v-if="canHideColumn(header)" :text="$t('table.hideColumn')" placement="bottom">
              <svg
                class="col-hide-btn"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                @click="hideColumn($event, header)"
                @pointerdown.stop
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            </Tooltip>
            <Tooltip v-if="isReorderable" :text="$t('table.reorderColumn')" placement="bottom">
              <svg
                class="drag-handle"
                width="8"
                height="12"
                viewBox="0 0 10 14"
                fill="currentColor"
              >
                <circle cx="2.5" cy="2" r="1.5" />
                <circle cx="7.5" cy="2" r="1.5" />
                <circle cx="2.5" cy="7" r="1.5" />
                <circle cx="7.5" cy="7" r="1.5" />
                <circle cx="2.5" cy="12" r="1.5" />
                <circle cx="7.5" cy="12" r="1.5" />
              </svg>
            </Tooltip>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in table.getRowModel().rows"
          :key="row.id"
          :class="[
            rowClass?.(row.original),
            { 'row-selected': isRowSelected?.(row.original) },
          ]"
          @click="emit('row-click', row.original, index, $event)"
          @contextmenu.prevent="
            emit('row-contextmenu', $event, row.original, index)
          "
          @dblclick="emit('row-dblclick', row.original)"
        >
          <td v-if="selectable" class="col-checkbox">
            <input
              type="checkbox"
              :checked="isRowSelected?.(row.original)"
              @click.stop
              @change="
                emit('row-click', row.original, index, {
                  ctrlKey: true,
                } as MouseEvent)
              "
            />
          </td>
          <td
            v-for="cell in row.getVisibleCells()"
            :key="cell.id"
            :class="[
              getCellClass(cell.column.columnDef.meta as ColumnMeta | undefined),
              getCellAlign(cell.column.columnDef.meta as ColumnMeta | undefined),
            ]"
          >
            <FlexRender
              :render="cell.column.columnDef.cell"
              :props="cell.getContext()"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.data-table-wrapper {
  overflow: auto;
  flex: 1;
  min-height: 0;
}

.data-table {
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--font-size-md);
}

.data-table th {
  text-align: left;
  padding: 10px 12px;
  font-weight: 500;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
  user-select: none;
  position: sticky;
  top: 0;
  z-index: 2;
}

.data-table th.reorderable {
  touch-action: none;
  padding-right: 44px;
}

.data-table th.dragging {
  cursor: grabbing;
  position: relative;
}

.col-hide-btn {
  opacity: 0;
  position: absolute;
  right: 22px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: opacity 0.15s, color 0.15s;
}

.data-table th:hover .col-hide-btn {
  opacity: 1;
}

.col-hide-btn:hover {
  color: var(--color-danger);
}

.drag-handle {
  opacity: 0;
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-tertiary);
  cursor: grab;
  transition: opacity 0.15s;
}

.data-table th.dragging .drag-handle {
  cursor: grabbing;
}

.data-table th.reorderable:hover .drag-handle,
.data-table th.dragging .drag-handle {
  opacity: 1;
}

.data-table th.sortable:not(.reorderable) {
  cursor: pointer;
}

.data-table th.sortable:hover {
  color: var(--color-text-primary);
}

.data-table th.sorted {
  color: var(--color-accent);
}

.sort-indicator {
  margin-left: 10px;
  position: relative;
  top: 1px;
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

.data-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-light);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.data-table tbody tr {
  cursor: pointer;
  transition: background var(--transition-fast);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-table tbody tr:hover {
  background: var(--color-bg-secondary);
}

.data-table tbody tr.row-selected {
  background: var(--color-accent-light);
}

.align-right {
  text-align: right;
}

.align-center {
  text-align: center;
}
</style>
