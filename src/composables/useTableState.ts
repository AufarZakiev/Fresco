import { ref, watch } from "vue";
import { useLocalStorage } from "@vueuse/core";
import type { SortingState, VisibilityState, Updater } from "@tanstack/vue-table";

interface OldColumnState {
  visibleKeys?: string[];
  sortKey?: string;
  sortDir?: "asc" | "desc";
  columnOrder?: string[];
}

interface TableState {
  sorting: SortingState;
  columnVisibility: VisibilityState;
  columnOrder: string[];
}

function isOldFormat(parsed: Record<string, unknown>): boolean {
  return "visibleKeys" in parsed || "sortKey" in parsed;
}

function migrateOldState(
  old: OldColumnState,
  allColumnIds: string[],
): TableState {
  const sorting: SortingState = old.sortKey
    ? [{ id: old.sortKey, desc: old.sortDir === "desc" }]
    : [];

  const visibleSet = new Set(old.visibleKeys ?? allColumnIds);
  const columnVisibility: VisibilityState = {};
  for (const id of allColumnIds) {
    columnVisibility[id] = visibleSet.has(id);
  }

  const storedOrder = old.columnOrder ?? allColumnIds;
  const allowedKeys = new Set(allColumnIds);
  const columnOrder = [
    ...storedOrder.filter((key) => allowedKeys.has(key)),
    ...allColumnIds.filter((key) => !storedOrder.includes(key)),
  ];

  return { sorting, columnVisibility, columnOrder };
}

/**
 * Manages TanStack table state (sorting, column visibility, column order)
 * with localStorage persistence. Backward-compatible with old useColumnState format.
 *
 * @param viewId - unique identifier for the view (e.g. "tasks", "projects")
 * @param allColumnIds - all column IDs in default order
 * @param defaultSortId - default sort column ID
 * @param defaultSortDesc - default sort direction (true = descending)
 */
export function useTableState(
  viewId: string,
  allColumnIds: string[],
  defaultSortId: string,
  defaultSortDesc = false,
) {
  const storageKey = `boinc-columns-${viewId}`;

  const defaultVisibility: VisibilityState = {};
  for (const id of allColumnIds) {
    defaultVisibility[id] = true;
  }

  const defaultState: TableState = {
    sorting: [{ id: defaultSortId, desc: defaultSortDesc }],
    columnVisibility: defaultVisibility,
    columnOrder: [...allColumnIds],
  };

  const stored = useLocalStorage<TableState>(storageKey, defaultState, {
    mergeDefaults: true,
    flush: "sync",
  });

  // Migrate old format if needed
  if (isOldFormat(stored.value as unknown as Record<string, unknown>)) {
    stored.value = migrateOldState(
      stored.value as unknown as OldColumnState,
      allColumnIds,
    );
  }

  // Normalize: ensure all current column IDs are present, remove stale ones
  const allowedIdSet = new Set(allColumnIds);
  for (const id of Object.keys(stored.value.columnVisibility)) {
    if (!allowedIdSet.has(id)) {
      delete stored.value.columnVisibility[id];
    }
  }
  for (const id of allColumnIds) {
    if (stored.value.columnVisibility[id] === undefined) {
      stored.value.columnVisibility[id] = true;
    }
  }

  const currentOrder = stored.value.columnOrder ?? allColumnIds;
  stored.value.columnOrder = [
    ...currentOrder.filter((key) => allowedIdSet.has(key)),
    ...allColumnIds.filter((key) => !currentOrder.includes(key)),
  ];

  // Expose individual refs for TanStack table compatibility
  const sorting = ref<SortingState>(stored.value.sorting);
  const columnVisibility = ref<VisibilityState>(stored.value.columnVisibility);
  const columnOrder = ref<string[]>(stored.value.columnOrder);

  watch(
    [sorting, columnVisibility, columnOrder],
    () => {
      stored.value = {
        sorting: sorting.value,
        columnVisibility: columnVisibility.value,
        columnOrder: columnOrder.value,
      };
    },
    { deep: true },
  );

  function onSortingChange(updater: Updater<SortingState>) {
    sorting.value =
      typeof updater === "function" ? updater(sorting.value) : updater;
  }

  function onColumnVisibilityChange(updater: Updater<VisibilityState>) {
    columnVisibility.value =
      typeof updater === "function"
        ? updater(columnVisibility.value)
        : updater;
  }

  function onColumnOrderChange(updater: Updater<string[]>) {
    columnOrder.value =
      typeof updater === "function" ? updater(columnOrder.value) : updater;
  }

  return {
    sorting,
    columnVisibility,
    columnOrder,
    onSortingChange,
    onColumnVisibilityChange,
    onColumnOrderChange,
  };
}
