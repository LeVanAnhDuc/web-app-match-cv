import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listSourceFiles, relativeToSrc } from "./sourceFiles";

// The old primary (blue/indigo) plus grayscale families that predate the
// semantic token system (docs/design-system/match-cv/MASTER.md §2b). A raw
// Tailwind palette class in either family means a colour slipped in outside
// the token layer — usually paired `X-600 dark:X-400` classes that drift out
// of sync with the token system's light/dark values.
const FORBIDDEN = /\b(?:blue|indigo|slate|zinc|cyan)-(?:\d{2,3})\b/;

describe("không màu hard-code trong client/src", () => {
  it("mọi màu đi qua token của MASTER §2b", () => {
    const offenders = listSourceFiles()
      .filter((file) => FORBIDDEN.test(readFileSync(file, "utf8")))
      .map(relativeToSrc);
    expect(offenders).toEqual([]);
  });
});
