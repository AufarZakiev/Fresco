import { ref, watch } from "vue";

interface ColumnState {
  visibleKeys: string[];
  sortKey: string;
  sortDir: "asc" | "desc";
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
  defaultSortDir: "asc" | "desc" = "asc",
) {
  const storageKey = `boinc-columns-${viewId}`;

  function load(): ColumnState {
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
      // ignore
    }
    return {
      visibleKeys: [...defaultVisibleKeys],
      sortKey: defaultSortKey,
      sortDir: defaultSortDir,
    };
  }

  const initial = load();
  const visibleKeys = ref<string[]>(initial.visibleKeys);
  const sortKey = ref(initial.sortKey);
  const sortDir = ref<"asc" | "desc">(initial.sortDir);

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
