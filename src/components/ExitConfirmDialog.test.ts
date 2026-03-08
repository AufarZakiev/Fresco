import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import ExitConfirmDialog from "./ExitConfirmDialog.vue";
import { useManagerSettingsStore } from "../stores/managerSettings";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@vueuse/integrations/useFocusTrap", () => ({
  useFocusTrap: () => ({ activate: vi.fn(), deactivate: vi.fn() }),
}));

describe("ExitConfirmDialog", () => {
  beforeEach(() => {
    document.body
      .querySelectorAll(".dialog-overlay")
      .forEach((el) => el.remove());
    setActivePinia(createPinia());
  });

  it("does not render when closed", () => {
    mount(ExitConfirmDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    expect(document.body.querySelector(".dialog-overlay")).toBeNull();
  });

  it("renders title and message when open", () => {
    mount(ExitConfirmDialog, {
      props: { open: true },
      global: { mocks: { $t: (key: string) => key } },
    });
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay!.textContent).toContain("exitConfirm.title");
    expect(overlay!.textContent).toContain("exitConfirm.message");
  });

  it("has correct ARIA attributes", () => {
    mount(ExitConfirmDialog, {
      props: { open: true },
      global: { mocks: { $t: (key: string) => key } },
    });
    const dialog = document.body.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-labelledby")).toBe(
      "exit-confirm-dialog-title",
    );
  });

  it("emits close on cancel button click", async () => {
    const wrapper = mount(ExitConfirmDialog, {
      props: { open: true },
      global: { mocks: { $t: (key: string) => key } },
    });
    const buttons = document.body.querySelectorAll(".btn");
    const cancelBtn = buttons[0] as HTMLElement;
    cancelBtn.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close on Escape key", async () => {
    const wrapper = mount(ExitConfirmDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close on overlay click", async () => {
    const wrapper = mount(ExitConfirmDialog, {
      props: { open: true },
      global: { mocks: { $t: (key: string) => key } },
    });
    const overlay = document.body.querySelector(
      ".dialog-overlay",
    ) as HTMLElement;
    overlay.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits confirm with false when no checkbox checked", async () => {
    const wrapper = mount(ExitConfirmDialog, {
      props: { open: true },
      global: { mocks: { $t: (key: string) => key } },
    });
    const confirmBtn = document.body.querySelector(
      ".btn-primary",
    ) as HTMLElement;
    confirmBtn.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("confirm")).toBeTruthy();
    expect(wrapper.emitted("confirm")![0]).toEqual([false]);
  });

  it("emits confirm with true when shutdownClient checked", async () => {
    const wrapper = mount(ExitConfirmDialog, {
      props: { open: true },
      global: { mocks: { $t: (key: string) => key } },
    });
    const checkboxes = document.body.querySelectorAll(
      'input[type="checkbox"]',
    );
    const shutdownCheckbox = checkboxes[0] as HTMLInputElement;
    shutdownCheckbox.click();
    await wrapper.vm.$nextTick();
    const confirmBtn = document.body.querySelector(
      ".btn-primary",
    ) as HTMLElement;
    confirmBtn.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("confirm")![0]).toEqual([true]);
  });

  it("sets showExitConfirmation=false when dontAskAgain checked and confirm", async () => {
    const store = useManagerSettingsStore();
    const wrapper = mount(ExitConfirmDialog, {
      props: { open: true },
      global: { mocks: { $t: (key: string) => key } },
    });
    const checkboxes = document.body.querySelectorAll(
      'input[type="checkbox"]',
    );
    const dontAskCheckbox = checkboxes[1] as HTMLInputElement;
    dontAskCheckbox.click();
    await wrapper.vm.$nextTick();
    const confirmBtn = document.body.querySelector(
      ".btn-primary",
    ) as HTMLElement;
    confirmBtn.click();
    await wrapper.vm.$nextTick();
    expect(store.settings.showExitConfirmation).toBe(false);
  });
});
