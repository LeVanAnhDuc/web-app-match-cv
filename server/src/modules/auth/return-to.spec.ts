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
    ["/\t/evil.com", "/"],
    ["/\n/evil.com", "/"],
    ["/\r\n//evil", "/"],
    ["/" + "a".repeat(2048), "/"],
    [42, "/"]
  ])("%p → %p", (raw, expected) => expect(safeReturnTo(raw)).toBe(expected));
});
