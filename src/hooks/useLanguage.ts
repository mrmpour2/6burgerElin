import { useTranslation } from "react-i18next";
import type { Language } from "@/types";

const FALLBACK_LANGUAGE: Language = "en";

/** Reads the active i18next language as the narrow `Language` union (no casts). */
export function useLanguage(): Language {
  const { i18n } = useTranslation();
  const resolved = i18n.resolvedLanguage ?? i18n.language;
  return resolved.startsWith("fa") ? "fa" : FALLBACK_LANGUAGE;
}