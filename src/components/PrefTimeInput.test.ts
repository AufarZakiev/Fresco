import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import PrefTimeInput from "./PrefTimeInput.vue";
import { usePreferencesStore } from "../stores/preferences";
import type { GlobalPreferences } from "../types/boinc";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("./PrefSourcePopover.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("./TimeClockPicker.vue", () => ({
  default: {
    props: ["modelValue", "placeholder", "dark", "accentColor"],
    template:
      '<input class="time-input" :value="modelValue" :placeholder="placeholder" />',
    emits: ["update:modelValue"],
  },
}));

// start_hour: BOINC default = 0 (sentinel for "no restriction")
const FIELD = "start_hour" as keyof GlobalPreferences;
// cpu_scheduling_period_minutes: BOINC default = 60 (non-zero)
const FIELD_NONZERO =
  "cpu_scheduling_period_minutes" as keyof GlobalPreferences;

function mountTimeInput(
  modelValue: number,
  extra: { zeroLabel?: string; field?: keyof GlobalPreferences } = {},
) {
  const { field = FIELD, ...rest } = extra;
  return mount(PrefTimeInput, {
    props: { modelValue, label: "Start time", field, ...rest },
  });
}

describe("PrefTimeInput", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders the label", () => {
    const wrapper = mountTimeInput(0);
    expect(wrapper.text()).toContain("Start time");
  });

  it("shows empty string for time when value is 0 (no override)", () => {
    // start_hour default=0, modelValue=0 → effectiveValue=0 → timeString=""
    const wrapper = mountTimeInput(0);
    const input = wrapper.find(".time-input");
    expect(input.attributes("value")).toBe("");
  });

  it("shows formatted time string when value is set", () => {
    // modelValue=8.5 → timeString="08:30"
    const wrapper = mountTimeInput(8.5);
    const input = wrapper.find(".time-input");
    expect(input.attributes("value")).toBe("08:30");
  });

  it("shows 23:59 for value >= 24", () => {
    const wrapper = mountTimeInput(24);
    const input = wrapper.find(".time-input");
    expect(input.attributes("value")).toBe("23:59");
  });

  it("shows zeroLabel as placeholder when value is 0 and zeroLabel is provided", () => {
    const wrapper = mountTimeInput(0, { zeroLabel: "All day" });
    const input = wrapper.find(".time-input");
    expect(input.attributes("placeholder")).toBe("All day");
  });

  it("shows 'Select time' as default placeholder when no zeroLabel and effectiveValue > 0", () => {
    // For a field with non-zero default (cpu_scheduling_period_minutes=60),
    // modelValue=0 → effectiveValue=60 (falls back to BOINC default) → not 0
    const wrapper = mountTimeInput(0, { field: FIELD_NONZERO });
    const input = wrapper.find(".time-input");
    expect(input.attributes("placeholder")).toBe("Select time");
  });

  describe("sourceType", () => {
    it("is 'initial' when modelValue is 0 (no override)", () => {
      const wrapper = mountTimeInput(0);
      expect(wrapper.find(".source-dot").classes()).toContain("initial");
    });

    it("is 'override' when modelValue is non-zero and no file value", () => {
      const wrapper = mountTimeInput(9);
      expect(wrapper.find(".source-dot").classes()).toContain("override");
    });

    it("is 'file' when modelValue matches file preference", () => {
      const store = usePreferencesStore();
      store.filePrefs = { start_hour: 9 } as GlobalPreferences;
      const wrapper = mountTimeInput(9);
      expect(wrapper.find(".source-dot").classes()).toContain("file");
    });

    it("is 'override' when modelValue differs from file value", () => {
      const store = usePreferencesStore();
      store.filePrefs = { start_hour: 6 } as GlobalPreferences;
      // modelValue=9 differs from file=6
      const wrapper = mountTimeInput(9);
      expect(wrapper.find(".source-dot").classes()).toContain("override");
    });
  });
});
