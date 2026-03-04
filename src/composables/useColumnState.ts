import { ref, computed, watch } from "vue";
import { SORT_DIR } from "../types/boinc";
import type { SortDir } from "../types/boinc";

interface ColumnState {
  visibleKeys: string[];
  sortKey: string;
  sortDir: SortDir;
  columnOrder: string[];
}

/**
 * Persists column visibility and sort state to localStorage.
 *
 * @param viewId - unique identifier for the view (e.g. "tasks", "projects")
 * @param defaultVisibleKeys - default visible column keys
 * @param defaultSortKey - default sort column key
 * @param defaultSortDir - default sort direction
 */
export function useColumnState(
  viewId: string,
  defaultVisibleKeys: string[],
  defaultSortKey: string,
  defaultSortDir: SortDir = SORT_DIR.ASC,
  defaultColumnOrder?: string[],
) {
  const storageKey = `boinc-columns-${viewId}`;
  const defaultOrder = defaultColumnOrder ?? [...defaultVisibleKeys];

  function loadState(): ColumnState {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const storedOrder: string[] = parsed.columnOrder ?? defaultOrder;
        const allowedKeys = new Set(defaultOrder);
        // Prune stale keys, then append any new columns from defaults
        const merged = [
          ...storedOrder.filter((key) => allowedKeys.has(key)),
          ...defaultOrder.filter((key) => !storedOrder.includes(key)),
        ];
        return {
          visibleKeys: parsed.visibleKeys ?? [...defaultVisibleKeys],
          sortKey: parsed.sortKey ?? defaultSortKey,
          sortDir: parsed.sortDir ?? defaultSortDir,
          columnOrder: merged,
        };
      }
    } catch {
      // Ignore corrupt localStorage
    }
    return {
      visibleKeys: [...defaultVisibleKeys],
      sortKey: defaultSortKey,
      sortDir: defaultSortDir,
      columnOrder: [...defaultOrder],
    };
  }

  const initial = loadState();
  const visibleKeys = ref<string[]>(initial.visibleKeys);
  const sortKey = ref(initial.sortKey);
  const sortDir = ref<SortDir>(initial.sortDir);
  const columnOrder = ref<string[]>(initial.columnOrder);

  const orderedVisibleKeys = computed(() =>
    columnOrder.value.filter((key) => visibleKeys.value.includes(key)),
  );

  watch(
    [visibleKeys, sortKey, sortDir, columnOrder],
    () => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          visibleKeys: visibleKeys.value,
          sortKey: sortKey.value,
          sortDir: sortDir.value,
          columnOrder: columnOrder.value,
        }),
      );
    },
    { deep: true },
  );

  return { visibleKeys, sortKey, sortDir, columnOrder, orderedVisibleKeys };
}
