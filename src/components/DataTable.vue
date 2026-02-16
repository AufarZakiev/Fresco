<script setup lang="ts">
import { computed } from "vue";
import { SORT_DIR } from "../types/boinc";
import type { SortDir } from "../types/boinc";

export interface DataTableColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  visible?: boolean;
}

const props = defineProps<{
  columns: DataTableColumn[];
  emptyMessage?: string;
  sortKey?: string;
  sortDir?: SortDir;
  selectable?: boolean;
  allSelected?: boolean;
}>();

const emit = defineEmits<{
  sort: [key: string, dir: SortDir];
  contextmenu: [event: MouseEvent, index: number];
  "select-all": [selected: boolean];
}>();

const visibleColumns = computed(() =>
  props.columns.filter((c) => c.visible !== false),
);

function handleHeaderClick(col: DataTableColumn) {
  if (!col.sortable) return;
  const newDir =
    props.sortKey === col.key && props.sortDir === SORT_DIR.ASC ? SORT_DIR.DESC : SORT_DIR.ASC;
  emit("sort", col.key, newDir);
}

function handleContextMenu(event: MouseEvent, index: number) {
  event.preventDefault();
  emit("contextmenu", event, index);
}
</script>

<template>
  <div class="data-table-wrapper">
    <table class="data-table">
      <thead>
        <tr>
          <th v-if="selectable" class="col-checkbox">
            <input
              type="checkbox"
              :checked="allSelected"
              @change="emit('select-all', ($event.target as HTMLInputElement).checked)"
            />
          </th>
          <th
            v-for="col in visibleColumns"
            :key="col.key"
            :class="[
              `align-${col.align ?? 'left'}`,
              { sortable: col.sortable, sorted: sortKey === col.key },
            ]"
            @click="handleHeaderClick(col)"
          >
            {{ col.label }}
            <span v-if="col.sortable && sortKey === col.key" class="sort-indicator">
              {{ sortDir === SORT_DIR.ASC ? "\u25B2" : "\u25BC" }}
            </span>
          </th>
        </tr>
      </thead>
      <tbody @contextmenu="handleContextMenu($event, -1)">
        <slot />
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.data-table-wrapper {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: auto;
  max-height: calc(100vh - 200px);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
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

.data-table th.sortable {
  cursor: pointer;
}

.data-table th.sortable:hover {
  color: var(--color-text-primary);
}

.data-table th.sorted {
  color: var(--color-accent);
}

.sort-indicator {
  font-size: 9px;
  margin-left: 4px;
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

.data-table :deep(td) {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-light);
}

.data-table :deep(tbody tr) {
  cursor: pointer;
  transition: background var(--transition-fast);
}

.data-table :deep(tbody tr:last-child td) {
  border-bottom: none;
}

.data-table :deep(tbody tr:hover) {
  background: var(--color-bg-secondary);
}

.data-table :deep(tbody tr.row-selected) {
  background: var(--color-accent-light);
}

.align-right {
  text-align: right;
}

.align-center {
  text-align: center;
}
</style>
