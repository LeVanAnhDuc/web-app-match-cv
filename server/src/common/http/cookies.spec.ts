import { readCookie } from "./cookies";

describe("readCookie", () => {
  it("finds a cookie among others", () => {
    expect(readCookie("a=1; mcv_session=abc; sid=x", "mcv_session")).toBe(
      "abc"
    );
  });
  it("does not match a name that is only a suffix", () => {
    expect(readCookie("xmcv_session=abc", "mcv_session")).toBeNull();
  });
  it("decodes percent-encoding", () => {
    expect(readCookie("n=a%3Db", "n")).toBe("a=b");
  });
  it("returns null without a header", () => {
    expect(readCookie(undefined, "n")).toBeNull();
  });
});
