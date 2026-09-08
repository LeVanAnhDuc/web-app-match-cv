import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listSourceFiles, relativeToSrc } from "./sourceFiles";

// Eyebrow labels combine `tracking-wider` with a text colour. `text-faint`
// measures 2.45:1 against the app background — below the 4.5:1 floor for
// real text (an eyebrow is a heading, not decoration). This intentionally
// does NOT ban every `text-faint`: on an icon, a placeholder, or an axis
// tick label it sits at the 3:1 non-text floor, which is legitimate.
const EYEBROW =
  /tracking-wider[^"'`]*text-faint|text-faint[^"'`]*tracking-wider/;

describe("text-faint không dùng cho eyebrow", () => {
  it("không eyebrow nào dùng text-faint — 2.45:1, duoi nguong 4.5:1", () => {
    const offenders = listSourceFiles()
      .filter((file) => EYEBROW.test(readFileSync(file, "utf8")))
      .map(relativeToSrc);
    expect(offenders).toEqual([]);
  });
});
