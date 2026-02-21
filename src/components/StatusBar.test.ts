import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import StatusBar from "./StatusBar.vue";
import { useConnectionStore } from "../stores/connection";
import { useClientStore } from "../stores/client";
import { CONNECTION_STATE } from "../types/boinc";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("StatusBar", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows Connected status", () => {
    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;
    const wrapper = mount(StatusBar);
    expect(wrapper.text()).toContain("Connected");
    expect(wrapper.find(".status-dot-connected").exists()).toBe(true);
  });

  it("shows Disconnected status", () => {
    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.DISCONNECTED;
    const wrapper = mount(StatusBar);
    expect(wrapper.text()).toContain("Disconnected");
    expect(wrapper.find(".status-dot-disconnected").exists()).toBe(true);
  });

  it("shows suspend reason text", () => {
    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;
    const client = useClientStore();
    client.status.task_suspend_reason = 4; // USER_REQ
    const wrapper = mount(StatusBar);
    expect(wrapper.text()).toContain("Tasks suspended");
    expect(wrapper.text()).toContain("Suspended by user");
  });

  it("shows GPU suspend reason", () => {
    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;
    const client = useClientStore();
    client.status.gpu_suspend_reason = 2; // USER_ACTIVE
    const wrapper = mount(StatusBar);
    expect(wrapper.text()).toContain("GPU suspended");
    expect(wrapper.text()).toContain("User active");
  });

  it("does not show suspend text when not suspended", () => {
    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;
    const client = useClientStore();
    client.status.task_suspend_reason = 0;
    client.status.gpu_suspend_reason = 0;
    const wrapper = mount(StatusBar);
    expect(wrapper.text()).not.toContain("suspended");
  });

  it("shows about button", () => {
    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;
    const wrapper = mount(StatusBar);
    expect(wrapper.find(".about-btn").exists()).toBe(true);
  });
});
