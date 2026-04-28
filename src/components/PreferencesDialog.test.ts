import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import PreferencesDialog from "./PreferencesDialog.vue";
import { usePreferencesStore } from "../stores/preferences";
import { mockPreferences } from "../mocks/data/preferences";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("./PrefSourcePopover.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("./ProxySettingsDialog.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("./ExclusiveAppsDialog.vue", () => ({
  default: {
    template: "<div />",
    methods: { prefetch() {} },
  },
}));

vi.mock("./TimeRangeSlider.vue", () => ({
  default: { template: "<div />", props: ["startHour", "endHour", "label"] },
}));

vi.mock("@vueuse/integrations/useFocusTrap", () => ({
  useFocusTrap: () => ({ activate: vi.fn(), deactivate: vi.fn() }),
}));

const TAB_NAMES = ["computing", "network", "storage", "schedule", "manager"];

function queryTabs(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll('[role="tab"]'));
}

function queryTabPanels(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll('[role="tabpanel"]'));
}

function queryVisibleTabPanel(): HTMLElement | null {
  return (
    queryTabPanels().find((panel) => panel.style.display !== "none") ?? null
  );
}

describe("PreferencesDialog ARIA tabs", () => {
  let wrapper: VueWrapper;

  beforeEach(async () => {
    document.body.textContent = "";
    setActivePinia(createPinia());

    const store = usePreferencesStore();
    store.prefetched = true;
    store.prefs = { ...mockPreferences };

    wrapper = mount(PreferencesDialog, {
      props: { open: false },
      attachTo: document.body,
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
  });

  afterEach(() => {
    wrapper.unmount();
  });

  it("renders tablist with correct role", () => {
    const tablist = document.body.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();
    expect(tablist!.getAttribute("aria-label")).toBeTruthy();
  });

  it("renders 5 tabs with role=tab", () => {
    const tabs = queryTabs();
    expect(tabs).toHaveLength(5);
    tabs.forEach((tab) => {
      expect(tab.getAttribute("role")).toBe("tab");
    });
  });

  it("each tab has id, aria-selected, and aria-controls", () => {
    const tabs = queryTabs();
    tabs.forEach((tab, i) => {
      expect(tab.id).toBe(`tab-${TAB_NAMES[i]}`);
      expect(tab.getAttribute("aria-controls")).toBe(
        `tabpanel-${TAB_NAMES[i]}`,
      );
      expect(tab.getAttribute("aria-selected")).toBe(
        i === 0 ? "true" : "false",
      );
    });
  });

  it("only active tab has tabindex=0, others have -1", () => {
    const tabs = queryTabs();
    expect(tabs[0].getAttribute("tabindex")).toBe("0");
    for (let i = 1; i < tabs.length; i++) {
      expect(tabs[i].getAttribute("tabindex")).toBe("-1");
    }
  });

  it("renders all 5 tabpanels (v-show keeps them in DOM)", () => {
    const panels = queryTabPanels();
    expect(panels).toHaveLength(5);
    panels.forEach((panel, i) => {
      expect(panel.id).toBe(`tabpanel-${TAB_NAMES[i]}`);
      expect(panel.getAttribute("aria-labelledby")).toBe(`tab-${TAB_NAMES[i]}`);
      expect(panel.getAttribute("tabindex")).toBe("0");
    });
  });

  it("only the active tabpanel is visible", () => {
    const visible = queryVisibleTabPanel();
    expect(visible).not.toBeNull();
    expect(visible!.id).toBe("tabpanel-computing");
  });

  it("clicking a tab updates aria-selected and tabpanel", async () => {
    const tabs = queryTabs();
    await tabs[1].click();
    await flushPromises();

    const updatedTabs = queryTabs();
    expect(updatedTabs[0].getAttribute("aria-selected")).toBe("false");
    expect(updatedTabs[1].getAttribute("aria-selected")).toBe("true");

    const panel = queryVisibleTabPanel();
    expect(panel!.id).toBe("tabpanel-network");
  });

  it("ArrowRight moves to next tab", async () => {
    const tabs = queryTabs();
    tabs[0].focus();
    tabs[0].dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPromises();

    const updatedTabs = queryTabs();
    expect(updatedTabs[1].getAttribute("aria-selected")).toBe("true");
    expect(updatedTabs[0].getAttribute("aria-selected")).toBe("false");
  });

  it("ArrowLeft wraps from first to last tab", async () => {
    const tabs = queryTabs();
    tabs[0].focus();
    tabs[0].dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPromises();

    const updatedTabs = queryTabs();
    expect(updatedTabs[4].getAttribute("aria-selected")).toBe("true");
  });

  it("ArrowRight wraps from last to first tab", async () => {
    const tabs = queryTabs();
    await tabs[4].click();
    await flushPromises();

    const lastTab = queryTabs()[4];
    lastTab.focus();
    lastTab.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPromises();

    const updatedTabs = queryTabs();
    expect(updatedTabs[0].getAttribute("aria-selected")).toBe("true");
  });

  it("Home moves to first tab", async () => {
    const tabs = queryTabs();
    await tabs[2].click();
    await flushPromises();

    const middleTab = queryTabs()[2];
    middleTab.focus();
    middleTab.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Home",
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPromises();

    const updatedTabs = queryTabs();
    expect(updatedTabs[0].getAttribute("aria-selected")).toBe("true");
  });

  it("End moves to last tab", async () => {
    const tabs = queryTabs();
    tabs[0].focus();
    tabs[0].dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "End",
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPromises();

    const updatedTabs = queryTabs();
    expect(updatedTabs[4].getAttribute("aria-selected")).toBe("true");
    expect(queryVisibleTabPanel()!.id).toBe("tabpanel-manager");
  });

  it("tab panel changes when navigating with arrows", async () => {
    const tabs = queryTabs();
    tabs[0].focus();

    // ArrowRight twice -> storage
    tabs[0].dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPromises();
    queryTabs()[1].dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPromises();

    expect(queryVisibleTabPanel()!.id).toBe("tabpanel-storage");
  });
});

describe("PreferencesDialog Schedule per-day toggle", () => {
  let wrapper: VueWrapper;

  beforeEach(async () => {
    document.body.textContent = "";
    localStorage.clear();
    setActivePinia(createPinia());

    const store = usePreferencesStore();
    store.prefetched = true;
    store.prefs = { ...mockPreferences };
  });

  afterEach(() => {
    wrapper?.unmount();
    localStorage.clear();
  });

  it("starts collapsed by default and persists open state", async () => {
    wrapper = mount(PreferencesDialog, {
      props: { open: false },
      attachTo: document.body,
    });
    await wrapper.setProps({ open: true });
    await flushPromises();

    const toggle = document.body.querySelector(
      "[data-testid='per-day-toggle']",
    ) as HTMLElement;
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    toggle.click();
    await flushPromises();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(localStorage.getItem("fresco.schedulePrefs.perDayExpanded")).toBe(
      "true",
    );

    toggle.click();
    await flushPromises();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(localStorage.getItem("fresco.schedulePrefs.perDayExpanded")).toBe(
      "false",
    );
  });

  it("restores expanded state from localStorage on mount", async () => {
    localStorage.setItem("fresco.schedulePrefs.perDayExpanded", "true");

    wrapper = mount(PreferencesDialog, {
      props: { open: false },
      attachTo: document.body,
    });
    await wrapper.setProps({ open: true });
    await flushPromises();

    const toggle = document.body.querySelector(
      "[data-testid='per-day-toggle']",
    ) as HTMLElement;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });
});
