import { defineRouting } from "next-intl/routing";

/**
 * Launch languages (section 13 of the feature doc). The architecture accepts any
 * BCP 47 tag; add a locale here plus a messages/<locale>.json file to enable it.
 * Phase 1 gate ships English and Tamil end to end; the remaining seven follow
 * once UI strings and content are drafted.
 */
export const LOCALES = [
  { code: "en", name: "English", nativeName: "English", dir: "ltr", enabled: true },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", dir: "ltr", enabled: true },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", dir: "ltr", enabled: false },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", dir: "ltr", enabled: false },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", dir: "ltr", enabled: false },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", dir: "ltr", enabled: false },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", dir: "ltr", enabled: false },
  { code: "mr", name: "Marathi", nativeName: "मराठी", dir: "ltr", enabled: false },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", dir: "ltr", enabled: false },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];

export const enabledLocales = LOCALES.filter((l) => l.enabled).map((l) => l.code);

export const routing = defineRouting({
  locales: enabledLocales,
  defaultLocale: "en",
  // Every URL carries its language (/ta/articles/...), including English, so
  // hreflang and canonical tags stay unambiguous.
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];

export function localeMeta(code: string) {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}
