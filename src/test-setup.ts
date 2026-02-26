// Test environment setup for Vitest + happy-dom.
//
// happy-dom v20 may not expose `localStorage` on `globalThis` as a full
// Storage-compatible object (the `clear` method can be missing). We replace
// it with a simple Map-backed implementation that satisfies the Storage
// interface used by the tests.

import { config } from "@vue/test-utils";
import i18n from "./i18n";

config.global.plugins = [i18n];

const _storage = new Map<string, string>();

Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string): string | null => _storage.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      _storage.set(key, String(value));
    },
    removeItem: (key: string): void => {
      _storage.delete(key);
    },
    clear: (): void => {
      _storage.clear();
    },
    get length(): number {
      return _storage.size;
    },
    key: (index: number): string | null =>
      [..._storage.keys()][index] ?? null,
  },
  writable: true,
  configurable: true,
});
