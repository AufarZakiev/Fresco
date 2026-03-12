import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import ColumnCustomizationDialog from "./ColumnCustomizationDialog.vue";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@vueuse/integrations/useFocusTrap", () => ({
  useFocusTrap: () => ({ activate: vi.fn(), deactivate: vi.fn() }),
}));

function createMockTable() {
  return {
    getAllLeafColumns: () => [
      {
        id: "col1",
        getIsVisible: () => true,
        columnDef: { header: "Column 1" },
      },
      {
        id: "col2",
        getIsVisible: () => true,
        columnDef: { header: "Column 2" },
      },
    ],
    getState: () => ({ columnOrder: ["col1", "col2"] }),
  };
}

describe("ColumnCustomizationDialog", () => {
  beforeEach(() => {
    document.body
      .querySelectorAll(".dialog-overlay")
      .forEach((el) => el.remove());
  });

  it("does not render when closed", () => {
    mount(ColumnCustomizationDialog, {
      props: { open: false, table: createMockTable() as never },
      global: { mocks: { $t: (key: string) => key } },
    });
    expect(document.body.querySelector(".dialog-overlay")).toBeNull();
  });

  it("renders when open", async () => {
    const wrapper = mount(ColumnCustomizationDialog, {
      props: { open: false, table: createMockTable() as never },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    expect(document.body.querySelector(".dialog-overlay")).not.toBeNull();
  });

  it("has correct ARIA attributes", async () => {
    const wrapper = mount(ColumnCustomizationDialog, {
      props: { open: false, table: createMockTable() as never },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    const dialog = document.body.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-labelledby")).toBe(
      "column-dialog-title",
    );
  });

  it("renders column checkboxes", async () => {
    const wrapper = mount(ColumnCustomizationDialog, {
      props: { open: false, table: createMockTable() as never },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    const checkboxes = document.body.querySelectorAll(
      'input[type="checkbox"]',
    );
    expect(checkboxes).toHaveLength(2);
  });

  it("emits close on Escape", async () => {
    const wrapper = mount(ColumnCustomizationDialog, {
      props: { open: false, table: createMockTable() as never },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close on cancel button", async () => {
    const wrapper = mount(ColumnCustomizationDialog, {
      props: { open: false, table: createMockTable() as never },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    const cancelBtn = document.body.querySelector(
      ".dialog-footer .btn:not(.btn-primary)",
    ) as HTMLElement;
    cancelBtn.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("toggling checkbox changes column visibility state", async () => {
    const wrapper = mount(ColumnCustomizationDialog, {
      props: { open: false, table: createMockTable() as never },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    const checkboxes = document.body.querySelectorAll(
      'input[type="checkbox"]',
    ) as NodeListOf<HTMLInputElement>;
    // Both are checked initially; this test verifies that unchecking the
    // second checkbox successfully updates its visibility state
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(true);
    checkboxes[1].click();
    await wrapper.vm.$nextTick();
    const updatedCheckboxes = document.body.querySelectorAll(
      'input[type="checkbox"]',
    ) as NodeListOf<HTMLInputElement>;
    expect(updatedCheckboxes[1].checked).toBe(false);
  });

  it("Apply button emits update-visibility, update-order, and close", async () => {
    const wrapper = mount(ColumnCustomizationDialog, {
      props: { open: false, table: createMockTable() as never },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    const applyBtn = document.body.querySelector(
      ".dialog-footer .btn-primary",
    ) as HTMLElement;
    applyBtn.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("update-visibility")).toBeTruthy();
    expect(wrapper.emitted("update-order")).toBeTruthy();
    expect(wrapper.emitted("close")).toBeTruthy();
  });
});
