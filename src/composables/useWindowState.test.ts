import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick } from "vue";

const mockReplace = vi.fn().mockResolvedValue(undefined);
const afterEachCallbacks: ((to: { path: string }) => void)[] = [];

vi.mock("vue-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    afterEach: (cb: (to: { path: string }) => void) => {
      afterEachCallbacks.push(cb);
    },
  }),
}));

// Must import after mocks
import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { useWindowState } from "./useWindowState";

const STORAGE_KEY = "boinc-window-state";

function mountWithSetup(setup: () => void) {
  return mount(
    defineComponent({
      setup() {
        setup();
        return () => null;
      },
    }),
  );
}

describe("useWindowState", () => {
  beforeEach(() => {
    localStorage.clear();
    afterEachCallbacks.length = 0;
    mockReplace.mockClear();
  });

  it("restores last route from localStorage on mount", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lastRoute: "/projects" }));

    mountWithSetup(() => useWindowState());
    await nextTick();

    expect(mockReplace).toHaveBeenCalledWith("/projects");
  });

  it("defaults to /tasks when localStorage is empty", async () => {
    mountWithSetup(() => useWindowState());
    await nextTick();

    expect(mockReplace).toHaveBeenCalledWith("/tasks");
  });

  it("does not restore root path '/'", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lastRoute: "/" }));

    mountWithSetup(() => useWindowState());
    await nextTick();

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("saves route changes to localStorage", () => {
    mountWithSetup(() => useWindowState());

    const afterEach = afterEachCallbacks[afterEachCallbacks.length - 1];
    afterEach({ path: "/statistics" });

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.lastRoute).toBe("/statistics");
  });

  it("does not save root path to localStorage", () => {
    mountWithSetup(() => useWindowState());

    const afterEach = afterEachCallbacks[afterEachCallbacks.length - 1];
    afterEach({ path: "/" });

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("handles corrupt localStorage gracefully", async () => {
    localStorage.setItem(STORAGE_KEY, "not-json");

    mountWithSetup(() => useWindowState());
    await nextTick();

    // Falls back to /tasks
    expect(mockReplace).toHaveBeenCalledWith("/tasks");
  });
});
