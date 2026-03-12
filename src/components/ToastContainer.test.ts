import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import ToastContainer from "./ToastContainer.vue";
import { useToastStore } from "../stores/toast";

describe("ToastContainer", () => {
  beforeEach(() => {
    document.body
      .querySelectorAll(".toast-container")
      .forEach((el) => el.remove());
    setActivePinia(createPinia());
  });

  it("renders empty when no toasts", () => {
    mount(ToastContainer);
    const container = document.body.querySelector(".toast-container");
    expect(container).not.toBeNull();
    const toasts = document.body.querySelectorAll(".toast");
    expect(toasts).toHaveLength(0);
  });

  it("renders toast with message", async () => {
    const store = useToastStore();
    const wrapper = mount(ToastContainer);
    store.show("Hello world", "info", 0);
    await wrapper.vm.$nextTick();
    const container = document.body.querySelector(".toast-container");
    expect(container!.textContent).toContain("Hello world");
  });

  it("has aria-live=polite on container", () => {
    mount(ToastContainer);
    const container = document.body.querySelector(".toast-container");
    expect(container!.getAttribute("aria-live")).toBe("polite");
  });

  it("has role=status on individual toasts", async () => {
    const store = useToastStore();
    const wrapper = mount(ToastContainer);
    store.show("Test toast", "info", 0);
    await wrapper.vm.$nextTick();
    const toast = document.body.querySelector(".toast");
    expect(toast!.getAttribute("role")).toBe("status");
  });

  it("renders success toast with checkmark icon", async () => {
    const store = useToastStore();
    const wrapper = mount(ToastContainer);
    store.show("Success!", "success", 0);
    await wrapper.vm.$nextTick();
    const toast = document.body.querySelector(".toast-success");
    expect(toast).not.toBeNull();
    const icon = toast!.querySelector(".toast-icon");
    expect(icon!.textContent).toContain("\u2713");
  });

  it("renders error toast with cross icon", async () => {
    const store = useToastStore();
    const wrapper = mount(ToastContainer);
    store.show("Error!", "error", 0);
    await wrapper.vm.$nextTick();
    const toast = document.body.querySelector(".toast-error");
    expect(toast).not.toBeNull();
    const icon = toast!.querySelector(".toast-icon");
    expect(icon!.textContent).toContain("\u2717");
  });

  it("dismisses toast on click", async () => {
    const store = useToastStore();
    const wrapper = mount(ToastContainer);
    store.show("Dismiss me", "info", 0);
    await wrapper.vm.$nextTick();
    const toast = document.body.querySelector(".toast") as HTMLElement;
    toast.click();
    await wrapper.vm.$nextTick();
    expect(store.toasts).toHaveLength(0);
  });

  it("auto-dismisses timed toast after duration", async () => {
    vi.useFakeTimers();
    try {
      const store = useToastStore();
      const wrapper = mount(ToastContainer);
      store.show("Auto dismiss", "info", 2000);
      await wrapper.vm.$nextTick();
      expect(store.toasts).toHaveLength(1);
      vi.advanceTimersByTime(2000);
      expect(store.toasts).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
