import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import {
  getOS,
  getArch,
  defaultDataDir,
  defaultClientDir,
  detectClientDir,
  platformAssetPattern,
} from "./usePlatform";

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("defaultDataDir", () => {
  it("returns Windows path for windows", () => {
    expect(defaultDataDir("windows")).toBe("C:\\ProgramData\\BOINC");
  });

  it("returns macOS path for macos", () => {
    expect(defaultDataDir("macos")).toBe(
      "/Library/Application Support/BOINC Data",
    );
  });

  it("returns Linux path for linux", () => {
    expect(defaultDataDir("linux")).toBe("/var/lib/boinc-client");
  });
});

describe("defaultClientDir", () => {
  it("returns Windows path for windows", () => {
    expect(defaultClientDir("windows")).toBe("C:\\Program Files\\BOINC");
  });

  it("returns macOS path for macos", () => {
    expect(defaultClientDir("macos")).toBe(
      "/Applications/BOINCManager.app/Contents/Resources",
    );
  });

  it("returns Linux path for linux", () => {
    expect(defaultClientDir("linux")).toBe("/usr/bin");
  });
});

describe("platformAssetPattern", () => {
  it("generates Windows x86_64 pattern", () => {
    expect(platformAssetPattern("windows", "x86_64")).toBe(
      "Windows_x86_64",
    );
  });

  it("generates macOS ARM64 pattern", () => {
    expect(platformAssetPattern("macos", "arm64")).toBe("macOS_ARM64");
  });

  it("generates Linux x86_64 pattern", () => {
    expect(platformAssetPattern("linux", "x86_64")).toBe("Linux_x86_64");
  });

  it("generates Linux ARM64 pattern", () => {
    expect(platformAssetPattern("linux", "arm64")).toBe("Linux_ARM64");
  });
});

describe("getOS", () => {
  it("invokes get_platform command", async () => {
    mockInvoke.mockResolvedValue("macos");
    const result = await getOS();
    expect(result).toBe("macos");
    expect(mockInvoke).toHaveBeenCalledWith("get_platform");
  });
});

describe("getArch", () => {
  it("invokes get_arch command", async () => {
    mockInvoke.mockResolvedValue("arm64");
    const result = await getArch();
    expect(result).toBe("arm64");
    expect(mockInvoke).toHaveBeenCalledWith("get_arch");
  });
});

describe("detectClientDir", () => {
  it("invokes detect_boinc_client_dir command", async () => {
    mockInvoke.mockResolvedValue("/usr/local/bin");
    const result = await detectClientDir();
    expect(result).toBe("/usr/local/bin");
    expect(mockInvoke).toHaveBeenCalledWith("detect_boinc_client_dir");
  });
});
