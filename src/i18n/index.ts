import { createI18n } from "vue-i18n";
import en from "./locales/en.json";

export const SUPPORTED_LOCALES = [
  { code: "en", name: "English" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "pt_BR", name: "Português" },
  { code: "zh_CN", name: "中文" },
  { code: "ja", name: "日本語" },
  { code: "ru", name: "Русский" },
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]["code"];

const SUPPORTED_CODES: readonly string[] = SUPPORTED_LOCALES.map((l) => l.code);

// Widen messages type so dynamically-loaded locales are accepted
// without unsafe casts. Only "en" is bundled; others load on demand.
type MessageSchema = typeof en;
const i18n = createI18n({
  legacy: false,
  locale: "en",
  fallbackLocale: "en",
  messages: { en } as Record<string, MessageSchema>,
  missingWarn: import.meta.env.DEV,
  fallbackWarn: import.meta.env.DEV,
});

export default i18n;

/** Apply saved language setting on app startup. */
export async function applyStoredLocale(languageSetting: string) {
  const resolved = resolveLocale(languageSetting);
  if (resolved !== "en") {
    await loadLocale(resolved);
    i18n.global.locale.value = resolved;
  }
}

export async function loadLocale(locale: string) {
  if (i18n.global.availableLocales.includes(locale)) return;
  const messages = await import(`./locales/${locale}.json`);
  i18n.global.setLocaleMessage(locale, messages.default);
}

/**
 * Resolve "auto" to the best matching supported locale based on browser
 * language preferences, or validate an explicit locale code.
 *
 * When set to "auto", iterates navigator.languages (ordered by user
 * preference) trying exact match first, then base-language match.
 * Example: ["fr-CH", "de-CH", "en"] → tries fr→de→en, returns "fr".
 */
export function resolveLocale(setting: string): string {
  if (setting !== "auto") {
    return SUPPORTED_CODES.includes(setting) ? setting : "en";
  }
  for (const lang of navigator.languages) {
    const normalized = lang.replace("-", "_");
    if (SUPPORTED_CODES.includes(normalized)) return normalized;
    const base = normalized.split("_")[0];
    const match = SUPPORTED_CODES.find((code) => code.split("_")[0] === base);
    if (match) return match;
  }
  return "en";
}
