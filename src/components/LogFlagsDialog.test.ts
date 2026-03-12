import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import LogFlagsDialog from "./LogFlagsDialog.vue";

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
  exclusive_apps: [],
  exclusive_gpu_apps: [],
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

describe("LogFlagsDialog", () => {
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
    mount(LogFlagsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    expect(document.body.querySelector(".dialog-overlay")).toBeNull();
  });

  it("renders when open", async () => {
    const wrapper = mount(LogFlagsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay!.textContent).toContain("logFlags.title");
  });

  it("has correct ARIA attributes", async () => {
    mount(LogFlagsDialog, {
      props: { open: true },
      global: { mocks: { $t: (key: string) => key } },
    });
    await flushPromises();
    const dialog = document.body.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-labelledby")).toBe(
      "log-flags-dialog-title",
    );
  });

  it("shows loading state initially", async () => {
    mockGetCcConfig.mockReturnValue(new Promise(() => {}));
    const wrapper = mount(LogFlagsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay!.textContent).toContain("logFlags.loading");
  });

  it("renders log flag switches after loading", async () => {
    const wrapper = mount(LogFlagsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const switches = document.body.querySelectorAll('[role="switch"]');
    expect(switches.length).toBeGreaterThan(0);
  });

  it("emits close on Escape", async () => {
    const wrapper = mount(LogFlagsDialog, {
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
    const wrapper = mount(LogFlagsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const cancelBtn = document.body.querySelector(
      ".logflags-footer .btn:not(.btn-primary)",
    ) as HTMLElement;
    cancelBtn.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("shows error on save failure", async () => {
    mockSetCcConfig.mockRejectedValue(new Error("Save failed"));
    const wrapper = mount(LogFlagsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const saveBtn = document.body.querySelector(
      ".logflags-footer .btn-primary",
    ) as HTMLElement;
    saveBtn.click();
    await flushPromises();
    const errorEl = document.body.querySelector(".logflags-error");
    expect(errorEl).not.toBeNull();
    expect(errorEl!.textContent).toContain("Save failed");
  });

  it("saves successfully and emits close", async () => {
    const wrapper = mount(LogFlagsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const saveBtn = document.body.querySelector(
      ".logflags-footer .btn-primary",
    ) as HTMLElement;
    saveBtn.click();
    await flushPromises();
    expect(mockSetCcConfig).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("has role=switch with aria-checked on toggles", async () => {
    const wrapper = mount(LogFlagsDialog, {
      props: { open: false },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const switches = document.body.querySelectorAll('[role="switch"]');
    expect(switches.length).toBeGreaterThan(0);
    const firstSwitch = switches[0];
    expect(firstSwitch.getAttribute("aria-checked")).toBeTruthy();
  });
});
