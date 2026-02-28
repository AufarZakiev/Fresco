import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import ConfirmDialog from "./ConfirmDialog.vue";

describe("ConfirmDialog", () => {
  beforeEach(() => {
    // Clean up any teleported elements
    document.body.innerHTML = "";
  });

  it("does not render when closed", () => {
    mount(ConfirmDialog, {
      props: {
        open: false,
        title: "Test",
        message: "Are you sure?",
      },
    });
    expect(document.body.querySelector(".dialog-overlay")).toBeNull();
  });

  it("renders title and message when open", () => {
    mount(ConfirmDialog, {
      props: {
        open: true,
        title: "Delete Item",
        message: "This will permanently delete the item.",
      },
    });
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay!.textContent).toContain("Delete Item");
    expect(overlay!.textContent).toContain("permanently delete");
  });

  it("uses custom confirm label", () => {
    mount(ConfirmDialog, {
      props: {
        open: true,
        title: "Test",
        message: "Confirm?",
        confirmLabel: "Yes, do it",
      },
    });
    const btn = document.body.querySelector(".btn-danger-fill");
    expect(btn!.textContent).toContain("Yes, do it");
  });

  it("defaults to Confirm label", () => {
    mount(ConfirmDialog, {
      props: {
        open: true,
        title: "Test",
        message: "Confirm?",
      },
    });
    const btn = document.body.querySelector(".btn-danger-fill");
    expect(btn!.textContent).toContain("Confirm");
  });

  it("emits confirm on confirm button click", async () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        open: true,
        title: "Test",
        message: "Confirm?",
      },
    });

    const btn = document.body.querySelector(".btn-danger-fill") as HTMLElement;
    btn.click();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("confirm")).toBeTruthy();
  });

  it("emits cancel on cancel button click", async () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        open: true,
        title: "Test",
        message: "Confirm?",
      },
    });

    const buttons = document.body.querySelectorAll(".btn");
    // First .btn is Cancel (the one without .btn-danger-fill)
    const cancelBtn = buttons[0] as HTMLElement;
    cancelBtn.click();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("cancel")).toBeTruthy();
  });

  it("emits cancel on Escape key", async () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        open: false,
        title: "Test",
        message: "Confirm?",
      },
    });

    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("cancel")).toBeTruthy();
  });

  it("has correct ARIA attributes when open", () => {
    mount(ConfirmDialog, {
      props: {
        open: true,
        title: "Delete Item",
        message: "Are you sure?",
      },
    });
    const dialog = document.body.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-labelledby")).toBe("confirm-dialog-title");
    const title = document.body.querySelector("#confirm-dialog-title");
    expect(title).not.toBeNull();
    expect(title!.textContent).toContain("Delete Item");
  });
});
