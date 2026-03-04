import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import StatusBar from "./StatusBar.vue";
import { useClientStore } from "../stores/client";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("StatusBar", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows suspend reason text", () => {
    const client = useClientStore();
    client.status.task_suspend_reason = 4; // USER_REQ
    const wrapper = mount(StatusBar);
    expect(wrapper.text()).toContain("Tasks suspended");
    expect(wrapper.text()).toContain("Suspended by user");
  });

  it("shows GPU suspend reason", () => {
    const client = useClientStore();
    client.status.gpu_suspend_reason = 2; // USER_ACTIVE
    const wrapper = mount(StatusBar);
    expect(wrapper.text()).toContain("GPU suspended");
    expect(wrapper.text()).toContain("User active");
  });

  it("does not show suspend text when not suspended", () => {
    const client = useClientStore();
    client.status.task_suspend_reason = 0;
    client.status.gpu_suspend_reason = 0;
    const wrapper = mount(StatusBar);
    expect(wrapper.text()).not.toContain("suspended");
  });

  it("is hidden when no suspend reasons", () => {
    const client = useClientStore();
    client.status.task_suspend_reason = 0;
    client.status.gpu_suspend_reason = 0;
    const wrapper = mount(StatusBar);
    expect(wrapper.find(".status-bar").exists()).toBe(false);
  });

  it("has contentinfo role on status bar", () => {
    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;
    const wrapper = mount(StatusBar);
    expect(wrapper.find(".status-bar").attributes("role")).toBe("contentinfo");
  });

  it("about button has aria-label", () => {
    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;
    const wrapper = mount(StatusBar);
    expect(wrapper.find(".about-btn").attributes("aria-label")).toBe("About");
  });

  it("status dot is hidden from screen readers", () => {
    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;
    const wrapper = mount(StatusBar);
    expect(wrapper.find(".status-dot").attributes("aria-hidden")).toBe("true");
  });
});
