import { ref, watch } from "vue";
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

  function loadState(): TableState {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);

        if (isOldFormat(parsed)) {
          const migrated = migrateOldState(parsed as OldColumnState, allColumnIds);
          localStorage.setItem(storageKey, JSON.stringify(migrated));
          return migrated;
        }

        // New format — merge with defaults to handle added/removed columns
        const sorting: SortingState = parsed.sorting ?? [
          { id: defaultSortId, desc: defaultSortDesc },
        ];

        const storedVisibility: VisibilityState = parsed.columnVisibility ?? {};
        const columnVisibility: VisibilityState = {};
        for (const id of allColumnIds) {
          columnVisibility[id] = storedVisibility[id] ?? true;
        }

        const storedOrder: string[] = parsed.columnOrder ?? allColumnIds;
        const allowedKeys = new Set(allColumnIds);
        const columnOrder = [
          ...storedOrder.filter((key) => allowedKeys.has(key)),
          ...allColumnIds.filter((key) => !storedOrder.includes(key)),
        ];

        return { sorting, columnVisibility, columnOrder };
      }
    } catch {
      // Ignore corrupt localStorage
    }

    const columnVisibility: VisibilityState = {};
    for (const id of allColumnIds) {
      columnVisibility[id] = true;
    }

    return {
      sorting: [{ id: defaultSortId, desc: defaultSortDesc }],
      columnVisibility,
      columnOrder: [...allColumnIds],
    };
  }

  const initial = loadState();
  const sorting = ref<SortingState>(initial.sorting);
  const columnVisibility = ref<VisibilityState>(initial.columnVisibility);
  const columnOrder = ref<string[]>(initial.columnOrder);

  watch(
    [sorting, columnVisibility, columnOrder],
    () => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          sorting: sorting.value,
          columnVisibility: columnVisibility.value,
          columnOrder: columnOrder.value,
        }),
      );
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
