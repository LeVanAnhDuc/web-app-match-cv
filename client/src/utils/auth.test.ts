import { describe, expect, it } from "vitest";
import { timeUntil } from "./auth";

describe("timeUntil", () => {
  const now = Date.parse("2026-10-04T00:00:00.000Z");

  it("splits the wait into hours and minutes, rounding minutes up", () => {
    expect(timeUntil("2026-10-04T02:30:10.000Z", now)).toEqual({
      hours: 2,
      minutes: 31
    });
  });

  it("never goes below one minute", () => {
    expect(timeUntil("2026-10-03T00:00:00.000Z", now)).toEqual({
      hours: 0,
      minutes: 1
    });
  });

  it("falls back to the one-minute floor for an unparseable timestamp", () => {
    expect(timeUntil("not a date", now)).toEqual({ hours: 0, minutes: 1 });
    expect(timeUntil("", now)).toEqual({ hours: 0, minutes: 1 });
  });
});
