import { ENDPOINTS } from "#/constants";
import { apiFetchBinary } from "#/libs/api";

/**
 * The archive's name on disk. The server sends its own dated filename in
 * Content-Disposition, but the anchor's `download` attribute overrides it —
 * and the header is unreadable from JS anyway, because the API is a
 * different origin and does not list it in Access-Control-Expose-Headers.
 * Deriving the date here keeps repeat downloads distinguishable instead of
 * piling up as export(1).zip, export(2).zip.
 *
 * Trade-off: the date may differ from the server's by a day when the user's
 * clock is far from UTC — acceptable, the point is telling one download from
 * another, not forensic accuracy.
 */
function archiveFilename(): string {
  return `export-${new Date().toISOString().slice(0, 10)}.zip`;
}

/**
 * Downloads the current user's data archive and hands it to the browser.
 *
 * The bytes go through fetch rather than a plain anchor so the caller can
 * show a loading state and surface a real error — an anchor navigation
 * gives neither. The trade-off is that the archive is held in memory once;
 * acceptable because it is bounded by the user's own uploads.
 */
export async function downloadMyData(): Promise<void> {
  const buffer = await apiFetchBinary(ENDPOINTS.meExport);
  const blob = new Blob([buffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = archiveFilename();
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // Deferred rather than called inline: Safari and some Firefox builds
    // abort the download if the object URL is revoked in the same tick as
    // the click, before the browser has started fetching the blob. A
    // macrotask delay (setTimeout 0) is enough to let that fetch begin;
    // the URL is still always released, just one tick later.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
