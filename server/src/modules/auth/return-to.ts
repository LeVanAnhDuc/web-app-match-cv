/** Only same-origin relative paths survive (NFR-SEC-13) — anything else would be an open redirect. */
export function safeReturnTo(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.includes("\\")) return "/";
  return raw;
}
