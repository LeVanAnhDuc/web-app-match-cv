import { ApiError } from "#/libs/api";

// Keyed on the server's code: every lineage refusal is a 400, so the status
// alone cannot tell "too long" from "a loop".
const LINEAGE_REFUSAL_COPY: Record<string, string> = {
  LINEAGE_SELF: "library.lineage.rejected",
  LINEAGE_CYCLE: "library.lineage.rejected",
  LINEAGE_TOO_DEEP: "library.lineage.tooDeep",
  LINEAGE_PARENT_NOT_FOUND: "library.lineage.parentNotFound",
  LINEAGE_KIND_MISMATCH: "library.lineage.kindMismatch"
};

/** i18n key for why `PATCH /documents/:id/parent` failed. */
export const lineageErrorKey = (error: unknown): string => {
  const code =
    error instanceof ApiError && error.status === 400 ? error.code : undefined;
  return (code && LINEAGE_REFUSAL_COPY[code]) ?? "library.lineage.failed";
};
