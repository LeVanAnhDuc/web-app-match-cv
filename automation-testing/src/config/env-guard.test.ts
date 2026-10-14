import { test, expect } from "@playwright/test";
import { buildGrepInvert, assertAllowed } from "./env-guard";

test.describe("buildGrepInvert", () => {
  test("excludes @e2e-full by default on dev", () => {
    const re = buildGrepInvert("dev", false)!;
    expect(re.test("TC-01 sign up then sign in @e2e-full")).toBe(true);
    expect(re.test("TC-02 sign in @smoke")).toBe(false);
  });
  test("includes everything on dev when FULL", () => {
    expect(buildGrepInvert("dev", true)).toBeUndefined();
  });
  test("always excludes @creates-data on prd, even when FULL", () => {
    const re = buildGrepInvert("prd", true)!;
    expect(re.test("TC-03 sign up @creates-data")).toBe(true);
  });
});

test.describe("assertAllowed", () => {
  test("blocks @creates-data on prd", () => {
    expect(() => assertAllowed("prd", ["@creates-data"])).toThrow(/@creates-data.*prd/);
  });
  test("allows @creates-data on dev", () => {
    expect(() => assertAllowed("dev", ["@creates-data"])).not.toThrow();
  });
});
