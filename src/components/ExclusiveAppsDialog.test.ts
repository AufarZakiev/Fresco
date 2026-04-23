import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
const mockListRunningProcesses = vi.fn();

vi.mock("../composables/useRpc", () => ({
  getCcConfig: (...args: unknown[]) => mockGetCcConfig(...args),
  setCcConfig: (...args: unknown[]) => mockSetCcConfig(...args),
  listRunningProcesses: (...args: unknown[]) =>
    mockListRunningProcesses(...args),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@vueuse/integrations/useFocusTrap", () => ({
  useFocusTrap: () => ({ activate: vi.fn(), deactivate: vi.fn() }),
}));

const wrappers: Array<ReturnType<typeof mount>> = [];

function mountDialog() {
  const wrapper = mount(ExclusiveAppsDialog, {
    props: { open: false },
    global: {
      mocks: {
        $t: (key: string, params?: Record<string, unknown>) => {
          if (params) return `${key}:${JSON.stringify(params)}`;
          return key;
        },
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

async function openAndLoad(wrapper: ReturnType<typeof mountDialog>) {
  await wrapper.setProps({ open: true });
  await flushPromises();
}

describe("ExclusiveAppsDialog", () => {
  beforeEach(() => {
    mockGetCcConfig.mockReset();
    mockSetCcConfig.mockReset();
    mockListRunningProcesses.mockReset();
    mockGetCcConfig.mockResolvedValue(structuredClone(mockCcConfig));
    mockSetCcConfig.mockResolvedValue(undefined);
    mockListRunningProcesses.mockResolvedValue([]);
  });

  afterEach(() => {
    while (wrappers.length) wrappers.pop()!.unmount();
    document.body
      .querySelectorAll(".dialog-overlay")
      .forEach((el) => el.remove());
  });

  it("does not render when closed", () => {
    mountDialog();
    expect(document.body.querySelector(".dialog-overlay")).toBeNull();
  });

  it("renders with intro copy and merged list", async () => {
    const wrapper = mountDialog();
    await openAndLoad(wrapper);
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay!.textContent).toContain("exclusiveApps.title");
    expect(overlay!.textContent).toContain("exclusiveApps.intro");
    expect(overlay!.textContent).toContain("photoshop.exe");
    expect(overlay!.textContent).toContain("game.exe");
  });

  it("applies correct scope to each loaded row", async () => {
    const wrapper = mountDialog();
    await openAndLoad(wrapper);
    const selects = document.body.querySelectorAll(
      ".scope-select",
    ) as NodeListOf<HTMLSelectElement>;
    expect(selects.length).toBe(2);
    expect(selects[0].value).toBe("all"); // photoshop.exe
    expect(selects[1].value).toBe("gpu"); // game.exe
  });

  it("has correct ARIA attributes", async () => {
    const wrapper = mountDialog();
    await openAndLoad(wrapper);
    const dialog = document.body.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-labelledby")).toBe(
      "exclusive-apps-dialog-title",
    );
  });

  it("shows loading state", async () => {
    mockGetCcConfig.mockReturnValue(new Promise(() => {}));
    const wrapper = mountDialog();
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay!.textContent).toContain("exclusiveApps.loading");
  });

  it("adds app via input + Enter key", async () => {
    const wrapper = mountDialog();
    await openAndLoad(wrapper);
    const input = document.body.querySelector(
      ".add-row input",
    ) as HTMLInputElement;
    input.value = "newapp.exe";
    input.dispatchEvent(new Event("input"));
    await wrapper.vm.$nextTick();
    input.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", bubbles: true }),
    );
    await wrapper.vm.$nextTick();
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay!.textContent).toContain("newapp.exe");
  });

  it("shows duplicate warning when adding an existing name", async () => {
    const wrapper = mountDialog();
    await openAndLoad(wrapper);
    const input = document.body.querySelector(
      ".add-row input",
    ) as HTMLInputElement;
    input.value = "photoshop.exe";
    input.dispatchEvent(new Event("input"));
    await wrapper.vm.$nextTick();
    input.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", bubbles: true }),
    );
    await wrapper.vm.$nextTick();
    const warn = document.body.querySelector(".dup-warn");
    expect(warn).not.toBeNull();
    expect(warn!.textContent).toContain("photoshop.exe");
  });

  it("disables Add button when input is empty", async () => {
    const wrapper = mountDialog();
    await openAndLoad(wrapper);
    const addBtn = document.body.querySelector(
      ".add-row .btn-primary",
    ) as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
  });

  it("removes row via remove button", async () => {
    const wrapper = mountDialog();
    await openAndLoad(wrapper);
    const removeBtn = document.body.querySelector(
      ".remove-btn",
    ) as HTMLElement;
    removeBtn.click();
    await wrapper.vm.$nextTick();
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay!.textContent).not.toContain("photoshop.exe");
  });

  it("disables Save when not dirty and enables after change", async () => {
    const wrapper = mountDialog();
    await openAndLoad(wrapper);
    const saveBtn = document.body.querySelector(
      ".exclusive-footer .btn-primary",
    ) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    const removeBtn = document.body.querySelector(
      ".remove-btn",
    ) as HTMLElement;
    removeBtn.click();
    await wrapper.vm.$nextTick();
    expect(saveBtn.disabled).toBe(false);
  });

  it("saves split lists back to exclusive_apps / exclusive_gpu_apps", async () => {
    const wrapper = mountDialog();
    await openAndLoad(wrapper);

    // Add a new CPU-scoped app
    const input = document.body.querySelector(
      ".add-row input",
    ) as HTMLInputElement;
    input.value = "blender.exe";
    input.dispatchEvent(new Event("input"));
    await wrapper.vm.$nextTick();
    input.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", bubbles: true }),
    );
    await wrapper.vm.$nextTick();

    const saveBtn = document.body.querySelector(
      ".exclusive-footer .btn-primary",
    ) as HTMLButtonElement;
    saveBtn.click();
    await flushPromises();

    expect(mockSetCcConfig).toHaveBeenCalledTimes(1);
    const saved = mockSetCcConfig.mock.calls[0][0];
    expect(saved.exclusive_apps).toEqual(
      expect.arrayContaining(["photoshop.exe", "blender.exe"]),
    );
    expect(saved.exclusive_apps).not.toContain("game.exe");
    expect(saved.exclusive_gpu_apps).toEqual(["game.exe"]);
  });

  it("writes a row whose scope was changed to the correct array", async () => {
    const wrapper = mountDialog();
    await openAndLoad(wrapper);

    const selects = document.body.querySelectorAll(
      ".scope-select",
    ) as NodeListOf<HTMLSelectElement>;
    // Flip photoshop.exe from "all" to "gpu"
    selects[0].value = "gpu";
    selects[0].dispatchEvent(new Event("change"));
    await wrapper.vm.$nextTick();

    const saveBtn = document.body.querySelector(
      ".exclusive-footer .btn-primary",
    ) as HTMLButtonElement;
    saveBtn.click();
    await flushPromises();

    const saved = mockSetCcConfig.mock.calls[0][0];
    expect(saved.exclusive_apps).toEqual([]);
    expect(saved.exclusive_gpu_apps).toEqual(
      expect.arrayContaining(["photoshop.exe", "game.exe"]),
    );
  });

  it("emits close directly when clean on Cancel", async () => {
    const wrapper = mountDialog();
    await openAndLoad(wrapper);
    const cancelBtn = document.body.querySelector(
      ".exclusive-footer .btn:not(.btn-primary)",
    ) as HTMLElement;
    cancelBtn.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("shows discard prompt when dirty and Cancel is clicked", async () => {
    const wrapper = mountDialog();
    await openAndLoad(wrapper);

    const removeBtn = document.body.querySelector(
      ".remove-btn",
    ) as HTMLElement;
    removeBtn.click();
    await wrapper.vm.$nextTick();

    const cancelBtn = document.body.querySelector(
      ".exclusive-footer .btn:not(.btn-primary)",
    ) as HTMLElement;
    cancelBtn.click();
    await wrapper.vm.$nextTick();

    // ConfirmDialog is a second dialog overlay
    const overlays = document.body.querySelectorAll(".dialog-overlay");
    expect(overlays.length).toBeGreaterThanOrEqual(2);
    expect(wrapper.emitted("close")).toBeFalsy();

    const discardBtn = document.body.querySelector(
      ".btn-danger-fill",
    ) as HTMLElement;
    discardBtn.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("opens the process picker and lists processes", async () => {
    mockListRunningProcesses.mockResolvedValue([
      "chrome.exe",
      "boincmgr.exe",
      "photoshop.exe",
    ]);
    const wrapper = mountDialog();
    await openAndLoad(wrapper);

    const pickBtn = Array.from(
      document.body.querySelectorAll(".add-row .btn"),
    ).find((el) =>
      el.textContent?.includes("exclusiveApps.pickProcess"),
    ) as HTMLElement;
    pickBtn.click();
    await flushPromises();

    const picker = document.body.querySelector(".picker-dialog");
    expect(picker).not.toBeNull();
    // boincmgr is hidden by default
    expect(picker!.textContent).toContain("chrome.exe");
    expect(picker!.textContent).not.toContain("boincmgr.exe");
  });

  it("adds selected processes from the picker", async () => {
    mockListRunningProcesses.mockResolvedValue([
      "chrome.exe",
      "photoshop.exe", // already in list → should be skipped
      "steam.exe",
    ]);
    const wrapper = mountDialog();
    await openAndLoad(wrapper);

    const pickBtn = Array.from(
      document.body.querySelectorAll(".add-row .btn"),
    ).find((el) =>
      el.textContent?.includes("exclusiveApps.pickProcess"),
    ) as HTMLElement;
    pickBtn.click();
    await flushPromises();

    const checkboxes = document.body.querySelectorAll(
      ".picker-item input[type='checkbox']",
    ) as NodeListOf<HTMLInputElement>;
    // Select all three
    for (const cb of checkboxes) {
      cb.click();
      await wrapper.vm.$nextTick();
    }

    const addBtn = document.body.querySelector(
      ".picker-dialog .btn-primary",
    ) as HTMLButtonElement;
    addBtn.click();
    await wrapper.vm.$nextTick();

    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay!.textContent).toContain("chrome.exe");
    expect(overlay!.textContent).toContain("steam.exe");
    // Only one occurrence of photoshop.exe (no duplicate)
    const count = (overlay!.textContent!.match(/photoshop\.exe/g) || []).length;
    expect(count).toBe(1);
  });

  it("Escape on picker closes picker, not main dialog", async () => {
    mockListRunningProcesses.mockResolvedValue(["chrome.exe"]);
    const wrapper = mountDialog();
    await openAndLoad(wrapper);

    const pickBtn = Array.from(
      document.body.querySelectorAll(".add-row .btn"),
    ).find((el) =>
      el.textContent?.includes("exclusiveApps.pickProcess"),
    ) as HTMLElement;
    pickBtn.click();
    await flushPromises();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();

    expect(document.body.querySelector(".picker-dialog")).toBeNull();
    expect(document.body.querySelector(".exclusive-dialog")).not.toBeNull();
    expect(wrapper.emitted("close")).toBeFalsy();
  });
});
