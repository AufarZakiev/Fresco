import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ExclusiveAppsDialog from "./ExclusiveAppsDialog.vue";

const mockCcConfig = {
  log_flags: {
    task: true,
    file_xfer: false,
    sched_ops: false,
    cpu_sched: false,
    network_xfer: false,
    mem_usage: false,
    disk_usage: false,
    http_debug: false,
    state_debug: false,
    statefile_debug: false,
    android_debug: false,
    app_msg_receive: false,
    app_msg_send: false,
    benchmark_debug: false,
    checkpoint_debug: false,
  },
  exclusive_apps: ["photoshop.exe"],
  exclusive_gpu_apps: ["game.exe"],
  max_file_xfers: 8,
  max_file_xfers_per_project: 2,
  max_ncpus: 0,
  report_results_immediately: false,
  fetch_minimal_work: false,
  http_transfer_timeout: 300,
  max_stderr_file_size: 0,
  max_stdout_file_size: 0,
};

const mockGetCcConfig = vi.fn();
const mockSetCcConfig = vi.fn();

vi.mock("../composables/useRpc", () => ({
  getCcConfig: (...args: unknown[]) => mockGetCcConfig(...args),
  setCcConfig: (...args: unknown[]) => mockSetCcConfig(...args),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@vueuse/integrations/useFocusTrap", () => ({
  useFocusTrap: () => ({ activate: vi.fn(), deactivate: vi.fn() }),
}));

describe("ExclusiveAppsDialog", () => {
  beforeEach(() => {
    document.body
      .querySelectorAll(".dialog-overlay")
      .forEach((el) => el.remove());
    mockGetCcConfig.mockReset();
    mockSetCcConfig.mockReset();
    mockGetCcConfig.mockResolvedValue(structuredClone(mockCcConfig));
    mockSetCcConfig.mockResolvedValue(undefined);
  });

  it("does not render when closed", () => {
    mount(ExclusiveAppsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    expect(document.body.querySelector(".dialog-overlay")).toBeNull();
  });

  it("renders when open", async () => {
    const wrapper = mount(ExclusiveAppsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay!.textContent).toContain("exclusiveApps.title");
  });

  it("has correct ARIA attributes", async () => {
    const wrapper = mount(ExclusiveAppsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const dialog = document.body.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-labelledby")).toBe(
      "exclusive-apps-dialog-title",
    );
  });

  it("shows loading state", async () => {
    mockGetCcConfig.mockReturnValue(new Promise(() => {}));
    const wrapper = mount(ExclusiveAppsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay!.textContent).toContain("exclusiveApps.loading");
  });

  it("renders CPU and GPU app lists after loading", async () => {
    const wrapper = mount(ExclusiveAppsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay!.textContent).toContain("photoshop.exe");
    expect(overlay!.textContent).toContain("game.exe");
  });

  it("adds CPU app via input + Enter key", async () => {
    const wrapper = mount(ExclusiveAppsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const inputs = document.body.querySelectorAll(
      'input[type="text"]',
    );
    const cpuInput = inputs[0] as HTMLInputElement;
    cpuInput.value = "newapp.exe";
    cpuInput.dispatchEvent(new Event("input"));
    await wrapper.vm.$nextTick();
    cpuInput.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", bubbles: true }),
    );
    await wrapper.vm.$nextTick();
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay!.textContent).toContain("newapp.exe");
  });

  it("removes CPU app via remove button click", async () => {
    const wrapper = mount(ExclusiveAppsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const removeBtn = document.body.querySelector(
      ".remove-btn",
    ) as HTMLElement;
    removeBtn.click();
    await wrapper.vm.$nextTick();
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay!.textContent).not.toContain("photoshop.exe");
  });

  it("emits close on Escape", async () => {
    const wrapper = mount(ExclusiveAppsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close on cancel", async () => {
    const wrapper = mount(ExclusiveAppsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const cancelBtn = document.body.querySelector(
      ".exclusive-footer .btn:not(.btn-primary)",
    ) as HTMLElement;
    cancelBtn.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("saves updated lists and emits close", async () => {
    const wrapper = mount(ExclusiveAppsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();

    // Add a new CPU app before saving
    const inputs = document.body.querySelectorAll('input[type="text"]');
    const cpuInput = inputs[0] as HTMLInputElement;
    cpuInput.value = "blender.exe";
    cpuInput.dispatchEvent(new Event("input"));
    await wrapper.vm.$nextTick();
    cpuInput.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", bubbles: true }),
    );
    await wrapper.vm.$nextTick();

    const saveBtn = document.body.querySelector(
      ".exclusive-footer .btn-primary",
    ) as HTMLElement;
    saveBtn.click();
    await flushPromises();

    expect(mockSetCcConfig).toHaveBeenCalledTimes(1);
    const savedConfig = mockSetCcConfig.mock.calls[0][0];
    expect(savedConfig.exclusive_apps).toContain("photoshop.exe");
    expect(savedConfig.exclusive_apps).toContain("blender.exe");
    expect(savedConfig.exclusive_gpu_apps).toContain("game.exe");
    expect(wrapper.emitted("close")).toBeTruthy();
  });
});
