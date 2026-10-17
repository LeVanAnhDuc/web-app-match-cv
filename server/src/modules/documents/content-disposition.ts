// RFC 5987 attr-char: ALPHA / DIGIT / "!#$&+-.^_`|~". encodeURIComponent
// leaves ' ( ) * unescaped, which a strict ext-value parser rejects.
function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Builds a `Content-Disposition` header. `asciiName` must already be
 * header-safe; `utf8Name`, when present, is sent as RFC 5987 `filename*` so a
 * browser can restore the original (e.g. Vietnamese) name.
 */
export function contentDisposition(
  type: "inline" | "attachment",
  asciiName: string,
  utf8Name: string | null
): string {
  const base = `${type}; filename="${asciiName}"`;
  return utf8Name === null
    ? base
    : `${base}; filename*=UTF-8''${encodeRfc5987(utf8Name)}`;
}
