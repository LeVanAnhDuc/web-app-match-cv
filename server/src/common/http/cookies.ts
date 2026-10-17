/** Minimal Cookie-header reader — cookie-parser would be a dependency for one function. */
export function readCookie(
  header: string | undefined,
  name: string
): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      // Same as the `cookie` package: an undecodable value is returned raw, so
      // a tampered cookie still reaches the caller (and gets cleared) instead
      // of looking like no cookie at all.
      return value;
    }
  }
  return null;
}
