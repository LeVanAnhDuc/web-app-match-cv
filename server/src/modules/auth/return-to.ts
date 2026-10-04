const MAX_RETURN_TO_LENGTH = 2048;
// Browsers strip tab/newline inside URLs, so "/\t/evil.com" would become "//evil.com".
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

/** Only same-origin relative paths survive (NFR-SEC-13) — anything else would be an open redirect. */
export function safeReturnTo(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.includes("\\")) return "/";
  if (raw.length > MAX_RETURN_TO_LENGTH || CONTROL_CHARS.test(raw)) return "/";
  return raw;
}
