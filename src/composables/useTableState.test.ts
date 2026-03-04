import { describe, it, expect, beforeEach } from "vitest";
import { useTableState } from "./useTableState";

const ALL_COLUMNS = ["name", "status", "progress"];

describe("useTableState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default state when nothing is stored", () => {
    const state = useTableState("test", ALL_COLUMNS, "name");
    expect(state.sorting.value).toEqual([{ id: "name", desc: false }]);
    expect(state.columnVisibility.value).toEqual({
      name: true,
      status: true,
      progress: true,
    });
    expect(state.columnOrder.value).toEqual(["name", "status", "progress"]);
  });

  it("returns default state with desc sort", () => {
    const state = useTableState("test", ALL_COLUMNS, "progress", true);
    expect(state.sorting.value).toEqual([{ id: "progress", desc: true }]);
  });

  it("persists state to localStorage on change", async () => {
    const state = useTableState("test", ALL_COLUMNS, "name");
    state.onSortingChange([{ id: "status", desc: true }]);

    // watch is async — wait a tick for it to fire
    await new Promise((r) => setTimeout(r, 0));

    const stored = JSON.parse(localStorage.getItem("boinc-columns-test")!);
    expect(stored.sorting).toEqual([{ id: "status", desc: true }]);
  });

  it("loads persisted state on next initialization", async () => {
    const state1 = useTableState("test", ALL_COLUMNS, "name");
    state1.onSortingChange([{ id: "progress", desc: true }]);
    state1.onColumnVisibilityChange({ name: true, status: false, progress: true });

    await new Promise((r) => setTimeout(r, 0));

    const state2 = useTableState("test", ALL_COLUMNS, "name");
    expect(state2.sorting.value).toEqual([{ id: "progress", desc: true }]);
    expect(state2.columnVisibility.value).toEqual({
      name: true,
      status: false,
      progress: true,
    });
  });

  it("migrates old format (visibleKeys/sortKey/sortDir)", () => {
    localStorage.setItem(
      "boinc-columns-test",
      JSON.stringify({
        visibleKeys: ["name", "progress"],
        sortKey: "progress",
        sortDir: "desc",
        columnOrder: ["progress", "name", "status"],
      }),
    );

    const state = useTableState("test", ALL_COLUMNS, "name");
    expect(state.sorting.value).toEqual([{ id: "progress", desc: true }]);
    expect(state.columnVisibility.value).toEqual({
      name: true,
      status: false,
      progress: true,
    });
    expect(state.columnOrder.value).toEqual(["progress", "name", "status"]);

    // Verify it was persisted in new format
    const stored = JSON.parse(localStorage.getItem("boinc-columns-test")!);
    expect(stored.sorting).toBeDefined();
    expect(stored.visibleKeys).toBeUndefined();
  });

  it("migrates old format with asc sort direction", () => {
    localStorage.setItem(
      "boinc-columns-test",
      JSON.stringify({
        visibleKeys: ["name"],
        sortKey: "name",
        sortDir: "asc",
      }),
    );

    const state = useTableState("test", ALL_COLUMNS, "name");
    expect(state.sorting.value).toEqual([{ id: "name", desc: false }]);
  });

  it("handles corrupt localStorage gracefully", () => {
    localStorage.setItem("boinc-columns-test", "not-valid-json");
    const state = useTableState("test", ALL_COLUMNS, "name");
    expect(state.sorting.value).toEqual([{ id: "name", desc: false }]);
  });

  it("prunes stale column keys from stored order", () => {
    localStorage.setItem(
      "boinc-columns-test",
      JSON.stringify({
        sorting: [{ id: "name", desc: false }],
        columnVisibility: { name: true, removed: true },
        columnOrder: ["removed", "name", "status"],
      }),
    );

    const state = useTableState("test", ALL_COLUMNS, "name");
    expect(state.columnOrder.value).toEqual(["name", "status", "progress"]);
    expect(state.columnVisibility.value.removed).toBeUndefined();
  });

  it("appends new columns not present in stored order", () => {
    localStorage.setItem(
      "boinc-columns-test",
      JSON.stringify({
        sorting: [],
        columnVisibility: { name: true },
        columnOrder: ["name"],
      }),
    );

    const state = useTableState("test", ALL_COLUMNS, "name");
    expect(state.columnOrder.value).toEqual(["name", "status", "progress"]);
  });

  it("onSortingChange accepts updater function", () => {
    const state = useTableState("test", ALL_COLUMNS, "name");
    state.onSortingChange((prev) => {
      expect(prev).toEqual([{ id: "name", desc: false }]);
      return [{ id: "status", desc: true }];
    });
    expect(state.sorting.value).toEqual([{ id: "status", desc: true }]);
  });

  it("onColumnVisibilityChange accepts updater function", () => {
    const state = useTableState("test", ALL_COLUMNS, "name");
    state.onColumnVisibilityChange((prev) => ({
      ...prev,
      status: false,
    }));
    expect(state.columnVisibility.value.status).toBe(false);
  });

  it("onColumnOrderChange accepts updater function", () => {
    const state = useTableState("test", ALL_COLUMNS, "name");
    state.onColumnOrderChange((prev) => [...prev].reverse());
    expect(state.columnOrder.value).toEqual(["progress", "status", "name"]);
  });
});
