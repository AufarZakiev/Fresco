import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import StatusBadge from "./StatusBadge.vue";

describe("StatusBadge", () => {
  it("renders slot content", () => {
    const wrapper = mount(StatusBadge, {
      slots: { default: "Active" },
    });
    expect(wrapper.text()).toContain("Active");
  });

  it("applies default variant class", () => {
    const wrapper = mount(StatusBadge, {
      slots: { default: "Test" },
    });
    expect(wrapper.classes()).toContain("badge-default");
  });

  it("applies success variant class", () => {
    const wrapper = mount(StatusBadge, {
      props: { variant: "success" },
      slots: { default: "OK" },
    });
    expect(wrapper.classes()).toContain("badge-success");
  });

  it("applies warning variant class", () => {
    const wrapper = mount(StatusBadge, {
      props: { variant: "warning" },
      slots: { default: "Warn" },
    });
    expect(wrapper.classes()).toContain("badge-warning");
  });

  it("applies danger variant class", () => {
    const wrapper = mount(StatusBadge, {
      props: { variant: "danger" },
      slots: { default: "Error" },
    });
    expect(wrapper.classes()).toContain("badge-danger");
  });

  it("applies info variant class", () => {
    const wrapper = mount(StatusBadge, {
      props: { variant: "info" },
      slots: { default: "Info" },
    });
    expect(wrapper.classes()).toContain("badge-info");
  });
});
