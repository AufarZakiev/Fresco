import { ref, watch } from "vue";
import { SORT_DIR } from "../types/boinc";
import type { SortDir } from "../types/boinc";

interface ColumnState {
  visibleKeys: string[];
  sortKey: string;
  sortDir: SortDir;
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
) {
  const storageKey = `boinc-columns-${viewId}`;

  function loadState(): ColumnState {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          visibleKeys: parsed.visibleKeys ?? defaultVisibleKeys,
          sortKey: parsed.sortKey ?? defaultSortKey,
          sortDir: parsed.sortDir ?? defaultSortDir,
        };
      }
    } catch {
      // Ignore corrupt localStorage
    }
    return {
      visibleKeys: [...defaultVisibleKeys],
      sortKey: defaultSortKey,
      sortDir: defaultSortDir,
    };
  }

  const initial = loadState();
  const visibleKeys = ref<string[]>(initial.visibleKeys);
  const sortKey = ref(initial.sortKey);
  const sortDir = ref<SortDir>(initial.sortDir);

  watch(
    [visibleKeys, sortKey, sortDir],
    () => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          visibleKeys: visibleKeys.value,
          sortKey: sortKey.value,
          sortDir: sortDir.value,
        }),
      );
    },
    { deep: true },
  );

  return { visibleKeys, sortKey, sortDir };
}
