import type en from "@/locales/en.json";

/**
 * Registers the English locale as the source of truth for i18n keys so that
 * `t("home.heroTitle")` is type-checked at compile time (see typescript-expert
 * skill: "no unsafe casts, types flow from data").
 */
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
    returnNull: false;
  }
}
