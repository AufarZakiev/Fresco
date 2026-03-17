import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import AboutDialog from "./AboutDialog.vue";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(""),
}));

vi.mock("../stores/managerSettings", () => ({
  useManagerSettingsStore: () => ({
    settings: { checkForUpdates: true },
  }),
}));

vi.mock("@vueuse/integrations/useFocusTrap", () => ({
  useFocusTrap: () => ({
    activate: vi.fn(),
    deactivate: vi.fn(),
  }),
}));

function mountDialog(open = true) {
  return mount(AboutDialog, {
    props: { open },
    global: {
      mocks: {
        $t: (key: string, params?: Record<string, string>) => {
          if (params) return `${key}:${JSON.stringify(params)}`;
          return key;
        },
      },
    },
  });
}

describe("AboutDialog", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("does not render when closed", () => {
    mountDialog(false);
    expect(document.body.querySelector(".dialog-overlay")).toBeNull();
  });

  it("renders when open", () => {
    mountDialog(true);
    expect(document.body.querySelector(".dialog-overlay")).not.toBeNull();
  });

  it("has correct ARIA attributes", () => {
    mountDialog(true);
    const dialog = document.body.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-labelledby")).toBe(
      "about-dialog-title",
    );
  });

  it("renders title", () => {
    mountDialog(true);
    const title = document.body.querySelector("#about-dialog-title");
    expect(title).not.toBeNull();
    expect(title!.textContent).toContain("about.title");
  });

  it("renders description", () => {
    mountDialog(true);
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay!.textContent).toContain("about.description");
  });

  it("renders GitHub link button", () => {
    mountDialog(true);
    const linkBtn = document.body.querySelector(".link-btn");
    expect(linkBtn).not.toBeNull();
    expect(linkBtn!.textContent).toContain("about.github");
  });

  it("renders check for updates button when no update available", () => {
    mountDialog(true);
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay!.textContent).toContain("about.checkForUpdates");
  });

  it("emits close on close button click", async () => {
    const wrapper = mountDialog(true);
    const closeBtn = document.body.querySelector(
      ".about-footer .btn",
    ) as HTMLElement;
    closeBtn.click();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close on overlay click", async () => {
    const wrapper = mountDialog(true);
    const overlay = document.body.querySelector(
      ".dialog-overlay",
    ) as HTMLElement;
    overlay.click();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close on Escape key", async () => {
    const wrapper = mountDialog(false);
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("shows logo image", () => {
    mountDialog(true);
    const img = document.body.querySelector(
      ".about-logo img",
    ) as HTMLImageElement;
    expect(img).not.toBeNull();
    // Default usePreferredDark returns false in jsdom
    expect(img.src).toContain("icon.png");
  });
});
