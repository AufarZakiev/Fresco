import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useManagerSettingsStore } from "../stores/managerSettings";
import i18n from "../i18n";

// Mock Tauri notification plugin
const mockSendNotification = vi.fn();
const mockIsPermissionGranted = vi.fn().mockResolvedValue(true);
const mockRequestPermission = vi.fn().mockResolvedValue("granted");

vi.mock("@tauri-apps/plugin-notification", () => ({
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  isPermissionGranted: (...args: unknown[]) => mockIsPermissionGranted(...args),
  requestPermission: (...args: unknown[]) => mockRequestPermission(...args),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// happy-dom v20 localStorage is broken (no getItem/setItem/clear/removeItem).
// Polyfill with a simple Map-backed implementation for this test file.
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  get length() { return storage.size; },
  key: (i: number) => [...storage.keys()][i] ?? null,
};
vi.stubGlobal("localStorage", localStorageMock);

let notifyNewNotices: (count: number) => Promise<void>;
let notifyConnectionLost: () => Promise<void>;

const LAST_REMINDER_KEY = "boinc-last-reminder";

describe("useNotifications", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    storage.clear();
    vi.clearAllMocks();

    const mod = await import("./useNotifications");
    notifyNewNotices = mod.notifyNewNotices;
    notifyConnectionLost = mod.notifyConnectionLost;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("notifyNewNotices", () => {
    it("sends notification when count > 0 and frequency allows", async () => {
      const store = useManagerSettingsStore();
      store.settings.reminderFrequency = "always";

      await notifyNewNotices(3);

      const t = i18n.global.t;
      expect(mockSendNotification).toHaveBeenCalledOnce();
      expect(mockSendNotification).toHaveBeenCalledWith({
        title: t("notifications.newNoticesTitle"),
        body: t("notifications.newNoticesBody", 3),
      });
    });

    it("uses singular message for count=1", async () => {
      const store = useManagerSettingsStore();
      store.settings.reminderFrequency = "always";

      await notifyNewNotices(1);

      const t = i18n.global.t;
      expect(mockSendNotification).toHaveBeenCalledWith({
        title: t("notifications.newNoticesTitle"),
        body: t("notifications.newNoticesBody", 1),
      });
    });

    it("does not send when count is 0", async () => {
      const store = useManagerSettingsStore();
      store.settings.reminderFrequency = "always";

      await notifyNewNotices(0);
      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it("does not send when count is negative", async () => {
      const store = useManagerSettingsStore();
      store.settings.reminderFrequency = "always";

      await notifyNewNotices(-1);
      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it("does not send when frequency is 'never'", async () => {
      const store = useManagerSettingsStore();
      store.settings.reminderFrequency = "never";

      await notifyNewNotices(5);
      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it("respects time-based frequency ('1h')", async () => {
      const store = useManagerSettingsStore();
      store.settings.reminderFrequency = "1h";

      // First call — should send (no previous reminder)
      await notifyNewNotices(1);
      expect(mockSendNotification).toHaveBeenCalledOnce();

      // Second call immediately — should NOT send (within 1h window)
      mockSendNotification.mockClear();
      await notifyNewNotices(1);
      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it("sends again after enough time has passed", async () => {
      const store = useManagerSettingsStore();
      store.settings.reminderFrequency = "1h";

      // Simulate a notification sent 2 hours ago
      const twoHoursAgo = Date.now() - 2 * 3600_000;
      storage.set(LAST_REMINDER_KEY, String(twoHoursAgo));

      await notifyNewNotices(1);
      expect(mockSendNotification).toHaveBeenCalledOnce();
    });

    it("records last notification time in localStorage", async () => {
      const store = useManagerSettingsStore();
      store.settings.reminderFrequency = "always";

      const before = Date.now();
      await notifyNewNotices(1);
      const after = Date.now();

      const stored = Number(storage.get(LAST_REMINDER_KEY));
      expect(stored).toBeGreaterThanOrEqual(before);
      expect(stored).toBeLessThanOrEqual(after);
    });

    it("requests permission if not granted", async () => {
      const store = useManagerSettingsStore();
      store.settings.reminderFrequency = "always";
      mockIsPermissionGranted.mockResolvedValueOnce(false);

      await notifyNewNotices(1);

      expect(mockRequestPermission).toHaveBeenCalledOnce();
      expect(mockSendNotification).toHaveBeenCalledOnce();
    });

    it("does not send if permission denied", async () => {
      const store = useManagerSettingsStore();
      store.settings.reminderFrequency = "always";
      mockIsPermissionGranted.mockResolvedValueOnce(false);
      mockRequestPermission.mockResolvedValueOnce("denied");

      await notifyNewNotices(1);

      expect(mockSendNotification).not.toHaveBeenCalled();
    });
  });

  describe("notifyConnectionLost", () => {
    it("sends connection lost notification", async () => {
      await notifyConnectionLost();

      const t = i18n.global.t;
      expect(mockSendNotification).toHaveBeenCalledWith({
        title: t("notifications.connectionLostTitle"),
        body: t("notifications.connectionLostBody"),
      });
    });
  });

  describe("frequency mapping", () => {
    it("'always' sends even if just notified", async () => {
      const store = useManagerSettingsStore();
      store.settings.reminderFrequency = "always";
      storage.set(LAST_REMINDER_KEY, String(Date.now()));

      await notifyNewNotices(1);
      expect(mockSendNotification).toHaveBeenCalledOnce();
    });

    it("'1d' blocks within 24 hours", async () => {
      const store = useManagerSettingsStore();
      store.settings.reminderFrequency = "1d";
      // 12 hours ago — within 24h window
      storage.set(LAST_REMINDER_KEY, String(Date.now() - 12 * 3600_000));

      await notifyNewNotices(1);
      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it("'1w' blocks within 7 days", async () => {
      const store = useManagerSettingsStore();
      store.settings.reminderFrequency = "1w";
      // 3 days ago — within 7d window
      storage.set(LAST_REMINDER_KEY, String(Date.now() - 3 * 86400_000));

      await notifyNewNotices(1);
      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it("unknown frequency defaults to 1d behavior", async () => {
      const store = useManagerSettingsStore();
      store.settings.reminderFrequency = "unknown_value";
      // 12 hours ago — within 24h (default) window
      storage.set(LAST_REMINDER_KEY, String(Date.now() - 12 * 3600_000));

      await notifyNewNotices(1);
      expect(mockSendNotification).not.toHaveBeenCalled();
    });
  });
});
