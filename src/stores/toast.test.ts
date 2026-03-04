import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useToastStore } from "./toast";

describe("useToastStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with empty toasts", () => {
    const store = useToastStore();
    expect(store.toasts).toEqual([]);
  });

  it("show() adds a toast with correct type", () => {
    const store = useToastStore();
    store.show("Hello", "success");
    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0]).toMatchObject({
      message: "Hello",
      type: "success",
    });
  });

  it("show() defaults to info type", () => {
    const store = useToastStore();
    store.show("Info message");
    expect(store.toasts[0].type).toBe("info");
  });

  it("dismiss() removes a toast by id", () => {
    const store = useToastStore();
    store.show("First", "info", 0);
    store.show("Second", "info", 0);
    const idToRemove = store.toasts[0].id;
    store.dismiss(idToRemove);
    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0].message).toBe("Second");
  });

  it("auto-dismisses after duration", () => {
    const store = useToastStore();
    store.show("Auto", "info", 2000);
    expect(store.toasts).toHaveLength(1);
    vi.advanceTimersByTime(2000);
    expect(store.toasts).toHaveLength(0);
  });

  it("duration 0 does not auto-dismiss", () => {
    const store = useToastStore();
    store.show("Sticky", "error", 0);
    vi.advanceTimersByTime(10000);
    expect(store.toasts).toHaveLength(1);
  });
});
