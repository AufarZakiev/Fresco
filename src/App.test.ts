import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import App from "./App.vue";
import { useConnectionStore } from "./stores/connection";
import { CONNECTION_STATE } from "./types/boinc";
import { connectLocal } from "./composables/useRpc";

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

// Prevent real fetch() to GitHub API during teardown
const { mockCheckForUpdates } = vi.hoisted(() => ({
  mockCheckForUpdates: vi.fn(),
}));
vi.mock("./composables/useUpdateCheck", async () => {
  const { ref } = await import("vue");
  return {
    checkForUpdates: mockCheckForUpdates,
    useUpdateCheck: vi.fn(() => ({
      updateAvailable: ref(false),
      dismissed: ref(false),
      updateOnExit: ref(false),
      downloaded: ref(false),
      downloading: ref(false),
      checkForUpdates: mockCheckForUpdates,
    })),
  };
});

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
    const texts = tooltips.map((t: { props: (key: string) => string }) =>
      t.props("text"),
    );
    expect(texts).toContain("Preferences");
    expect(texts).toContain("About");
  });

  it("renders skip-to-content link targeting #main-content", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();

    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;

    const wrapper = await mountApp(router);

    const skipLink = wrapper.find("a.skip-link");
    expect(skipLink.exists()).toBe(true);
    expect(skipLink.attributes("href")).toBe("#main-content");
    expect(wrapper.find("#main-content").exists()).toBe(true);
  });

  it("renders collapsible nav group as button with aria-expanded", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();

    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;

    const wrapper = await mountApp(router);

    const groupButton = wrapper.find("button.nav-group-label");
    expect(groupButton.exists()).toBe(true);
    expect(groupButton.attributes("aria-expanded")).toBeDefined();
  });

  it("toggles aria-expanded on collapsible group click", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();

    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;

    const wrapper = await mountApp(router);

    const groupButton = wrapper.find("button.nav-group-label");
    const initial = groupButton.attributes("aria-expanded");

    await groupButton.trigger("click");
    const toggled = groupButton.attributes("aria-expanded");
    expect(toggled).not.toBe(initial);
  });

  it("renders non-collapsible nav group as span", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();

    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;

    const wrapper = await mountApp(router);

    const groupSpans = wrapper.findAll("span.nav-group-label");
    expect(groupSpans.length).toBeGreaterThan(0);
    expect(groupSpans[0].element.tagName).toBe("SPAN");
  });

  it("sidebar icon buttons have aria-label", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();

    const conn = useConnectionStore();
    conn.state = CONNECTION_STATE.CONNECTED;

    const wrapper = await mountApp(router);

    const actionBtns = wrapper.findAll(".sidebar-action-btn");
    for (const btn of actionBtns) {
      expect(btn.attributes("aria-label")).toBeTruthy();
    }
  });

  it("prevents Backspace on non-editable targets", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();

    await mountApp(router);

    const event = new KeyboardEvent("keydown", {
      key: "Backspace",
      bubbles: true,
    });
    const spy = vi.spyOn(event, "preventDefault");
    document.body.dispatchEvent(event);

    expect(spy).toHaveBeenCalled();
  });

  it("navigates to /tasks when SelectComputerDialog emits connected", async () => {
    // Make autoConnect fail so it stays on "/"
    vi.mocked(connectLocal).mockRejectedValueOnce(new Error("no client"));

    const router = createTestRouter();
    await router.push("/");
    await router.isReady();

    const selectComputerStub = { template: "<div />", name: "SelectComputerDialog" };
    const wrapper = mount(App, {
      global: {
        plugins: [router],
        stubs: {
          ActivityControls: stubComponent,
          PreferencesDialog: stubComponent,
          AboutDialog: stubComponent,
          SelectComputerDialog: selectComputerStub,
          ManagerOptionsDialog: stubComponent,
          ExitConfirmDialog: stubComponent,
          StatusBar: stubComponent,
          ToastContainer: stubComponent,
          UpdateBanner: stubComponent,
        },
      },
    });
    await flushPromises();

    // autoConnect failed — still on "/"
    expect(router.currentRoute.value.path).toBe("/");

    const dialog = wrapper.findComponent({ name: "SelectComputerDialog" });
    expect(dialog.exists()).toBe(true);

    dialog.vm.$emit("connected");
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/tasks");
  });

  it("prevents context menu on non-editable elements", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();

    await mountApp(router);

    const event = new MouseEvent("contextmenu", { bubbles: true });
    const spy = vi.spyOn(event, "preventDefault");
    document.body.dispatchEvent(event);

    expect(spy).toHaveBeenCalled();
  });

  it("allows native context menu on text input", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();

    await mountApp(router);

    const input = document.createElement("input");
    input.type = "text";
    document.body.appendChild(input);

    const event = new MouseEvent("contextmenu", { bubbles: true });
    const spy = vi.spyOn(event, "preventDefault");
    input.dispatchEvent(event);

    expect(spy).not.toHaveBeenCalled();
    input.remove();
  });

  it("allows native context menu on textarea", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();

    await mountApp(router);

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    const event = new MouseEvent("contextmenu", { bubbles: true });
    const spy = vi.spyOn(event, "preventDefault");
    textarea.dispatchEvent(event);

    expect(spy).not.toHaveBeenCalled();
    textarea.remove();
  });

  it("allows native context menu on contenteditable element", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();

    await mountApp(router);

    const div = document.createElement("div");
    div.contentEditable = "true";
    document.body.appendChild(div);

    const event = new MouseEvent("contextmenu", { bubbles: true });
    const spy = vi.spyOn(event, "preventDefault");
    div.dispatchEvent(event);

    expect(spy).not.toHaveBeenCalled();
    div.remove();
  });

  it("allows Backspace inside text input", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();

    await mountApp(router);

    const input = document.createElement("input");
    input.type = "text";
    document.body.appendChild(input);

    const event = new KeyboardEvent("keydown", {
      key: "Backspace",
      bubbles: true,
    });
    const spy = vi.spyOn(event, "preventDefault");
    input.dispatchEvent(event);

    expect(spy).not.toHaveBeenCalled();
    input.remove();
  });
});
