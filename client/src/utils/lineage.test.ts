import { describe, expect, it } from "vitest";
import { ApiError } from "#/libs/api";
import { lineageErrorKey } from "./lineage";

describe("lineageErrorKey", () => {
  it("keeps the 'itself or its own newer version' copy for a self link and a loop", () => {
    expect(lineageErrorKey(new ApiError(400, "x", "LINEAGE_SELF"))).toBe(
      "library.lineage.rejected"
    );
    expect(lineageErrorKey(new ApiError(400, "x", "LINEAGE_CYCLE"))).toBe(
      "library.lineage.rejected"
    );
  });

  it("names a chain that is too long instead of calling it a loop", () => {
    expect(lineageErrorKey(new ApiError(400, "x", "LINEAGE_TOO_DEEP"))).toBe(
      "library.lineage.tooDeep"
    );
  });

  it("gives the other refusals a reason of their own", () => {
    expect(
      lineageErrorKey(new ApiError(400, "x", "LINEAGE_PARENT_NOT_FOUND"))
    ).toBe("library.lineage.parentNotFound");
    expect(
      lineageErrorKey(new ApiError(400, "x", "LINEAGE_KIND_MISMATCH"))
    ).toBe("library.lineage.kindMismatch");
  });

  it("falls back to the generic failure for anything it cannot name", () => {
    expect(lineageErrorKey(new ApiError(400, "x"))).toBe(
      "library.lineage.failed"
    );
    expect(lineageErrorKey(new ApiError(500, "x"))).toBe(
      "library.lineage.failed"
    );
    expect(lineageErrorKey(new Error("offline"))).toBe(
      "library.lineage.failed"
    );
  });
});
