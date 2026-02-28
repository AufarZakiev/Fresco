import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import PrefNumericInput from "./PrefNumericInput.vue";
import { usePreferencesStore } from "../stores/preferences";
import type { GlobalPreferences } from "../types/boinc";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("./PrefSourcePopover.vue", () => ({
  default: { template: "<div />" },
}));

// max_ncpus_pct: BOINC default = 100, nonzero — good for override/file tests
const FIELD = "max_ncpus_pct" as keyof GlobalPreferences;
// max_bytes_sec_down: BOINC default = 0 — needed for zero-display tests
const FIELD_ZERO_DEFAULT = "max_bytes_sec_down" as keyof GlobalPreferences;

function mountNumeric(
  modelValue: number,
  extra: { zeroLabel?: string; field?: keyof GlobalPreferences } = {},
) {
  const { field = FIELD, ...rest } = extra;
  return mount(PrefNumericInput, {
    props: { modelValue, label: "CPU limit", field, ...rest },
  });
}

describe("PrefNumericInput", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders the label", () => {
    const wrapper = mountNumeric(50);
    expect(wrapper.text()).toContain("CPU limit");
  });

  it("shows current value in the input", () => {
    const wrapper = mountNumeric(75);
    const input = wrapper.find("input");
    expect(input.element.value).toBe("75");
  });

  // In PrefNumericInput, modelValue=0 means "no override" — the component falls back
  // to store effective value or BOINC default. For fields with BOINC default=0 (e.g.
  // max_bytes_sec_down), effectiveValue=0 and displayValue is empty string.
  it("shows empty string when value is 0 and BOINC default is also 0", () => {
    const wrapper = mountNumeric(0, { field: FIELD_ZERO_DEFAULT });
    const input = wrapper.find("input");
    expect(input.element.value).toBe("");
  });

  it("shows zeroLabel as placeholder when value is 0 and BOINC default is 0", () => {
    const wrapper = mountNumeric(0, { field: FIELD_ZERO_DEFAULT, zeroLabel: "Unlimited" });
    const input = wrapper.find("input");
    expect(input.element.placeholder).toBe("Unlimited");
  });

  it("emits update:modelValue when input changes", async () => {
    const wrapper = mountNumeric(50);
    await wrapper.find("input").setValue("80");
    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeTruthy();
    expect(emitted![0][0]).toBe(80);
  });

  describe("sourceType", () => {
    // modelValue=0 means "no override" — sourceType is 'initial'
    it("is 'initial' when modelValue is 0 (sentinel for no override)", () => {
      const wrapper = mountNumeric(0);
      expect(wrapper.find(".source-dot").classes()).toContain("initial");
    });

    it("is 'override' when value differs from default and no file value", () => {
      const wrapper = mountNumeric(50);
      expect(wrapper.find(".source-dot").classes()).toContain("override");
    });

    it("is 'file' when value matches file preference", () => {
      const store = usePreferencesStore();
      store.filePrefs = { max_ncpus_pct: 50 } as GlobalPreferences;
      const wrapper = mountNumeric(50);
      expect(wrapper.find(".source-dot").classes()).toContain("file");
    });

    it("is 'override' when value differs from both default and file", () => {
      const store = usePreferencesStore();
      store.filePrefs = { max_ncpus_pct: 75 } as GlobalPreferences;
      // value=50 differs from both file(75) and default(100)
      const wrapper = mountNumeric(50);
      expect(wrapper.find(".source-dot").classes()).toContain("override");
    });
  });
});
