import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import ActivityControls from "./ActivityControls.vue";
import { useClientStore } from "../stores/client";
import { RUN_MODE } from "../types/boinc";
import type { CcStatus } from "../types/boinc";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

const defaultStatus: CcStatus = {
  task_mode: 2,
  task_mode_perm: 2,
  task_mode_delay: 0,
  gpu_mode: 2,
  gpu_mode_perm: 2,
  gpu_mode_delay: 0,
  network_mode: 2,
  network_mode_perm: 2,
  network_mode_delay: 0,
  network_status: 0,
  task_suspend_reason: 0,
  gpu_suspend_reason: 0,
  network_suspend_reason: 0,
  ams_password_error: false,
  manager_must_quit: false,
  disallow_attach: false,
  simple_gui_only: false,
  max_event_log_lines: 0,
};

function mockInvokeHandler(cmd: string, _args?: unknown): unknown {
  if (cmd === "get_cc_status") return { ...defaultStatus };
  return undefined;
}

describe("ActivityControls", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("renders master row plus three per-resource rows (collapsed in DOM)", () => {
    const wrapper = mount(ActivityControls);
    const groups = wrapper.findAll("[role='radiogroup']");
    // master + cpu + gpu + net
    expect(groups).toHaveLength(4);
    groups.forEach((g) => {
      expect(g.findAll("[role='radio']")).toHaveLength(3);
      expect(g.attributes("aria-label")).toBeTruthy();
    });
  });

  it("master highlights the shared mode when all three resources match", () => {
    const store = useClientStore();
    store.status = {
      ...store.status,
      task_mode_perm: RUN_MODE.AUTO,
      gpu_mode_perm: RUN_MODE.AUTO,
      network_mode_perm: RUN_MODE.AUTO,
    };

    const wrapper = mount(ActivityControls);
    const master = wrapper.findAll("[role='radiogroup']")[0];
    const active = master.find("[role='radio'][aria-checked='true']");
    expect(active.exists()).toBe(true);
    expect(active.attributes("data-mode")).toBe(String(RUN_MODE.AUTO));
  });

  it("master shows no active segment when modes differ", () => {
    const store = useClientStore();
    store.status = {
      ...store.status,
      task_mode_perm: RUN_MODE.AUTO,
      gpu_mode_perm: RUN_MODE.AUTO,
      network_mode_perm: RUN_MODE.NEVER,
    };

    const wrapper = mount(ActivityControls);
    const master = wrapper.findAll("[role='radiogroup']")[0];
    expect(master.find("[role='radio'][aria-checked='true']").exists()).toBe(false);
  });

  it("clicking a master segment sets all three resources", async () => {
    mockInvoke.mockImplementation(mockInvokeHandler as never);

    const wrapper = mount(ActivityControls);
    mockInvoke.mockClear();
    const master = wrapper.findAll("[role='radiogroup']")[0];
    await master.find(`[data-mode='${RUN_MODE.NEVER}']`).trigger("click");

    expect(mockInvoke).toHaveBeenCalledWith("set_run_mode", {
      mode: RUN_MODE.NEVER,
      duration: 0,
    });
    expect(mockInvoke).toHaveBeenCalledWith("set_gpu_mode", {
      mode: RUN_MODE.NEVER,
      duration: 0,
    });
    expect(mockInvoke).toHaveBeenCalledWith("set_network_mode", {
      mode: RUN_MODE.NEVER,
      duration: 0,
    });
  });

  it("master skips RPCs for resources already in the target mode", async () => {
    mockInvoke.mockImplementation(mockInvokeHandler as never);

    const store = useClientStore();
    store.status = {
      ...store.status,
      task_mode_perm: RUN_MODE.AUTO,
      gpu_mode_perm: RUN_MODE.AUTO,
      network_mode_perm: RUN_MODE.NEVER,
    };

    const wrapper = mount(ActivityControls);
    mockInvoke.mockClear();
    const master = wrapper.findAll("[role='radiogroup']")[0];
    await master.find(`[data-mode='${RUN_MODE.AUTO}']`).trigger("click");

    expect(mockInvoke).not.toHaveBeenCalledWith("set_run_mode", expect.anything());
    expect(mockInvoke).not.toHaveBeenCalledWith("set_gpu_mode", expect.anything());
    expect(mockInvoke).toHaveBeenCalledWith("set_network_mode", {
      mode: RUN_MODE.AUTO,
      duration: 0,
    });
  });

  it("clicking a per-resource segment calls only that store action", async () => {
    mockInvoke.mockImplementation(mockInvokeHandler as never);

    const wrapper = mount(ActivityControls);
    mockInvoke.mockClear();
    const cpu = wrapper.findAll("[role='radiogroup']")[1];
    await cpu.find(`[data-mode='${RUN_MODE.NEVER}']`).trigger("click");

    expect(mockInvoke).toHaveBeenCalledWith("set_run_mode", {
      mode: RUN_MODE.NEVER,
      duration: 0,
    });
    expect(mockInvoke).not.toHaveBeenCalledWith("set_gpu_mode", expect.anything());
    expect(mockInvoke).not.toHaveBeenCalledWith("set_network_mode", expect.anything());
  });

  it("expand toggle flips aria-expanded and persists in localStorage", async () => {
    const wrapper = mount(ActivityControls);
    const toggle = wrapper.find("[data-testid='expand-toggle']");

    expect(toggle.attributes("aria-expanded")).toBe("false");
    expect(localStorage.getItem("fresco.activityControls.expanded")).toBeNull();

    await toggle.trigger("click");
    expect(toggle.attributes("aria-expanded")).toBe("true");
    expect(localStorage.getItem("fresco.activityControls.expanded")).toBe("true");

    await toggle.trigger("click");
    expect(toggle.attributes("aria-expanded")).toBe("false");
    expect(localStorage.getItem("fresco.activityControls.expanded")).toBe("false");
  });

  it("restores expanded state from localStorage on mount", () => {
    localStorage.setItem("fresco.activityControls.expanded", "true");
    const wrapper = mount(ActivityControls);
    const toggle = wrapper.find("[data-testid='expand-toggle']");
    expect(toggle.attributes("aria-expanded")).toBe("true");
  });
});
