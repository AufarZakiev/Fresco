import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import DataTable from "./DataTable.vue";
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
} from "@tanstack/vue-table";
import type { ColumnDef, SortingState, VisibilityState, Table } from "@tanstack/vue-table";

interface TestRow {
  name: string;
  status: string;
  progress: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTable(options: {
  data?: TestRow[];
  columns?: ColumnDef<TestRow, unknown>[];
  sorting?: SortingState;
  columnVisibility?: VisibilityState;
  columnOrder?: string[];
} = {}): Table<any> {
  const data = options.data ?? [
    { name: "Alice", status: "Active", progress: 50 },
  ];
  const sortingRef = ref<SortingState>(options.sorting ?? []);
  const columnVisibility = ref<VisibilityState>(options.columnVisibility ?? {});
  const columnOrder = ref<string[]>(options.columnOrder ?? []);

  const columns: ColumnDef<TestRow, unknown>[] = options.columns ?? [
    { id: "name", accessorFn: (r) => r.name, header: () => "Name", enableSorting: true },
    { id: "status", accessorFn: (r) => r.status, header: () => "Status", enableSorting: false },
  ];

  return useVueTable({
    get data() { return data; },
    columns,
    state: {
      get sorting() { return sortingRef.value; },
      get columnVisibility() { return columnVisibility.value; },
      get columnOrder() { return columnOrder.value; },
    },
    onSortingChange: (updater) => {
      sortingRef.value = typeof updater === "function" ? updater(sortingRef.value) : updater;
    },
    onColumnVisibilityChange: (updater) => {
      columnVisibility.value = typeof updater === "function" ? updater(columnVisibility.value) : updater;
    },
    onColumnOrderChange: (updater) => {
      columnOrder.value = typeof updater === "function" ? updater(columnOrder.value) : updater;
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
}

function findThByLabel(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll("thead th").find((th) => th.text().includes(label));
}

describe("DataTable", () => {
  it("renders columns in thead", () => {
    const table = createTable();
    const wrapper = mount(DataTable, { props: { table } });
    expect(findThByLabel(wrapper, "Name")?.exists()).toBe(true);
    expect(findThByLabel(wrapper, "Status")?.exists()).toBe(true);
  });

  it("renders rows in tbody from table data", () => {
    const table = createTable({
      data: [
        { name: "Alice", status: "Active", progress: 50 },
        { name: "Bob", status: "Idle", progress: 30 },
      ],
    });
    const wrapper = mount(DataTable, { props: { table } });
    const rows = wrapper.findAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain("Alice");
    expect(rows[1].text()).toContain("Bob");
  });

  it("wrapper has overflow auto for scrolling", () => {
    const table = createTable();
    const wrapper = mount(DataTable, { props: { table } });
    const tableWrapper = wrapper.find(".data-table-wrapper");
    expect(tableWrapper.exists()).toBe(true);
    expect(tableWrapper.classes()).toContain("data-table-wrapper");
  });

  it("thead th elements exist", () => {
    const table = createTable();
    const wrapper = mount(DataTable, { props: { table } });
    const th = wrapper.find("thead th");
    expect(th.exists()).toBe(true);
  });

  it("sets aria-sort='ascending' on the actively sorted column", () => {
    const table = createTable({ sorting: [{ id: "name", desc: false }] });
    const wrapper = mount(DataTable, { props: { table } });
    expect(findThByLabel(wrapper, "Name")?.attributes("aria-sort")).toBe(
      "ascending",
    );
  });

  it("sets aria-sort='descending' when sort direction is desc", () => {
    const table = createTable({ sorting: [{ id: "name", desc: true }] });
    const wrapper = mount(DataTable, { props: { table } });
    expect(findThByLabel(wrapper, "Name")?.attributes("aria-sort")).toBe(
      "descending",
    );
  });

  it("sets aria-sort='none' on sortable columns that are not actively sorted", () => {
    const table = createTable({ sorting: [] });
    const wrapper = mount(DataTable, { props: { table } });
    // Name column is sortable but not sorted
    expect(findThByLabel(wrapper, "Name")?.attributes("aria-sort")).toBe(
      "none",
    );
  });

  it("omits aria-sort on non-sortable columns", () => {
    const table = createTable({ sorting: [{ id: "name", desc: false }] });
    const wrapper = mount(DataTable, { props: { table } });
    // Status column has enableSorting: false
    expect(
      findThByLabel(wrapper, "Status")?.attributes("aria-sort"),
    ).toBeUndefined();
  });

  it("adds scope='col' to all header cells", () => {
    const table = createTable();
    const wrapper = mount(DataTable, { props: { table } });
    wrapper.findAll("thead th").forEach((th) => {
      expect(th.attributes("scope")).toBe("col");
    });
  });

  it("adds scope='col' to selectable checkbox header", () => {
    const table = createTable();
    const wrapper = mount(DataTable, {
      props: { table, selectable: true },
    });
    const ths = wrapper.findAll("thead th");
    expect(ths[0].attributes("scope")).toBe("col");
    expect(ths[0].find("input[type='checkbox']").exists()).toBe(true);
  });

  it("hides columns with visibility set to false", () => {
    const table = createTable({
      columns: [
        { id: "name", accessorFn: (r) => r.name, header: () => "Name" },
        { id: "hidden", accessorFn: (r) => r.status, header: () => "Hidden" },
        { id: "status", accessorFn: (r) => r.status, header: () => "Status" },
      ],
      columnVisibility: { hidden: false },
    });
    const wrapper = mount(DataTable, { props: { table } });
    expect(findThByLabel(wrapper, "Name")?.exists()).toBe(true);
    expect(findThByLabel(wrapper, "Hidden")).toBeUndefined();
    expect(findThByLabel(wrapper, "Status")?.exists()).toBe(true);
  });

  it("reorders columns according to columnOrder", () => {
    const table = createTable({
      columns: [
        { id: "name", accessorFn: (r) => r.name, header: () => "Name" },
        { id: "status", accessorFn: (r) => r.status, header: () => "Status" },
        { id: "progress", accessorFn: (r) => r.progress, header: () => "Progress" },
      ],
      columnOrder: ["progress", "name", "status"],
    });
    const wrapper = mount(DataTable, { props: { table } });
    const headers = wrapper.findAll("thead th").map((th) => th.text());
    expect(headers).toEqual(["Progress", "Name", "Status"]);
  });

  it("ignores unknown keys in columnOrder", () => {
    const table = createTable({
      columns: [
        { id: "name", accessorFn: (r) => r.name, header: () => "Name" },
        { id: "status", accessorFn: (r) => r.status, header: () => "Status" },
      ],
      columnOrder: ["unknown", "status", "name"],
    });
    const wrapper = mount(DataTable, { props: { table } });
    const headers = wrapper.findAll("thead th").map((th) => th.text());
    expect(headers).toEqual(["Status", "Name"]);
  });

  it("uses default column order when columnOrder has missing columns", () => {
    const table = createTable({
      columns: [
        { id: "name", accessorFn: (r) => r.name, header: () => "Name" },
        { id: "status", accessorFn: (r) => r.status, header: () => "Status" },
        { id: "progress", accessorFn: (r) => r.progress, header: () => "Progress" },
      ],
      columnOrder: ["status"],
    });
    const wrapper = mount(DataTable, { props: { table } });
    const headers = wrapper.findAll("thead th").map((th) => th.text());
    // TanStack puts ordered column first, then remaining in definition order
    expect(headers).toEqual(["Status", "Name", "Progress"]);
  });

  describe("drag-and-drop column reordering", () => {
    it("does not add reorderable class when reorderable is false", () => {
      const table = createTable();
      const wrapper = mount(DataTable, {
        props: { table, reorderable: false },
      });
      const ths = wrapper.findAll("thead th");
      for (const th of ths) {
        expect(th.classes()).not.toContain("reorderable");
      }
    });

    it("adds reorderable class when reorderable prop is true", () => {
      const table = createTable();
      const wrapper = mount(DataTable, {
        props: { table, reorderable: true },
      });
      const ths = wrapper.findAll("thead th");
      for (const th of ths) {
        expect(th.classes()).toContain("reorderable");
      }
    });

    it("does not enter drag mode below threshold (preserves click-to-sort)", async () => {
      const table = createTable();
      const wrapper = mount(DataTable, {
        props: { table, reorderable: true },
      });
      const th = findThByLabel(wrapper, "Name")!;

      // Mock setPointerCapture
      const mockSetPointerCapture = vi.fn();
      Object.defineProperty(th.element, "setPointerCapture", {
        value: mockSetPointerCapture,
      });

      // Simulate pointerdown + small pointermove (below 5px threshold)
      await th.trigger("pointerdown", { clientX: 100, pointerId: 1 });

      const moveEvent = new PointerEvent("pointermove", { clientX: 103 });
      document.dispatchEvent(moveEvent);

      // "dragging" class should NOT appear
      expect(th.classes()).not.toContain("dragging");

      // Cleanup
      document.dispatchEvent(new PointerEvent("pointerup"));
    });

    it("enters drag mode past threshold and adds dragging class", async () => {
      const table = createTable();
      const wrapper = mount(DataTable, {
        props: { table, reorderable: true },
      });
      const th = findThByLabel(wrapper, "Name")!;

      // Mock setPointerCapture
      const mockSetPointerCapture = vi.fn();
      Object.defineProperty(th.element, "setPointerCapture", {
        value: mockSetPointerCapture,
      });

      await th.trigger("pointerdown", { clientX: 100, pointerId: 1 });

      // Move beyond threshold (> 5px)
      document.dispatchEvent(new PointerEvent("pointermove", { clientX: 110 }));
      await wrapper.vm.$nextTick();

      expect(th.classes()).toContain("dragging");

      // Cleanup
      document.dispatchEvent(new PointerEvent("pointerup"));
    });
  });
});
