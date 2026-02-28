import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import PrefToggleSwitch from "./PrefToggleSwitch.vue";
import { usePreferencesStore } from "../stores/preferences";
import type { GlobalPreferences } from "../types/boinc";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// PrefSourcePopover is a complex popover - stub it out
vi.mock("./PrefSourcePopover.vue", () => ({
  default: { template: "<div />" },
}));

const FIELD = "run_if_user_active" as keyof GlobalPreferences; // default: true

function mountToggle(modelValue: boolean) {
  return mount(PrefToggleSwitch, {
    props: { modelValue, label: "Test label", field: FIELD },
  });
}

describe("PrefToggleSwitch", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders the label", () => {
    const wrapper = mountToggle(true);
    expect(wrapper.text()).toContain("Test label");
  });

  it("toggle-switch has on class when modelValue is true", () => {
    const wrapper = mountToggle(true);
    expect(wrapper.find(".toggle-switch").classes()).toContain("on");
  });

  it("toggle-switch does not have on class when modelValue is false", () => {
    const wrapper = mountToggle(false);
    expect(wrapper.find(".toggle-switch").classes()).not.toContain("on");
  });

  it("emits update:modelValue with toggled value on click", async () => {
    const wrapper = mountToggle(false);
    await wrapper.find(".toggle-switch").trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([[true]]);
  });

  it("emits update:modelValue on Enter key", async () => {
    const wrapper = mountToggle(true);
    await wrapper.find(".toggle-switch").trigger("keydown.enter");
    expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
  });

  it("emits update:modelValue on Space key", async () => {
    const wrapper = mountToggle(false);
    await wrapper.find(".toggle-switch").trigger("keydown.space");
    expect(wrapper.emitted("update:modelValue")).toEqual([[true]]);
  });

  it("toggle-switch has role=button and tabindex=0", () => {
    const wrapper = mountToggle(false);
    const toggle = wrapper.find(".toggle-switch");
    expect(toggle.attributes("role")).toBe("button");
    expect(toggle.attributes("tabindex")).toBe("0");
  });

  describe("sourceType", () => {
    it("is 'initial' when value matches BOINC default and no file override", () => {
      // run_if_user_active default is true
      const wrapper = mountToggle(true);
      expect(wrapper.find(".source-dot").classes()).toContain("initial");
    });

    it("is 'override' when value differs from BOINC default", () => {
      // run_if_user_active default is true; set to false → override
      const wrapper = mountToggle(false);
      expect(wrapper.find(".source-dot").classes()).toContain("override");
    });

    it("is 'file' when value matches file preference value", () => {
      const store = usePreferencesStore();
      store.filePrefs = { run_if_user_active: false } as GlobalPreferences;
      // value=false matches filePrefs.run_if_user_active=false → file
      const wrapper = mountToggle(false);
      expect(wrapper.find(".source-dot").classes()).toContain("file");
    });
  });
});
