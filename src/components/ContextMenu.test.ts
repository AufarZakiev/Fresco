import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import ContextMenu from "./ContextMenu.vue";

const baseItems = [
  { label: "Edit", action: "edit" },
  { label: "Delete", action: "delete", danger: true },
];

function mountMenu(
  propsOverride?: Record<string, unknown>,
) {
  return mount(ContextMenu, {
    props: {
      open: true,
      x: 100,
      y: 200,
      items: baseItems,
      ...propsOverride,
    },
  });
}

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
    mountMenu();
    const menu = document.body.querySelector(".context-menu");
    expect(menu).not.toBeNull();
    expect(menu!.textContent).toContain("Edit");
    expect(menu!.textContent).toContain("Delete");
  });

  it("renders dividers", () => {
    mountMenu({
      items: [
        { label: "A", action: "a" },
        { label: "", action: "", divider: true },
        { label: "B", action: "b" },
      ],
    });
    const menu = document.body.querySelector(".context-menu");
    expect(menu).not.toBeNull();
    const buttons = menu!.querySelectorAll("button");
    expect(buttons.length).toBe(2);
    const dividers = menu!.querySelectorAll("[role='separator']");
    expect(dividers.length).toBe(1);
  });

  it("emits action on click", async () => {
    const wrapper = mountMenu();
    const button = document.body.querySelector("button") as HTMLElement;
    expect(button).not.toBeNull();
    button.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("action")).toBeTruthy();
    expect(wrapper.emitted("action")![0]).toEqual(["edit"]);
  });

  it("does not emit action for disabled items", async () => {
    const wrapper = mountMenu({
      items: [{ label: "Disabled", action: "nope", disabled: true }],
    });
    const button = document.body.querySelector("button") as HTMLElement;
    expect(button).not.toBeNull();
    button.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("action")).toBeFalsy();
  });

  // --- ARIA attributes ---

  it("has role='menu' on container", () => {
    mountMenu();
    const menu = document.body.querySelector("[role='menu']");
    expect(menu).not.toBeNull();
  });

  it("has role='menuitem' on each button", () => {
    mountMenu();
    const items = document.body.querySelectorAll("[role='menuitem']");
    expect(items.length).toBe(2);
  });

  it("has role='separator' on dividers", () => {
    mountMenu({
      items: [
        { label: "A", action: "a" },
        { label: "", action: "", divider: true },
        { label: "B", action: "b" },
      ],
    });
    const separators = document.body.querySelectorAll("[role='separator']");
    expect(separators.length).toBe(1);
  });

  it("sets aria-disabled on disabled items", () => {
    mountMenu({
      items: [
        { label: "Ok", action: "ok" },
        { label: "Nope", action: "nope", disabled: true },
      ],
    });
    const items = document.body.querySelectorAll("[role='menuitem']");
    expect(items[0].getAttribute("aria-disabled")).toBeNull();
    expect(items[1].getAttribute("aria-disabled")).toBe("true");
  });

  // --- Keyboard navigation ---

  it("focuses first enabled item on open", async () => {
    const wrapper = mount(ContextMenu, {
      props: { open: false, x: 0, y: 0, items: baseItems },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const items = document.body.querySelectorAll("[role='menuitem']");
    expect(document.activeElement).toBe(items[0]);
  });

  it("skips disabled items when focusing on open", async () => {
    const wrapper = mount(ContextMenu, {
      props: {
        open: false,
        x: 0,
        y: 0,
        items: [
          { label: "Disabled", action: "d", disabled: true },
          { label: "Enabled", action: "e" },
        ],
      },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const items = document.body.querySelectorAll("[role='menuitem']");
    expect(document.activeElement).toBe(items[1]);
  });

  it("ArrowDown moves focus to next enabled item", async () => {
    const wrapper = mount(ContextMenu, {
      props: { open: false, x: 0, y: 0, items: baseItems },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    await wrapper.vm.$nextTick();

    const items = document.body.querySelectorAll("[role='menuitem']");
    expect(document.activeElement).toBe(items[1]);
  });

  it("ArrowDown wraps from last to first", async () => {
    const wrapper = mount(ContextMenu, {
      props: { open: false, x: 0, y: 0, items: baseItems },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    // Focus is on first item; ArrowDown twice wraps to first
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    await wrapper.vm.$nextTick();

    const items = document.body.querySelectorAll("[role='menuitem']");
    expect(document.activeElement).toBe(items[0]);
  });

  it("ArrowUp moves focus to previous enabled item", async () => {
    const wrapper = mount(ContextMenu, {
      props: { open: false, x: 0, y: 0, items: baseItems },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    // Focus starts on first; ArrowUp wraps to last
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    await wrapper.vm.$nextTick();

    const items = document.body.querySelectorAll("[role='menuitem']");
    expect(document.activeElement).toBe(items[1]);
  });

  it("Home moves focus to first enabled item", async () => {
    const wrapper = mount(ContextMenu, {
      props: { open: false, x: 0, y: 0, items: baseItems },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    // Move to second, then Home
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Home" }));
    await wrapper.vm.$nextTick();

    const items = document.body.querySelectorAll("[role='menuitem']");
    expect(document.activeElement).toBe(items[0]);
  });

  it("End moves focus to last enabled item", async () => {
    const wrapper = mount(ContextMenu, {
      props: { open: false, x: 0, y: 0, items: baseItems },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "End" }));
    await wrapper.vm.$nextTick();

    const items = document.body.querySelectorAll("[role='menuitem']");
    expect(document.activeElement).toBe(items[1]);
  });

  it("Escape emits close", async () => {
    const wrapper = mount(ContextMenu, {
      props: { open: false, x: 0, y: 0, items: baseItems },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("ArrowDown skips disabled items", async () => {
    const wrapper = mount(ContextMenu, {
      props: {
        open: false,
        x: 0,
        y: 0,
        items: [
          { label: "First", action: "first" },
          { label: "Disabled", action: "disabled", disabled: true },
          { label: "Third", action: "third" },
        ],
      },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    // Focus is on "First"; ArrowDown should skip "Disabled" and land on "Third"
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    await wrapper.vm.$nextTick();

    const items = document.body.querySelectorAll("[role='menuitem']");
    expect(document.activeElement).toBe(items[2]);
  });
});
