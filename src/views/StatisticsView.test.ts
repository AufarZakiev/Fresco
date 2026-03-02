import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import StatisticsView from "./StatisticsView.vue";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../composables/useRpc", () => ({
  getStatistics: vi.fn().mockResolvedValue([
    {
      master_url: "https://example.com/",
      daily_statistics: [
        { day: 1700000000, user_total_credit: 100, user_expavg_credit: 10, host_total_credit: 50, host_expavg_credit: 5 },
        { day: 1700100000, user_total_credit: 200, user_expavg_credit: 20, host_total_credit: 100, host_expavg_credit: 10 },
      ],
    },
  ]),
  getProjectStatus: vi.fn().mockResolvedValue([]),
}));

vi.mock("../components/PageHeader.vue", () => ({
  default: { template: '<div class="page-header"><slot /></div>' },
}));

vi.mock("../components/EmptyState.vue", () => ({
  default: { template: '<div class="empty-state"></div>' },
}));

vi.mock("../components/StatisticsChart.vue", () => ({
  default: { template: '<div class="statistics-chart"></div>', props: ["data", "title", "enabledSeries"] },
}));

function pressKey(key: string, target?: EventTarget) {
  const dispatchTarget = target ?? window;
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });
  dispatchTarget.dispatchEvent(event);
}

describe("StatisticsView keyboard shortcuts", () => {
  let wrapper: VueWrapper;

  beforeEach(async () => {
    setActivePinia(createPinia());
    wrapper = mount(StatisticsView, {
      global: { stubs: { Teleport: true } },
    });
    await flushPromises();
  });

  afterEach(() => {
    wrapper.unmount();
  });

  it("key 1 switches to single mode", async () => {
    // Start from a different mode
    await wrapper.find(".segment:nth-child(2)").trigger("click");
    expect(wrapper.find(".segment:nth-child(2)").classes()).toContain("active");
    pressKey("1");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".segment:nth-child(1)").classes()).toContain("active");
  });

  it("key 2 switches to all mode", async () => {
    pressKey("2");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".segment:nth-child(2)").classes()).toContain("active");
  });

  it("key 3 switches to separate mode", async () => {
    pressKey("3");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".segment:nth-child(3)").classes()).toContain("active");
  });

  it("key u toggles user actor off then on", async () => {
    pressKey("u");
    await wrapper.vm.$nextTick();
    const userCheckbox = wrapper.findAll(".series-toggle input")[0].element as HTMLInputElement;
    expect(userCheckbox.checked).toBe(false);

    pressKey("u");
    await wrapper.vm.$nextTick();
    expect(userCheckbox.checked).toBe(true);
  });

  it("key h toggles host actor off then on", async () => {
    pressKey("h");
    await wrapper.vm.$nextTick();
    const hostCheckbox = wrapper.findAll(".series-toggle input")[1].element as HTMLInputElement;
    expect(hostCheckbox.checked).toBe(false);

    pressKey("h");
    await wrapper.vm.$nextTick();
    expect(hostCheckbox.checked).toBe(true);
  });

  it("does not toggle when only one actor remains", async () => {
    pressKey("h");
    await wrapper.vm.$nextTick();
    pressKey("u");
    await wrapper.vm.$nextTick();
    const userCheckbox = wrapper.findAll(".series-toggle input")[0].element as HTMLInputElement;
    expect(userCheckbox.checked).toBe(true);
  });

  it("ignores shortcuts when focus is on a select element", async () => {
    const select = wrapper.find(".picker-select").element;
    pressKey("2", select);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".segment:nth-child(1)").classes()).toContain("active");

    pressKey("u", select);
    await wrapper.vm.$nextTick();
    const userCheckbox = wrapper.findAll(".series-toggle input")[0].element as HTMLInputElement;
    expect(userCheckbox.checked).toBe(true);

    pressKey("h", select);
    await wrapper.vm.$nextTick();
    const hostCheckbox = wrapper.findAll(".series-toggle input")[1].element as HTMLInputElement;
    expect(hostCheckbox.checked).toBe(true);
  });

  it("ignores shortcuts when focus is on an input element", async () => {
    const input = document.createElement("input");
    wrapper.element.appendChild(input);

    pressKey("3", input);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".segment:nth-child(1)").classes()).toContain("active");

    pressKey("u", input);
    await wrapper.vm.$nextTick();
    const userCheckbox = wrapper.findAll(".series-toggle input")[0].element as HTMLInputElement;
    expect(userCheckbox.checked).toBe(true);
  });
});
