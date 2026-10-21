import { useTranslation as useI18nTranslation } from "react-i18next";
import type { TOptions } from "i18next";
import type { TranslationKey } from "@/i18n";

/**
 * Typed wrapper around the i18next hook. Keys come from `@/i18n` (derived from
 * `locales/en.json`), so unknown keys are a compile error instead of a silent
 * fallback string.
 */
export function useTranslation() {
  const { t, i18n, ready } = useI18nTranslation();

  return {
    t: (key: TranslationKey, options?: TOptions) => t(key, options),
    i18n,
    ready,
  };
}