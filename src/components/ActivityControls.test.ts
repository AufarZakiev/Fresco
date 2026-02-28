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
  });

  it("renders three mode selectors", () => {
    const wrapper = mount(ActivityControls);
    const selects = wrapper.findAll("select");
    expect(selects).toHaveLength(3);
  });

  it("displays current mode values", () => {
    const store = useClientStore();
    store.status = {
      ...store.status,
      task_mode_perm: RUN_MODE.ALWAYS,
      gpu_mode_perm: RUN_MODE.NEVER,
      network_mode_perm: RUN_MODE.AUTO,
    };

    const wrapper = mount(ActivityControls);
    const selects = wrapper.findAll("select");

    expect((selects[0].element as HTMLSelectElement).value).toBe(
      String(RUN_MODE.ALWAYS),
    );
    expect((selects[1].element as HTMLSelectElement).value).toBe(
      String(RUN_MODE.NEVER),
    );
    expect((selects[2].element as HTMLSelectElement).value).toBe(
      String(RUN_MODE.AUTO),
    );
  });

  it("changing CPU mode calls store action", async () => {
    mockInvoke.mockImplementation(mockInvokeHandler as never);

    const wrapper = mount(ActivityControls);
    const cpuSelect = wrapper.findAll("select")[0];
    await cpuSelect.setValue(String(RUN_MODE.NEVER));

    expect(mockInvoke).toHaveBeenCalledWith("set_run_mode", {
      mode: RUN_MODE.NEVER,
      duration: 0,
    });
  });

  it("changing GPU mode calls store action", async () => {
    mockInvoke.mockImplementation(mockInvokeHandler as never);

    const wrapper = mount(ActivityControls);
    const gpuSelect = wrapper.findAll("select")[1];
    await gpuSelect.setValue(String(RUN_MODE.ALWAYS));

    expect(mockInvoke).toHaveBeenCalledWith("set_gpu_mode", {
      mode: RUN_MODE.ALWAYS,
      duration: 0,
    });
  });

  it("changing Network mode calls store action", async () => {
    mockInvoke.mockImplementation(mockInvokeHandler as never);

    const wrapper = mount(ActivityControls);
    const networkSelect = wrapper.findAll("select")[2];
    await networkSelect.setValue(String(RUN_MODE.AUTO));

    expect(mockInvoke).toHaveBeenCalledWith("set_network_mode", {
      mode: RUN_MODE.AUTO,
      duration: 0,
    });
  });
});
