import { expect, test } from "@playwright/test";
import {
  createCredential,
  gotoCredentials,
  openAddDialog,
  resetCredentials,
  setLanguage
} from "./helpers";

// Matrix row 9 (i18n) — mandatory, both locales. Read-only → gate A+B.
// A missing translation surfaces as the raw key, so asserting no `credentials.`
// text is visible catches gaps the per-string assertions would miss.

const RAW_KEY_PATTERN = /credentials\.[a-zA-Z.]+/;

test.describe("ai-credentials i18n", () => {
  test.beforeEach(async () => {
    await resetCredentials();
    await createCredential({ label: "E2E i18n key" });
  });

  test.afterAll(async () => {
    await resetCredentials();
  });

  test("renders the page in English with no raw i18n keys", async ({
    page
  }) => {
    await gotoCredentials(page);
    await setLanguage(page, "en");

    await expect(
      page.getByRole("heading", { name: "AI credentials" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Test" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
    await expect(page.getByText("Not tested")).toBeVisible();

    expect(await page.locator("body").innerText()).not.toMatch(RAW_KEY_PATTERN);
  });

  test("renders the page in Vietnamese with no raw i18n keys", async ({
    page
  }) => {
    await gotoCredentials(page);
    await setLanguage(page, "vi");

    await expect(
      page.getByRole("heading", { name: "Credential AI" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Kiểm tra" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sửa" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Xoá" })).toBeVisible();
    await expect(page.getByText("Chưa kiểm tra")).toBeVisible();

    expect(await page.locator("body").innerText()).not.toMatch(RAW_KEY_PATTERN);
  });

  test("renders the form dialog in both locales with no raw keys", async ({
    page
  }) => {
    await gotoCredentials(page);

    await setLanguage(page, "en");
    await openAddDialog(page);
    await expect(page.getByLabel("Provider")).toBeVisible();
    await expect(page.getByLabel("API key")).toBeVisible();
    await expect(page.getByLabel("Embedding model")).toBeVisible();
    await expect(
      page.getByText("Leave blank to use the provider default")
    ).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(RAW_KEY_PATTERN);
    await page.getByRole("button", { name: "Cancel" }).click();

    await setLanguage(page, "vi");
    await openAddDialog(page, "Thêm credential");
    await expect(page.getByLabel("Nhà cung cấp")).toBeVisible();
    await expect(page.getByLabel("API key")).toBeVisible();
    await expect(page.getByLabel("Model embedding")).toBeVisible();
    await expect(
      page.getByText("Để trống để dùng mặc định của nhà cung cấp")
    ).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(RAW_KEY_PATTERN);
  });

  test("renders the delete confirmation in both locales", async ({ page }) => {
    await gotoCredentials(page);

    await setLanguage(page, "en");
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Delete this credential?")).toBeVisible();
    await expect(
      page.getByText(
        "Past match results keep the provider and model they ran with."
      )
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await setLanguage(page, "vi");
    await page.getByRole("button", { name: "Xoá" }).click();
    await expect(page.getByText("Xoá credential này?")).toBeVisible();
    await expect(
      page.getByText(
        "Các kết quả so khớp cũ vẫn giữ nhà cung cấp và model đã dùng."
      )
    ).toBeVisible();
  });
});
