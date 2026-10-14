import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { liveCookie, sessionIdFor, setCookiesNamed } from "./sessions";

test("sessionIdFor is the sha256 hex of the raw token, as the server stores it", () => {
  expect(sessionIdFor("abc")).toBe(createHash("sha256").update("abc").digest("hex"));
  expect(sessionIdFor("abc")).toMatch(/^[0-9a-f]{64}$/);
});

test("liveCookie returns name=value of a set cookie and skips a cleared one", () => {
  const headers = ["mcv_oauth=; Path=/api/v1/auth", "mcv_session=tok123; Path=/; HttpOnly", "other=1"];
  expect(liveCookie(headers, "mcv_session")).toBe("mcv_session=tok123");
  expect(liveCookie(headers, "mcv_oauth")).toBeUndefined();
  expect(liveCookie([], "mcv_session")).toBeUndefined();
});

test("setCookiesNamed keeps cleared cookies as name=", () => {
  const headers = ["mcv_oauth=; Path=/api/v1/auth", "mcv_session=tok; Path=/"];
  expect(setCookiesNamed(headers, "mcv_oauth")).toEqual(["mcv_oauth="]);
  expect(setCookiesNamed(headers, "missing")).toEqual([]);
});
