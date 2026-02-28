import { describe, it, expect } from "vitest";
import { getSuspendReasonText, getSuspendReasonList } from "./useSuspendReasons";

describe("useSuspendReasons", () => {
  it("returns empty string for reason 0", () => {
    expect(getSuspendReasonText(0)).toBe("");
  });

  it("returns empty array for reason 0", () => {
    expect(getSuspendReasonList(0)).toEqual([]);
  });

  it("returns single reason", () => {
    expect(getSuspendReasonText(1)).toBe("On batteries");
    expect(getSuspendReasonText(2)).toBe("User active");
    expect(getSuspendReasonText(4)).toBe("Suspended by user");
  });

  it("returns multiple reasons for combined bitmask", () => {
    // 1 + 2 = 3 (BATTERIES + USER_ACTIVE)
    const text = getSuspendReasonText(3);
    expect(text).toContain("On batteries");
    expect(text).toContain("User active");
  });

  it("returns list for combined bitmask", () => {
    const list = getSuspendReasonList(5); // 1 + 4 = BATTERIES + USER_REQ
    expect(list).toContain("On batteries");
    expect(list).toContain("Suspended by user");
    expect(list).toHaveLength(2);
  });

  it("handles all known reason bits", () => {
    // All bits: 1+2+4+8+16+32+64+128+256+512+1024+2048+4096 = 8191
    const list = getSuspendReasonList(8191);
    expect(list).toHaveLength(13);
  });

  it("ignores unknown bits", () => {
    // 8192 is not a known reason
    const list = getSuspendReasonList(8192);
    expect(list).toHaveLength(0);
  });
});
