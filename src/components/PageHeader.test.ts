import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import PageHeader from "./PageHeader.vue";

describe("PageHeader", () => {
  it("renders the title", () => {
    const wrapper = mount(PageHeader, {
      props: { title: "Tasks" },
    });
    expect(wrapper.text()).toContain("Tasks");
    expect(wrapper.find(".page-title").text()).toBe("Tasks");
  });

  it("renders actions slot content", () => {
    const wrapper = mount(PageHeader, {
      props: { title: "Projects" },
      slots: {
        default: '<button class="test-btn">Add</button>',
      },
    });
    expect(wrapper.find(".page-actions .test-btn").exists()).toBe(true);
    expect(wrapper.text()).toContain("Add");
  });

  it("page-actions container exists for flex-wrap", () => {
    const wrapper = mount(PageHeader, {
      props: { title: "Test" },
    });
    const actions = wrapper.find(".page-actions");
    expect(actions.exists()).toBe(true);
  });
});
