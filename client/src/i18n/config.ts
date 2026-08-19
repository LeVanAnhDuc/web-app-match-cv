import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "#/locales/en/translation.json";
import vi from "#/locales/vi/translation.json";

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, vi: { translation: vi } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false }
});

// Dev-only hook so E2E can drive i18n.changeLanguage() without a UI switcher
// (no language switcher exists yet — Plan 2). Never present in production
// builds. See client/e2e/cv-jd-matching-wizard/i18n.e2e.ts.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __i18n: typeof i18n }).__i18n = i18n;
}

export default i18n;
