import { test, expect } from "@playwright/test";
import { buildGrepInvert, assertAllowed, grepFlagsFrom } from "./env-guard";

test.describe("buildGrepInvert", () => {
  test("excludes @e2e-full and @live-ai by default on dev", () => {
    const re = buildGrepInvert("dev")!;
    expect(re.test("TC-01 sign up then sign in @e2e-full")).toBe(true);
    expect(re.test("TC-05 real provider score @live-ai")).toBe(true);
    expect(re.test("TC-02 sign in @smoke")).toBe(false);
  });
  test("keeps the old boolean form for FULL", () => {
    const re = buildGrepInvert("dev", true)!;
    expect(re.test("x @e2e-full")).toBe(false);
    expect(re.test("x @live-ai")).toBe(true);
  });
  test("LIVE_AI includes @live-ai only", () => {
    const re = buildGrepInvert("dev", { liveAi: true })!;
    expect(re.test("x @live-ai")).toBe(false);
    expect(re.test("x @e2e-full")).toBe(true);
  });
  test("includes everything on dev when FULL and LIVE_AI", () => {
    expect(buildGrepInvert("dev", { includeFull: true, liveAi: true })).toBeUndefined();
  });
  test("always excludes @creates-data on prd, even when FULL", () => {
    const re = buildGrepInvert("prd", { includeFull: true, liveAi: true })!;
    expect(re.test("TC-03 sign up @creates-data")).toBe(true);
  });
});

test.describe("grepFlagsFrom", () => {
  test("reads FULL=1 and LIVE_AI=1 only", () => {
    expect(grepFlagsFrom({ FULL: "1", LIVE_AI: " 1 " })).toEqual({ includeFull: true, liveAi: true });
    expect(grepFlagsFrom({ FULL: "true", LIVE_AI: "0" })).toEqual({ includeFull: false, liveAi: false });
    expect(grepFlagsFrom({})).toEqual({ includeFull: false, liveAi: false });
  });
});

test.describe("assertAllowed", () => {
  test("blocks @creates-data on prd", () => {
    expect(() => assertAllowed("prd", ["@creates-data"], {})).toThrow(/@creates-data.*prd/);
  });
  test("allows @creates-data on dev", () => {
    expect(() => assertAllowed("dev", ["@creates-data"], {})).not.toThrow();
  });
  test("blocks @live-ai without LIVE_AI=1, even via a CLI --grep", () => {
    expect(() => assertAllowed("dev", ["@live-ai"], {})).toThrow(/LIVE_AI=1/);
    expect(() => assertAllowed("dev", ["@live-ai"], { LIVE_AI: "1" })).not.toThrow();
  });
});
