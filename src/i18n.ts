import i18n from "i18next";
import type { ParseKeys } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import fa from "@/locales/fa.json";

/** Every valid translation key, derived from `locales/en.json`. */
export type TranslationKey = ParseKeys<"translation">;

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fa: { translation: fa },
  },
  lng: "en",
  fallbackLng: "en",
  supportedLngs: ["en", "fa"],
  interpolation: { escapeValue: false },
  returnObjects: true,
});

export default i18n;