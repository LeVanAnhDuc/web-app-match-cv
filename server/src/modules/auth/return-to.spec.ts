import { safeReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  it.each([
    ["/wizard?runId=abc", "/wizard?runId=abc"],
    ["/", "/"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["https://evil.com", "/"],
    ["", "/"],
    [undefined, "/"],
    [42, "/"]
  ])("%p → %p", (raw, expected) => expect(safeReturnTo(raw)).toBe(expected));
});
