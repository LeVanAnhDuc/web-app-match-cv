import { expect, test } from "@playwright/test";
import { globToRegExp, urlMatches } from "./glob";

test("** crosses slashes, * does not", () => {
  expect(urlMatches("**/api/v1/match", "http://localhost:5200/api/v1/match")).toBe(true);
  expect(urlMatches("**/api/v1/*", "http://localhost:5200/api/v1/match")).toBe(true);
  expect(urlMatches("**/api/v1/*", "http://localhost:5200/api/v1/match/runs")).toBe(false);
});

test("the whole URL must match, query included", () => {
  expect(urlMatches("**/api/v1/match", "http://localhost:5200/api/v1/match?x=1")).toBe(false);
  expect(urlMatches("**/api/v1/match**", "http://localhost:5200/api/v1/match?x=1")).toBe(true);
});

test("{a,b} alternation and literal ? and dots", () => {
  expect(urlMatches("**/{cv-rewrite,cover-letters}", "http://h/api/v1/cover-letters")).toBe(true);
  expect(urlMatches("**/a?b", "http://h/a?b")).toBe(true);
  expect(urlMatches("**/a?b", "http://h/axb")).toBe(false);
  expect(globToRegExp("**/x.json").test("http://h/xajson")).toBe(false);
});

test("RegExp matchers pass through", () => {
  expect(urlMatches(/\/match\/runs\/[\w-]+$/, "http://h/api/v1/match/runs/abc")).toBe(true);
  const sticky = /match/g;
  expect(urlMatches(sticky, "http://h/match")).toBe(true);
  expect(urlMatches(sticky, "http://h/match")).toBe(true);
});
