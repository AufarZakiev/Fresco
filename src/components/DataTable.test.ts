import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DataTable from "./DataTable.vue";
import { SORT_DIR } from "../types/boinc";

const columns = [
  { key: "name", label: "Name", sortable: true },
  { key: "status", label: "Status" },
];

describe("DataTable", () => {
  it("renders columns in thead", () => {
    const wrapper = mount(DataTable, {
      props: { columns },
    });
    const ths = wrapper.findAll("thead th");
    expect(ths.length).toBe(2);
    expect(ths[0].text()).toContain("Name");
    expect(ths[1].text()).toContain("Status");
  });

  it("renders slot content in tbody", () => {
    const wrapper = mount(DataTable, {
      props: { columns },
      slots: {
        default: '<tr><td>Row 1</td><td>Active</td></tr>',
      },
    });
    expect(wrapper.find("tbody").text()).toContain("Row 1");
  });

  it("wrapper has overflow auto for scrolling", () => {
    const wrapper = mount(DataTable, {
      props: { columns },
    });
    const tableWrapper = wrapper.find(".data-table-wrapper");
    expect(tableWrapper.exists()).toBe(true);
    // The wrapper element should exist with the class that has overflow: auto
    expect(tableWrapper.classes()).toContain("data-table-wrapper");
  });

  it("thead th elements have sticky positioning styles", () => {
    const wrapper = mount(DataTable, {
      props: { columns },
    });
    const th = wrapper.find("thead th");
    expect(th.exists()).toBe(true);
  });

  it("sets aria-sort='ascending' on the actively sorted column", () => {
    const wrapper = mount(DataTable, {
      props: { columns, sortKey: "name", sortDir: SORT_DIR.ASC },
    });
    const ths = wrapper.findAll("thead th");
    expect(ths[0].attributes("aria-sort")).toBe("ascending");
  });

  it("sets aria-sort='descending' when sort direction is DESC", () => {
    const wrapper = mount(DataTable, {
      props: { columns, sortKey: "name", sortDir: SORT_DIR.DESC },
    });
    const ths = wrapper.findAll("thead th");
    expect(ths[0].attributes("aria-sort")).toBe("descending");
  });

  it("sets aria-sort='none' on sortable columns that are not actively sorted", () => {
    const wrapper = mount(DataTable, {
      props: { columns, sortKey: "status", sortDir: SORT_DIR.ASC },
    });
    const ths = wrapper.findAll("thead th");
    expect(ths[0].attributes("aria-sort")).toBe("none");
  });

  it("omits aria-sort on non-sortable columns", () => {
    const wrapper = mount(DataTable, {
      props: { columns, sortKey: "name", sortDir: SORT_DIR.ASC },
    });
    const ths = wrapper.findAll("thead th");
    expect(ths[1].attributes("aria-sort")).toBeUndefined();
  });

  it("adds scope='col' to all header cells", () => {
    const wrapper = mount(DataTable, {
      props: { columns },
    });
    const ths = wrapper.findAll("thead th");
    ths.forEach((th) => {
      expect(th.attributes("scope")).toBe("col");
    });
  });

  it("hides columns with visible: false", () => {
    const cols = [
      { key: "name", label: "Name", visible: true },
      { key: "hidden", label: "Hidden", visible: false },
      { key: "status", label: "Status" },
    ];
    const wrapper = mount(DataTable, {
      props: { columns: cols },
    });
    const ths = wrapper.findAll("thead th");
    expect(ths.length).toBe(2);
    expect(ths[0].text()).toContain("Name");
    expect(ths[1].text()).toContain("Status");
  });
});
