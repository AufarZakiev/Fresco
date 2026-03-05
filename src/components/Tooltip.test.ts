import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import Tooltip from "./Tooltip.vue";

describe("Tooltip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not show bubble initially", () => {
    mount(Tooltip, {
      props: { text: "Help text" },
      slots: { default: "<button>Hover me</button>" },
    });
    expect(document.body.querySelector(".tooltip-bubble")).toBeNull();
  });

  it("shows bubble after mouseenter + delay", async () => {
    const wrapper = mount(Tooltip, {
      props: { text: "Help text", delay: 0 },
      slots: { default: "<button>Hover me</button>" },
    });
    await wrapper.find(".tooltip-wrapper").trigger("mouseenter");
    vi.advanceTimersByTime(0);
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const bubble = document.body.querySelector(".tooltip-bubble");
    expect(bubble).not.toBeNull();
    expect(bubble!.textContent).toContain("Help text");
  });

  it("hides bubble on mouseleave", async () => {
    const wrapper = mount(Tooltip, {
      props: { text: "Help text", delay: 0 },
      slots: { default: "<button>Hover me</button>" },
    });
    await wrapper.find(".tooltip-wrapper").trigger("mouseenter");
    vi.advanceTimersByTime(0);
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    await wrapper.find(".tooltip-wrapper").trigger("mouseleave");
    await wrapper.vm.$nextTick();

    expect(document.body.querySelector(".tooltip-bubble")).toBeNull();
  });

  it("does not show when disabled", async () => {
    const wrapper = mount(Tooltip, {
      props: { text: "Help text", delay: 0, disabled: true },
      slots: { default: "<button>Hover me</button>" },
    });
    await wrapper.find(".tooltip-wrapper").trigger("mouseenter");
    vi.advanceTimersByTime(0);
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(document.body.querySelector(".tooltip-bubble")).toBeNull();
  });

  it("does not show when text is empty", async () => {
    const wrapper = mount(Tooltip, {
      props: { text: "", delay: 0 },
      slots: { default: "<button>Hover me</button>" },
    });
    await wrapper.find(".tooltip-wrapper").trigger("mouseenter");
    vi.advanceTimersByTime(0);
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(document.body.querySelector(".tooltip-bubble")).toBeNull();
  });

  it("bubble has role=tooltip", async () => {
    const wrapper = mount(Tooltip, {
      props: { text: "Accessible", delay: 0 },
      slots: { default: "<button>Hover me</button>" },
    });
    await wrapper.find(".tooltip-wrapper").trigger("mouseenter");
    vi.advanceTimersByTime(0);
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const bubble = document.body.querySelector("[role='tooltip']");
    expect(bubble).not.toBeNull();
  });

  it("sets aria-describedby on trigger element", () => {
    const wrapper = mount(Tooltip, {
      props: { text: "Description" },
      slots: { default: "<button>Trigger</button>" },
    });
    const trigger = wrapper.find("button");
    expect(trigger.attributes("aria-describedby")).toBeTruthy();
  });
});
