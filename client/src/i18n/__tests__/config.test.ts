import { describe, it, expect } from "vitest";
import i18n from "../config";

describe("i18n", () => {
  it("en default", () => {
    expect(i18n.t("appName")).toBe("Match CV");
  });
  it("switch to vi", async () => {
    await i18n.changeLanguage("vi");
    expect(i18n.t("appName")).toBe("Ghép CV");
    await i18n.changeLanguage("en");
  });
});
