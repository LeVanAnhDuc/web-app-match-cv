import { I18nContext } from "nestjs-i18n";

/** Per-module i18n thunk. Falls back to English outside an HTTP lifecycle. */
export function tCompare(key: string, fallback: string): string {
  return I18nContext.current()?.t(key as never) ?? fallback;
}
