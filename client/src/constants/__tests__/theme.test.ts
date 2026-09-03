import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME } from "#/constants";

const css = readFileSync(resolve(__dirname, "../../styles.css"), "utf8");

function varsInBlock(marker: string) {
  const start = css.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...block.matchAll(/--color-([a-z-]+):\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim()
    ])
  );
}

describe("THEME khớp styles.css", () => {
  const light = varsInBlock("@theme {");
  const dark = varsInBlock("@media (prefers-color-scheme: dark)");

  it("primary của antd bằng --color-primary ở cả hai theme", () => {
    expect(THEME.light.primary).toBe(light.primary);
    expect(THEME.dark.primary).toBe(dark.primary);
  });

  it("colorBorder của antd bằng --color-line-strong, không phải --color-line", () => {
    expect(THEME.light.lineStrong).toBe(light["line-strong"]);
    expect(THEME.light.lineStrong).not.toBe(light.line);
  });

  it("khai báo đủ token của MASTER §2a ở cả hai theme", () => {
    const required = [
      "app",
      "surface",
      "surface-subtle",
      "line",
      "line-strong",
      "body",
      "muted",
      "faint",
      "primary",
      "primary-hover",
      "accent",
      "success",
      "warning",
      "error"
    ];
    for (const key of required) {
      expect(light[key], `light thiếu --color-${key}`).toBeDefined();
      expect(dark[key], `dark thiếu --color-${key}`).toBeDefined();
    }
  });
});
