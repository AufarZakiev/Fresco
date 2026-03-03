import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import ConnectView from "./ConnectView.vue";
import { CONNECTION_MODE } from "../types/boinc";

const mockGetOS = vi.fn();
const mockDetectClientDir = vi.fn();
const mockPush = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../composables/usePlatform", () => ({
  getOS: () => mockGetOS(),
  defaultDataDir: (os: string) => `/data/${os}`,
  defaultClientDir: (os: string) => `/client/${os}`,
  detectClientDir: () => mockDetectClientDir(),
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("../composables/useRpc", () => ({
  startBoincClient: vi.fn().mockResolvedValue(undefined),
}));

function mountView() {
  return mount(ConnectView, {
    global: { plugins: [createPinia()] },
  });
}

describe("ConnectView — OS probe loading state", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    mockPush.mockReset();
    mockDetectClientDir.mockRejectedValue(new Error("not available"));
  });

  it("disables Connect button in LOCAL mode while OS probe is pending", () => {
    mockGetOS.mockReturnValue(new Promise(() => {}));
    const wrapper = mountView();

    expect(wrapper.find(".connect-btn").attributes("disabled")).toBeDefined();
  });

  it("does NOT disable Connect button in REMOTE mode while OS probe is pending", async () => {
    mockGetOS.mockReturnValue(new Promise(() => {}));
    const wrapper = mountView();

    await wrapper.find(".toggle-btn:last-child").trigger("click");

    expect(wrapper.find(".connect-btn").attributes("disabled")).toBeUndefined();
  });

  it("disables dataDir and clientDir inputs while OS probe is pending", () => {
    mockGetOS.mockReturnValue(new Promise(() => {}));
    const wrapper = mountView();

    const inputs = wrapper.findAll(".field-input");
    expect(inputs).toHaveLength(2);
    inputs.forEach((input) => {
      expect(input.attributes("disabled")).toBeDefined();
    });
  });

  it("enables inputs and button after OS probe resolves", async () => {
    mockGetOS.mockResolvedValue("macos");
    const wrapper = mountView();

    await flushPromises();

    expect(wrapper.find(".connect-btn").attributes("disabled")).toBeUndefined();
    wrapper.findAll(".field-input").forEach((input) => {
      expect(input.attributes("disabled")).toBeUndefined();
    });
  });

  it("enables inputs and button after OS probe rejects", async () => {
    mockGetOS.mockRejectedValue(new Error("IPC failed"));
    const wrapper = mountView();

    await flushPromises();

    expect(wrapper.find(".connect-btn").attributes("disabled")).toBeUndefined();
    wrapper.findAll(".field-input").forEach((input) => {
      expect(input.attributes("disabled")).toBeUndefined();
    });
  });

  it("sets platform defaults from getOS result", async () => {
    mockGetOS.mockResolvedValue("macos");
    const wrapper = mountView();

    await flushPromises();

    const inputs = wrapper.findAll(".field-input");
    expect((inputs[0].element as HTMLInputElement).value).toBe("/data/macos");
    expect((inputs[1].element as HTMLInputElement).value).toBe("/client/macos");
  });

  it("falls back to linux defaults when getOS rejects", async () => {
    mockGetOS.mockRejectedValue(new Error("IPC failed"));
    const wrapper = mountView();

    await flushPromises();

    const inputs = wrapper.findAll(".field-input");
    expect((inputs[0].element as HTMLInputElement).value).toBe("/data/linux");
    expect((inputs[1].element as HTMLInputElement).value).toBe("/client/linux");
  });

  it("does not overwrite paths applied via recent connection when OS probe resolves", async () => {
    const recent = [{
      mode: CONNECTION_MODE.LOCAL,
      label: "/custom/data",
      dataDir: "/custom/data",
      clientDir: "/custom/client",
      timestamp: Date.now(),
    }];
    localStorage.setItem("boinc-recent-connections", JSON.stringify(recent));

    let resolve: (os: string) => void;
    mockGetOS.mockReturnValue(new Promise((r) => { resolve = r as (os: string) => void; }));

    const wrapper = mountView();
    await nextTick(); // let onMounted's loadRecent() render the recent list

    // Click on the recent connection while OS probe is still pending
    await wrapper.find(".recent-btn").trigger("click");

    resolve!("macos");
    await flushPromises();

    const inputs = wrapper.findAll(".field-input");
    expect((inputs[0].element as HTMLInputElement).value).toBe("/custom/data");
    expect((inputs[1].element as HTMLInputElement).value).toBe("/custom/client");
  });

  it("uses detected client dir when detectClientDir succeeds", async () => {
    mockGetOS.mockResolvedValue("macos");
    mockDetectClientDir.mockResolvedValue("/Library/Application Support/BOINC Data");
    const wrapper = mountView();

    await flushPromises();

    const inputs = wrapper.findAll(".field-input");
    expect((inputs[1].element as HTMLInputElement).value).toBe(
      "/Library/Application Support/BOINC Data",
    );
  });

  it("falls back to defaultClientDir when detectClientDir fails", async () => {
    mockGetOS.mockResolvedValue("macos");
    mockDetectClientDir.mockRejectedValue(new Error("BOINC client not found"));
    const wrapper = mountView();

    await flushPromises();

    const inputs = wrapper.findAll(".field-input");
    expect((inputs[1].element as HTMLInputElement).value).toBe("/client/macos");
  });
});
