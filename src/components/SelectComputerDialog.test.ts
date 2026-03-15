import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import SelectComputerDialog from "./SelectComputerDialog.vue";
import { CONNECTION_STATE } from "../types/boinc";

const mockConnectToRemote = vi.fn();
const mockConnectToLocal = vi.fn();
let mockState: string = CONNECTION_STATE.CONNECTED;
let mockError: string | null = null;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../stores/connection", () => ({
  useConnectionStore: () => ({
    connectToRemote: mockConnectToRemote,
    connectToLocal: mockConnectToLocal,
    get state() {
      return mockState;
    },
    get error() {
      return mockError;
    },
  }),
}));

vi.mock("../composables/usePlatform", () => ({
  getOS: vi.fn().mockResolvedValue("linux"),
  defaultDataDir: (os: string) => `/data/${os}`,
}));

vi.mock("@vueuse/integrations/useFocusTrap", () => ({
  useFocusTrap: () => ({
    activate: vi.fn(),
    deactivate: vi.fn(),
  }),
}));

function mountDialog(open = true) {
  return mount(SelectComputerDialog, {
    props: { open },
    global: {
      plugins: [createPinia()],
      mocks: {
        $t: (key: string) => key,
      },
    },
  });
}

describe("SelectComputerDialog", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.querySelectorAll(".dialog-overlay").forEach((el) => el.remove());
    mockConnectToRemote.mockReset();
    mockConnectToLocal.mockReset();
    mockState = CONNECTION_STATE.CONNECTED;
    mockError = null;
  });

  it("does not render when closed", () => {
    mountDialog(false);
    expect(document.body.querySelector(".dialog-overlay")).toBeNull();
  });

  it("renders when open", () => {
    mountDialog(true);
    expect(document.body.querySelector(".dialog-overlay")).not.toBeNull();
  });

  it("has correct ARIA attributes", () => {
    mountDialog(true);
    const dialog = document.body.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-labelledby")).toBe(
      "select-computer-dialog-title",
    );
  });

  it("renders title", () => {
    mountDialog(true);
    const title = document.body.querySelector(
      "#select-computer-dialog-title",
    );
    expect(title).not.toBeNull();
    expect(title!.textContent).toContain("selectComputer.title");
  });

  it("renders hostname, port, and password fields", () => {
    mountDialog(true);
    const inputs = document.body.querySelectorAll("input");
    expect(inputs).toHaveLength(3);
  });

  it("defaults hostname to localhost and port to 31416", () => {
    mountDialog(true);
    const inputs = document.body.querySelectorAll("input");
    expect((inputs[0] as HTMLInputElement).value).toBe("localhost");
    expect((inputs[1] as HTMLInputElement).value).toBe("31416");
  });

  it("emits close on close button click", async () => {
    const wrapper = mountDialog(true);
    const closeBtn = document.body.querySelector(
      ".close-btn",
    ) as HTMLElement;
    closeBtn.click();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close on Escape key", async () => {
    const wrapper = mountDialog(false);
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("calls connectToRemote on Connect button click", async () => {
    mockConnectToRemote.mockResolvedValue(undefined);
    mountDialog(true);

    const connectBtn = document.body.querySelector(
      ".btn-primary",
    ) as HTMLElement;
    connectBtn.click();
    await flushPromises();

    expect(mockConnectToRemote).toHaveBeenCalledWith("localhost", 31416, "");
  });

  it("emits connected and close on successful remote connection", async () => {
    mockConnectToRemote.mockResolvedValue(undefined);
    mockState = CONNECTION_STATE.CONNECTED;
    const wrapper = mountDialog(true);

    const connectBtn = document.body.querySelector(
      ".btn-primary",
    ) as HTMLElement;
    connectBtn.click();
    await flushPromises();

    expect(wrapper.emitted("connected")).toBeTruthy();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("shows error on failed remote connection", async () => {
    mockConnectToRemote.mockResolvedValue(undefined);
    mockState = CONNECTION_STATE.DISCONNECTED;
    mockError = "Connection refused";
    mountDialog(true);

    const connectBtn = document.body.querySelector(
      ".btn-primary",
    ) as HTMLElement;
    connectBtn.click();
    await flushPromises();

    const errorEl = document.body.querySelector(".dialog-error");
    expect(errorEl).not.toBeNull();
    expect(errorEl!.textContent).toContain("Connection refused");
  });

  it("calls connectToLocal on local connect button click", async () => {
    mockConnectToLocal.mockResolvedValue(undefined);
    mockState = CONNECTION_STATE.CONNECTED;
    mountDialog(true);

    const localBtn = document.body.querySelector(
      ".local-btn",
    ) as HTMLElement;
    localBtn.click();
    await flushPromises();

    expect(mockConnectToLocal).toHaveBeenCalledWith("/data/linux");
  });

  it("shows error when local connection fails with exception", async () => {
    mockConnectToLocal.mockRejectedValue(new Error("IPC error"));
    mountDialog(true);

    const localBtn = document.body.querySelector(
      ".local-btn",
    ) as HTMLElement;
    localBtn.click();
    await flushPromises();

    const errorEl = document.body.querySelector(".dialog-error");
    expect(errorEl).not.toBeNull();
    expect(errorEl!.textContent!.length).toBeGreaterThan(0);
  });

  it("emits close on overlay click", async () => {
    const wrapper = mountDialog(true);
    const overlay = document.body.querySelector(
      ".dialog-overlay",
    ) as HTMLElement;
    overlay.click();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("close")).toBeTruthy();
  });
});
