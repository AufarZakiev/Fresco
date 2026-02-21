import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import App from "./App.vue";
import { useConnectionStore } from "./stores/connection";
import { CONNECTION_STATE } from "./types/boinc";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: vi.fn().mockReturnValue({
    setTitle: vi.fn(),
    onCloseRequested: vi.fn().mockResolvedValue(() => {}),
    destroy: vi.fn(),
  }),
}));

vi.mock("@tauri-apps/plugin-shell", () => ({
  Command: { create: vi.fn() },
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

// Mock all RPC calls so autoConnect finishes quickly
vi.mock("./composables/useRpc", () => ({
  connectLocal: vi.fn().mockResolvedValue(undefined),
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  setRunMode: vi.fn(),
  setGpuMode: vi.fn(),
  shutdownClient: vi.fn(),
  getHostInfo: vi.fn().mockResolvedValue({ domain_name: "test" }),
  startBoincClient: vi.fn().mockRejectedValue(new Error("not installed")),
  getCcStatus: vi.fn().mockResolvedValue({}),
  getResults: vi.fn().mockResolvedValue([]),
  getProjectStatus: vi.fn().mockResolvedValue([]),
  getFileTransfers: vi.fn().mockResolvedValue([]),
  getStatistics: vi.fn().mockResolvedValue([]),
  getMessages: vi.fn().mockResolvedValue([]),
  getNotices: vi.fn().mockResolvedValue([]),
  getDiskUsage: vi.fn().mockResolvedValue({ projects: [], total: 0, free: 0 }),
  getGlobalPrefsWorking: vi.fn().mockResolvedValue({}),
  getGlobalPrefsOverride: vi.fn().mockResolvedValue(null),
}));

const stubComponent = { template: "<div />" };

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<div>Connect</div>" } },
      { path: "/tasks", component: { template: "<div>Tasks</div>" } },
      { path: "/projects", component: { template: "<div>Projects</div>" } },
      { path: "/statistics", component: { template: "<div>Statistics</div>" } },
      { path: "/transfers", component: { template: "<div>Transfers</div>" } },
      { path: "/event-log", component: { template: "<div>Event Log</div>" } },
      { path: "/notices", component: { template: "<div>Notices</div>" } },
      { path: "/disk", component: { template: "<div>Disk</div>" } },
      { path: "/host", component: { template: "<div>Host</div>" } },
    ],
  });
}

async function mountApp(router: ReturnType<typeof createTestRouter>) {
  const wrapper = mount(App, {
    global: {
      plugins: [router],
      stubs: {
        ActivityControls: stubComponent,
        PreferencesDialog: stubComponent,
        AboutDialog: stubComponent,
        SelectComputerDialog: stubComponent,
        ManagerOptionsDialog: stubComponent,
        ExitConfirmDialog: stubComponent,
        StatusBar: stubComponent,
        ToastContainer: stubComponent,
        UpdateBanner: stubComponent,
      },
    },
  });
  // Wait for autoConnect to finish (it's async in onMounted)
  await flushPromises();
  return wrapper;
}

describe("App", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = "";
  });

  it("does not render BOINC text in the sidebar", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();

    // Set connection state so sidebar renders
    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;

    const wrapper = await mountApp(router);

    const sidebar = wrapper.find(".sidebar");
    expect(sidebar.exists()).toBe(true);
    expect(sidebar.text()).not.toContain("BOINC");
  });

  it("renders hamburger toggle button", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();

    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;

    const wrapper = await mountApp(router);

    const hamburger = wrapper.find(".hamburger-btn");
    expect(hamburger.exists()).toBe(true);
    expect(hamburger.attributes("aria-label")).toBe("Toggle sidebar");
  });

  it("toggles sidebar open/close on hamburger click", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();

    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;

    const wrapper = await mountApp(router);

    const sidebar = wrapper.find(".sidebar");
    expect(sidebar.classes()).not.toContain("open");

    await wrapper.find(".hamburger-btn").trigger("click");
    expect(wrapper.find(".sidebar").classes()).toContain("open");

    await wrapper.find(".hamburger-btn").trigger("click");
    expect(wrapper.find(".sidebar").classes()).not.toContain("open");
  });

  it("renders nav links", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();

    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;

    const wrapper = await mountApp(router);

    const navItems = wrapper.findAll(".nav-item");
    expect(navItems.length).toBeGreaterThan(0);

    const labels = navItems.map((item) => item.text());
    expect(labels).toContain("Tasks");
    expect(labels).toContain("Projects");
    expect(labels).toContain("Transfers");
  });

  it("sidebar footer does not contain Add Project or Account Manager buttons", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();

    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;

    const wrapper = await mountApp(router);

    const footer = wrapper.find(".sidebar-footer");
    expect(footer.exists()).toBe(true);
    const buttons = footer.findAll("button");
    const titles = buttons.map((b) => b.attributes("title") ?? "");
    expect(titles).not.toContain("Add Project");
    expect(titles).not.toContain("Account Manager");
  });

  it("sidebar footer contains Select Computer and Preferences buttons", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();

    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;

    const wrapper = await mountApp(router);

    const footer = wrapper.find(".sidebar-footer");
    const tooltips = footer.findAllComponents({ name: "Tooltip" });
    const texts = tooltips.map((t: { props: (key: string) => string }) => t.props("text"));
    expect(texts).toContain("Select Computer");
    expect(texts).toContain("Preferences");
  });
});
