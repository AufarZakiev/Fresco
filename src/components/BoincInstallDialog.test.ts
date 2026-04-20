import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import BoincInstallDialog from "./BoincInstallDialog.vue";
import type { BoincInstallOptions } from "../types/boinc";

vi.mock("@vueuse/integrations/useFocusTrap", () => ({
  useFocusTrap: () => ({
    activate: vi.fn(),
    deactivate: vi.fn(),
  }),
}));

const DOWNLOAD_URL = "https://boinc.berkeley.edu/download.php";

function macosBrewOptions(): BoincInstallOptions {
  return {
    boinc_present: false,
    platform: "macos",
    package_managers: ["brew"],
    official_download_url: DOWNLOAD_URL,
  };
}

function linuxAptOptions(): BoincInstallOptions {
  return {
    boinc_present: false,
    platform: "linux",
    package_managers: ["apt"],
    official_download_url: DOWNLOAD_URL,
  };
}

function windowsOptions(): BoincInstallOptions {
  return {
    boinc_present: false,
    platform: "windows",
    package_managers: [],
    official_download_url: DOWNLOAD_URL,
  };
}

function clearBody() {
  document.body.replaceChildren();
}

let mountedWrappers: VueWrapper<unknown>[] = [];

function mountDialog(options: BoincInstallOptions, installing = false) {
  const wrapper = mount(BoincInstallDialog, {
    props: { open: true, options, installing },
    global: {
      mocks: {
        $t: (key: string) => key,
      },
    },
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

describe("BoincInstallDialog", () => {
  beforeEach(() => {
    clearBody();
  });

  afterEach(() => {
    // Tear down every wrapper mounted in the test so the global Escape
    // keystroke listener registered by `onKeyStroke` is removed; otherwise
    // listeners accumulate across tests and one Escape fires many handlers.
    mountedWrappers.forEach((w) => w.unmount());
    mountedWrappers = [];
  });

  it("does not render when closed", () => {
    const wrapper = mount(BoincInstallDialog, {
      props: { open: false, options: macosBrewOptions(), installing: false },
      global: { mocks: { $t: (k: string) => k } },
    });
    mountedWrappers.push(wrapper);
    expect(document.body.querySelector(".dialog-overlay")).toBeNull();
  });

  it("macOS+brew: emits install when the brew button is clicked", async () => {
    const wrapper = mountDialog(macosBrewOptions());
    const btn = document.body.querySelector(
      '[data-testid="brew-install-btn"]',
    ) as HTMLElement;
    expect(btn).not.toBeNull();
    btn.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("install")).toBeTruthy();
  });

  it("macOS+brew: brew button is disabled while installing", () => {
    mountDialog(macosBrewOptions(), true);
    const btn = document.body.querySelector(
      '[data-testid="brew-install-btn"]',
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(
      document.body.querySelector('[data-testid="brew-progress"]'),
    ).not.toBeNull();
  });

  it("Linux+apt: emits copyCommand with the apt command", async () => {
    const wrapper = mountDialog(linuxAptOptions());
    const pre = document.body.querySelector(
      '[data-testid="linux-primary-command"]',
    ) as HTMLElement;
    expect(pre.textContent).toContain("sudo apt install boinc-client");
    const copyBtn = document.body.querySelector(
      '[data-testid="linux-copy-btn"]',
    ) as HTMLElement;
    copyBtn.click();
    await wrapper.vm.$nextTick();
    const emitted = wrapper.emitted("copyCommand");
    expect(emitted).toBeTruthy();
    expect(emitted?.[0]).toEqual(["sudo apt install boinc-client"]);
  });

  it("Windows: emits openUrl with the download URL", async () => {
    const wrapper = mountDialog(windowsOptions());
    const btn = document.body.querySelector(
      '[data-testid="download-btn"]',
    ) as HTMLElement;
    expect(btn).not.toBeNull();
    btn.click();
    await wrapper.vm.$nextTick();
    const emitted = wrapper.emitted("openUrl");
    expect(emitted).toBeTruthy();
    expect(emitted?.[0]).toEqual([DOWNLOAD_URL]);
  });

  it("emits skip on Escape", async () => {
    const wrapper = mount(BoincInstallDialog, {
      props: { open: false, options: macosBrewOptions(), installing: false },
      global: { mocks: { $t: (k: string) => k } },
    });
    mountedWrappers.push(wrapper);
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("skip")).toBeTruthy();
  });

  it("emits skip when the Skip button is clicked", async () => {
    const wrapper = mountDialog(macosBrewOptions());
    const btn = document.body.querySelector(
      '[data-testid="skip-btn"]',
    ) as HTMLElement;
    btn.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("skip")).toBeTruthy();
  });

  it("Skip is disabled while installing (prevents racing brew)", () => {
    mountDialog(macosBrewOptions(), true);
    const btn = document.body.querySelector(
      '[data-testid="skip-btn"]',
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
