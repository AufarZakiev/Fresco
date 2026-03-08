import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import ManagerOptionsDialog from "./ManagerOptionsDialog.vue";
import { useManagerSettingsStore } from "../stores/managerSettings";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-autostart", () => ({
  enable: vi.fn(),
  disable: vi.fn(),
  isEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock("@vueuse/integrations/useFocusTrap", () => ({
  useFocusTrap: () => ({ activate: vi.fn(), deactivate: vi.fn() }),
}));

describe("ManagerOptionsDialog", () => {
  beforeEach(() => {
    document.body
      .querySelectorAll(".dialog-overlay")
      .forEach((el) => el.remove());
    setActivePinia(createPinia());
  });

  it("does not render when closed", () => {
    mount(ManagerOptionsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    expect(document.body.querySelector(".dialog-overlay")).toBeNull();
  });

  it("renders when open", async () => {
    const wrapper = mount(ManagerOptionsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay!.textContent).toContain("managerOptions.title");
  });

  it("has correct ARIA attributes", async () => {
    const wrapper = mount(ManagerOptionsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const dialog = document.body.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-labelledby")).toBe(
      "manager-options-dialog-title",
    );
  });

  it("renders theme, language, reminder selects", async () => {
    const wrapper = mount(ManagerOptionsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const selects = document.body.querySelectorAll(".option-select");
    expect(selects).toHaveLength(3);
  });

  it("renders checkbox options", async () => {
    const wrapper = mount(ManagerOptionsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const checkboxes = document.body.querySelectorAll(
      'input[type="checkbox"]',
    );
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it("emits close on Escape", async () => {
    const wrapper = mount(ManagerOptionsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close on cancel button", async () => {
    const wrapper = mount(ManagerOptionsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const cancelBtn = document.body.querySelector(
      ".options-footer .btn:not(.btn-primary)",
    ) as HTMLElement;
    cancelBtn.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("changing theme select updates form value", async () => {
    const wrapper = mount(ManagerOptionsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const selects = document.body.querySelectorAll(
      ".option-select",
    ) as NodeListOf<HTMLSelectElement>;
    const themeSelect = selects[0];
    themeSelect.value = "dark";
    themeSelect.dispatchEvent(new Event("change"));
    await wrapper.vm.$nextTick();
    expect(themeSelect.value).toBe("dark");
  });

  it("toggling checkbox updates form value", async () => {
    const wrapper = mount(ManagerOptionsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const checkboxes = document.body.querySelectorAll(
      'input[type="checkbox"]',
    ) as NodeListOf<HTMLInputElement>;
    const firstCheckbox = checkboxes[0];
    const initialChecked = firstCheckbox.checked;
    firstCheckbox.click();
    await wrapper.vm.$nextTick();
    expect(firstCheckbox.checked).toBe(!initialChecked);
  });

  it("save persists settings to store and emits close", async () => {
    const wrapper = mount(ManagerOptionsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();

    // Change theme to dark
    const selects = document.body.querySelectorAll(
      ".option-select",
    ) as NodeListOf<HTMLSelectElement>;
    const themeSelect = selects[0];
    themeSelect.value = "dark";
    themeSelect.dispatchEvent(new Event("change"));
    await wrapper.vm.$nextTick();

    const saveBtn = document.body.querySelector(
      ".options-footer .btn-primary",
    ) as HTMLElement;
    saveBtn.click();
    await flushPromises();

    const store = useManagerSettingsStore();
    expect(store.settings.theme).toBe("dark");
    expect(wrapper.emitted("close")).toBeTruthy();
  });
});
