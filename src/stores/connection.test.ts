import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useConnectionStore } from "./connection";
import { CONNECTION_STATE } from "../types/boinc";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

describe("useConnectionStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it("starts disconnected", () => {
    const store = useConnectionStore();
    expect(store.state).toBe(CONNECTION_STATE.DISCONNECTED);
    expect(store.error).toBeNull();
  });

  it("connects locally on success", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const store = useConnectionStore();
    await store.connectToLocal("C:\\ProgramData\\BOINC");

    expect(mockInvoke).toHaveBeenCalledWith("connect_local", {
      dataDir: "C:\\ProgramData\\BOINC",
    });
    expect(store.state).toBe(CONNECTION_STATE.CONNECTED);
    expect(store.error).toBeNull();
  });

  it("handles auth error", async () => {
    mockInvoke.mockRejectedValueOnce("Authentication failed");

    const store = useConnectionStore();
    await store.connectToLocal("/var/lib/boinc-client");

    expect(store.state).toBe(CONNECTION_STATE.AUTH_ERROR);
    expect(store.error).toBe("Authentication failed");
  });

  it("handles connection error", async () => {
    mockInvoke.mockRejectedValueOnce("Connection refused");

    const store = useConnectionStore();
    await store.connectToLocal("/var/lib/boinc-client");

    expect(store.state).toEqual({ Error: "Connection refused" });
    expect(store.error).toBe("Connection refused");
  });

  it("disconnects cleanly", async () => {
    mockInvoke.mockResolvedValue(undefined);

    const store = useConnectionStore();
    await store.connectToLocal("C:\\ProgramData\\BOINC");
    expect(store.state).toBe(CONNECTION_STATE.CONNECTED);

    await store.disconnect();
    expect(store.state).toBe(CONNECTION_STATE.DISCONNECTED);
    expect(store.error).toBeNull();
  });

  it("connects to remote host", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const store = useConnectionStore();
    await store.connectToRemote("192.168.1.100", 31416, "secret");

    expect(mockInvoke).toHaveBeenCalledWith("connect", {
      host: "192.168.1.100",
      port: 31416,
      password: "secret",
    });
    expect(store.state).toBe(CONNECTION_STATE.CONNECTED);
  });
});
