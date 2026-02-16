import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import ContextMenu from "./ContextMenu.vue";

describe("ContextMenu", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("does not render when closed", () => {
    mount(ContextMenu, {
      props: {
        open: false,
        x: 100,
        y: 200,
        items: [{ label: "Test", action: "test" }],
      },
    });
    expect(document.body.querySelector(".context-menu")).toBeNull();
  });

  it("renders items when open", () => {
    mount(ContextMenu, {
      props: {
        open: true,
        x: 100,
        y: 200,
        items: [
          { label: "Edit", action: "edit" },
          { label: "Delete", action: "delete", danger: true },
        ],
      },
    });
    const menu = document.body.querySelector(".context-menu");
    expect(menu).not.toBeNull();
    expect(menu!.textContent).toContain("Edit");
    expect(menu!.textContent).toContain("Delete");
  });

  it("renders dividers", () => {
    mount(ContextMenu, {
      props: {
        open: true,
        x: 0,
        y: 0,
        items: [
          { label: "A", action: "a" },
          { label: "", action: "", divider: true },
          { label: "B", action: "b" },
        ],
      },
    });
    // Dividers are rendered as div elements (not buttons) between the button items
    const menu = document.body.querySelector(".context-menu");
    expect(menu).not.toBeNull();
    const buttons = menu!.querySelectorAll("button");
    expect(buttons.length).toBe(2); // A and B, divider is a div
    const divs = menu!.querySelectorAll("div");
    // There should be divider divs (at least the context-divider one)
    expect(divs.length).toBeGreaterThanOrEqual(1);
  });

  it("emits action on click", async () => {
    const wrapper = mount(ContextMenu, {
      props: {
        open: true,
        x: 0,
        y: 0,
        items: [{ label: "Do It", action: "do-it" }],
      },
    });
    const button = document.body.querySelector("button") as HTMLElement;
    expect(button).not.toBeNull();
    button.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("action")).toBeTruthy();
    expect(wrapper.emitted("action")![0]).toEqual(["do-it"]);
  });

  it("does not emit action for disabled items", async () => {
    const wrapper = mount(ContextMenu, {
      props: {
        open: true,
        x: 0,
        y: 0,
        items: [{ label: "Disabled", action: "nope", disabled: true }],
      },
    });
    const button = document.body.querySelector("button") as HTMLElement;
    expect(button).not.toBeNull();
    button.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("action")).toBeFalsy();
  });
});
