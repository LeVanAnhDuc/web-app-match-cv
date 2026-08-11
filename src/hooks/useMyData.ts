import { useMutation } from "@tanstack/react-query";
import { downloadMyData } from "#/requests/myData";

/**
 * POST-shaped side effect, not server state: the archive lands in the browser's
 * download list, so there is nothing to cache under a query key and nothing to
 * invalidate afterwards. `useMutation` is here purely for the request
 * lifecycle (`isPending` / `isError` / `isSuccess`) the button and alerts read.
 *
 * Mutations do not retry by default — right for a multi-megabyte archive.
 */
export function useDownloadMyData() {
  return useMutation({ mutationFn: downloadMyData });
}
