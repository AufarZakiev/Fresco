/**
 * Installs Tauri IPC mocks for browser-only mode.
 * Called from main.ts when window.__TAURI_INTERNALS__ is absent.
 */
import { mockWindows, mockIPC } from "@tauri-apps/api/mocks";
import { handleIpc } from "./handler";

export function installMocks(): void {
  // mockWindows must be called before any getCurrentWebviewWindow() usage
  mockWindows("main");

  // Intercept all invoke() calls
  mockIPC((cmd, payload) => handleIpc(cmd, payload));

  console.info("[fresco] IPC mocks installed — running in browser mode");
}
