import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import PageHeader from "./PageHeader.vue";

describe("PageHeader", () => {
  it("renders actions slot content", () => {
    const wrapper = mount(PageHeader, {
      slots: {
        default: '<button class="test-btn">Add</button>',
      },
    });
    expect(wrapper.find(".page-actions .test-btn").exists()).toBe(true);
    expect(wrapper.text()).toContain("Add");
  });

  it("page-actions container exists for flex-wrap", () => {
    const wrapper = mount(PageHeader);
    const actions = wrapper.find(".page-actions");
    expect(actions.exists()).toBe(true);
  });
});
