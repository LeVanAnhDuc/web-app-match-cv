import { test, expect } from "@playwright/test";
import { resolveEnv, requireVar } from "./env";

test.describe("resolveEnv", () => {
  test("defaults to dev when unset", () => {
    expect(resolveEnv(undefined)).toBe("dev");
  });
  test("normalizes case and whitespace", () => {
    expect(resolveEnv("  STG ")).toBe("stg");
  });
  test("rejects unknown env with the allowed list", () => {
    expect(() => resolveEnv("staging")).toThrow(/Unknown ENV "staging".*dev, stg, prd/);
  });
});

test.describe("requireVar", () => {
  test("returns trimmed value", () => {
    expect(requireVar("X", { X: " v " })).toBe("v");
  });
  test("names the missing variable", () => {
    expect(() => requireVar("DEV_USER_EMAIL", {})).toThrow(/DEV_USER_EMAIL/);
  });
  test("treats blank as missing", () => {
    expect(() => requireVar("X", { X: "   " })).toThrow(/X/);
  });
});
