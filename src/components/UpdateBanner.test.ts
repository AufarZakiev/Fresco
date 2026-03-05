import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import UpdateBanner from "./UpdateBanner.vue";

const {
  mockDismissUpdate,
  mockStartBackgroundDownload,
  mockUpdateOnExit,
  mockReleaseDate,
  mockAssetUrl,
} = vi.hoisted(() => ({
  mockDismissUpdate: vi.fn(),
  mockStartBackgroundDownload: vi.fn(),
  mockUpdateOnExit: { value: false },
  mockReleaseDate: { value: "2025-12-01T10:00:00Z" },
  mockAssetUrl: { value: "https://example.com/update.dmg" },
}));

vi.mock("../composables/useUpdateCheck", () => ({
  useUpdateCheck: () => ({
    releaseDate: mockReleaseDate,
    assetUrl: mockAssetUrl,
    updateOnExit: mockUpdateOnExit,
    dismissUpdate: mockDismissUpdate,
  }),
  startBackgroundDownload: mockStartBackgroundDownload,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("UpdateBanner", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
    mockUpdateOnExit.value = false;
  });

  it("renders update notification", () => {
    mount(UpdateBanner);
    const banner = document.body.querySelector(".update-notification");
    expect(banner).not.toBeNull();
  });

  it("renders three action buttons", () => {
    mount(UpdateBanner);
    const buttons = document.body.querySelectorAll(".update-actions .btn");
    expect(buttons.length).toBe(3);
  });

  it("calls dismissUpdate when close button is clicked", async () => {
    const wrapper = mount(UpdateBanner);
    const closeBtn = document.body.querySelector(".close-btn") as HTMLElement;
    closeBtn.click();
    await wrapper.vm.$nextTick();
    expect(mockDismissUpdate).toHaveBeenCalled();
  });

  it("calls dismissUpdate when remind-later button is clicked", async () => {
    const wrapper = mount(UpdateBanner);
    const buttons = document.body.querySelectorAll(".update-actions .btn");
    const remindBtn = buttons[2] as HTMLElement;
    remindBtn.click();
    await wrapper.vm.$nextTick();
    expect(mockDismissUpdate).toHaveBeenCalled();
  });

  it("sets updateOnExit and starts background download", async () => {
    const wrapper = mount(UpdateBanner);
    const buttons = document.body.querySelectorAll(".update-actions .btn");
    const exitBtn = buttons[1] as HTMLElement;
    exitBtn.click();
    await wrapper.vm.$nextTick();
    expect(mockUpdateOnExit.value).toBe(true);
    expect(mockStartBackgroundDownload).toHaveBeenCalled();
    expect(mockDismissUpdate).toHaveBeenCalled();
  });

  it("displays update text with formatted date", () => {
    mount(UpdateBanner);
    const text = document.body.querySelector(".update-text");
    expect(text).not.toBeNull();
    expect(text!.textContent!.trim().length).toBeGreaterThan(0);
  });
});
