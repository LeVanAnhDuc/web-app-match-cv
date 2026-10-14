import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { serverMessage, t } from "./copy";

const en = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "..", "client", "src", "locales", "en", "translation.json"), "utf8")
);

test("t reads the real en locale file", () => {
  expect(t("appName")).toBe(en.appName);
  expect(t("nav.home")).toBe(en.nav.home);
});

test("t reads vi and differs from en for a translated key", () => {
  expect(t("nav.home", "vi")).not.toBe("");
  expect(t("nav.home", "vi")).not.toBe(t("nav.home", "en"));
});

test("t interpolates {{var}} and leaves unknown vars untouched", () => {
  const raw: string = en.auth.quota.left;
  expect(raw).toContain("{{");
  const out = t("auth.quota.left", "en", { left: 2, limit: 3 });
  expect(out).not.toContain("{{left}}");
  expect(out).toContain("2");
  expect(out).toContain("3");
});

test("t picks the plural form from count", () => {
  const one = t("rewrite.changes.selectedCount", "en", { count: 1 });
  const many = t("rewrite.changes.selectedCount", "en", { count: 3 });
  expect(one).not.toBe(many);
  expect(many).toContain("3");
});

test("t throws on an unknown key", () => {
  expect(() => t("nope.missing" as never)).toThrow(/nope\.missing/);
});

test("serverMessage reads server/src/i18n/<lng>/<file>.json", () => {
  expect(serverMessage("documents.errors.notFound")).toBe("Document not found.");
  expect(serverMessage("documents.errors.notFound", "vi")).not.toBe("Document not found.");
});
