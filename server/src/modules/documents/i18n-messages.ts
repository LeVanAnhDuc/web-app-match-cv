import { I18nContext } from "nestjs-i18n";

/**
 * Translate a `documents.*` i18n key for the current request language,
 * falling back to the given English string when no I18nContext is bound
 * (e.g. calls made outside an HTTP request lifecycle).
 */
export function tDoc(key: string, fallback: string): string {
  return I18nContext.current()?.t(key as never) ?? fallback;
}
