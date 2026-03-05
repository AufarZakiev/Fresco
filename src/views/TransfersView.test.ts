import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import TransfersView from "./TransfersView.vue";
import { useTransfersStore } from "../stores/transfers";
import type { FileTransfer } from "../types/boinc";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

function makeTransfer(overrides: Partial<FileTransfer> = {}): FileTransfer {
  return {
    project_url: "https://example.com/project/",
    project_name: "Example Project",
    name: "data_file_001.zip",
    nbytes: 1048576,
    status: 0,
    bytes_xferred: 524288,
    xfer_speed: 65536,
    is_upload: false,
    num_retries: 0,
    first_request_time: 0,
    next_request_time: 0,
    time_so_far: 0,
    estimated_xfer_time_remaining: 0,
    file_offset: 0,
    hostname: "",
    project_backoff: 0,
    ...overrides,
  };
}

describe("TransfersView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows empty message when no transfers", () => {
    const wrapper = mount(TransfersView);
    expect(wrapper.text()).toContain("No active file transfers");
  });

  it("renders transfers table with data", () => {
    const store = useTransfersStore();
    store.transfers = [
      makeTransfer(),
      makeTransfer({ name: "output_001.zip", is_upload: true }),
    ];

    const wrapper = mount(TransfersView);
    const rows = wrapper.findAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain("data_file_001.zip");
    expect(rows[0].text()).toContain("Download");
    expect(rows[1].text()).toContain("output_001.zip");
    expect(rows[1].text()).toContain("Upload");
  });

  it("shows action buttons when transfer is selected", async () => {
    const store = useTransfersStore();
    store.transfers = [makeTransfer()];

    const wrapper = mount(TransfersView);

    await wrapper.find("tbody tr").trigger("click");

    expect(wrapper.text()).toContain("Retry");
    expect(wrapper.text()).toContain("Abort");
  });

  it("shows abort confirmation dialog", async () => {
    const store = useTransfersStore();
    store.transfers = [makeTransfer()];

    const wrapper = mount(TransfersView);
    await wrapper.find("tbody tr").trigger("click");
    await wrapper.find(".btn-danger").trigger("click");
    await wrapper.vm.$nextTick();

    // Dialog is teleported to body
    const body = document.body.textContent ?? "";
    expect(body).toContain("Abort Transfer");
    expect(body).toContain("Abort 1 selected transfer?");
  });

  it("progress bar has ARIA progressbar attributes", () => {
    const store = useTransfersStore();
    store.transfers = [
      makeTransfer({ bytes_xferred: 524288, nbytes: 1048576 }),
    ]; // 50%

    const wrapper = mount(TransfersView);
    const bar = wrapper.find(".progress-bar");
    expect(bar.attributes("role")).toBe("progressbar");
    expect(bar.attributes("aria-valuenow")).toBe("50");
    expect(bar.attributes("aria-valuemin")).toBe("0");
    expect(bar.attributes("aria-valuemax")).toBe("100");
    expect(bar.attributes("aria-label")).toBe("Example Project");
    expect(bar.attributes("aria-valuetext")).toBe("50.0%");
  });

  it("opens abort confirmation when Backspace is pressed with selection", async () => {
    const store = useTransfersStore();
    store.transfers = [makeTransfer()];

    const wrapper = mount(TransfersView);
    await wrapper.find("tbody tr").trigger("click");

    await wrapper.trigger("keydown", { key: "Backspace" });
    await wrapper.vm.$nextTick();

    const body = document.body.textContent ?? "";
    expect(body).toContain("Abort Transfer");
  });
});
