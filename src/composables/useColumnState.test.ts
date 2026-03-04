import { describe, it, expect, beforeEach } from "vitest";
import { nextTick } from "vue";
import { useColumnState } from "./useColumnState";
import { SORT_DIR } from "../types/boinc";

const VIEW_ID = "test-view";
const STORAGE_KEY = `boinc-columns-${VIEW_ID}`;
const DEFAULT_KEYS = ["name", "status", "progress"];
const DEFAULT_SORT_KEY = "name";

describe("useColumnState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── Defaults ────────────────────────────────────────────────────

  it("returns defaults when localStorage is empty", () => {
    const { visibleKeys, sortKey, sortDir } = useColumnState(
      VIEW_ID,
      DEFAULT_KEYS,
      DEFAULT_SORT_KEY,
    );

    expect(visibleKeys.value).toEqual(DEFAULT_KEYS);
    expect(sortKey.value).toBe(DEFAULT_SORT_KEY);
    expect(sortDir.value).toBe(SORT_DIR.ASC);
  });

  it("defaults sortDir to ASC when not specified", () => {
    const { sortDir } = useColumnState(VIEW_ID, DEFAULT_KEYS, DEFAULT_SORT_KEY);
    expect(sortDir.value).toBe(SORT_DIR.ASC);
  });

  it("accepts explicit default sortDir", () => {
    const { sortDir } = useColumnState(
      VIEW_ID,
      DEFAULT_KEYS,
      DEFAULT_SORT_KEY,
      SORT_DIR.DESC,
    );
    expect(sortDir.value).toBe(SORT_DIR.DESC);
  });

  // ── Restore from localStorage ──────────────────────────────────

  it("restores persisted state from localStorage", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        visibleKeys: ["status"],
        sortKey: "progress",
        sortDir: SORT_DIR.DESC,
      }),
    );

    const { visibleKeys, sortKey, sortDir } = useColumnState(
      VIEW_ID,
      DEFAULT_KEYS,
      DEFAULT_SORT_KEY,
    );

    expect(visibleKeys.value).toEqual(["status"]);
    expect(sortKey.value).toBe("progress");
    expect(sortDir.value).toBe(SORT_DIR.DESC);
  });

  it("falls back to defaults for missing fields in stored data", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sortKey: "progress" }));

    const { visibleKeys, sortKey, sortDir } = useColumnState(
      VIEW_ID,
      DEFAULT_KEYS,
      DEFAULT_SORT_KEY,
    );

    expect(visibleKeys.value).toEqual(DEFAULT_KEYS);
    expect(sortKey.value).toBe("progress");
    expect(sortDir.value).toBe(SORT_DIR.ASC);
  });

  it("returns defaults when localStorage contains corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not-json!!!");

    const { visibleKeys, sortKey, sortDir } = useColumnState(
      VIEW_ID,
      DEFAULT_KEYS,
      DEFAULT_SORT_KEY,
    );

    expect(visibleKeys.value).toEqual(DEFAULT_KEYS);
    expect(sortKey.value).toBe(DEFAULT_SORT_KEY);
    expect(sortDir.value).toBe(SORT_DIR.ASC);
  });

  // ── Persistence ────────────────────────────────────────────────

  it("persists visibleKeys changes to localStorage", async () => {
    const { visibleKeys } = useColumnState(
      VIEW_ID,
      DEFAULT_KEYS,
      DEFAULT_SORT_KEY,
    );

    visibleKeys.value = ["name", "status"];
    await nextTick();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.visibleKeys).toEqual(["name", "status"]);
  });

  it("persists sortKey changes to localStorage", async () => {
    const { sortKey } = useColumnState(
      VIEW_ID,
      DEFAULT_KEYS,
      DEFAULT_SORT_KEY,
    );

    sortKey.value = "progress";
    await nextTick();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.sortKey).toBe("progress");
  });

  it("persists sortDir changes to localStorage", async () => {
    const { sortDir } = useColumnState(
      VIEW_ID,
      DEFAULT_KEYS,
      DEFAULT_SORT_KEY,
    );

    sortDir.value = SORT_DIR.DESC;
    await nextTick();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.sortDir).toBe(SORT_DIR.DESC);
  });

  // ── Isolation ──────────────────────────────────────────────────

  it("uses viewId-specific storage key", async () => {
    const { sortKey: sortA } = useColumnState(
      "view-a",
      DEFAULT_KEYS,
      "name",
    );
    const { sortKey: sortB } = useColumnState(
      "view-b",
      DEFAULT_KEYS,
      "status",
    );

    sortA.value = "progress";
    await nextTick();

    expect(localStorage.getItem("boinc-columns-view-a")).toBeTruthy();
    expect(localStorage.getItem("boinc-columns-view-b")).toBeNull();
    expect(sortB.value).toBe("status");
  });

  // ── Returned refs are independent copies ───────────────────────

  it("does not mutate default arrays when localStorage is empty", () => {
    const defaults = ["a", "b", "c"];
    const { visibleKeys } = useColumnState(VIEW_ID, defaults, "a");

    visibleKeys.value.push("d");

    expect(defaults).toEqual(["a", "b", "c"]);
  });

  it("does not mutate default arrays when restoring partial stored data", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sortKey: "b" }));
    const defaults = ["a", "b", "c"];
    const { visibleKeys } = useColumnState(VIEW_ID, defaults, "a");

    visibleKeys.value.push("d");

    expect(defaults).toEqual(["a", "b", "c"]);
  });
});
