import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  createCredential,
  fillCredentialForm,
  gotoCredentials,
  openAddDialog,
  resetCredentials,
  stubTestEndpoint,
  VALID_KEY
} from "./helpers";

// Matrix rows 11 (mutation safety, [ST]) and 12 (accessibility).
// Row 11 is `A only`; row 12 is read/render so gate B repeats it.

test.describe("ai-credentials mutation safety", () => {
  test.beforeEach(async ({ page }) => {
    await resetCredentials();
    await stubTestEndpoint(page);
  });

  test.afterAll(async () => {
    await resetCredentials();
  });

  test("[ST] rotating the key returns the row to 'Not tested'", async ({
    page
  }) => {
    const label = `E2E rotate ${randomUUID().slice(0, 8)}`;
    await createCredential({ label });
    await gotoCredentials(page);

    // Test it for real so the database actually holds a verdict.
    await page.unroute(/\/api\/v1\/ai-credentials\/[^/]+\/test$/);
    await page.getByRole("button", { name: "Test" }).click();
    await expect(page.getByText("Not tested")).toBeHidden({ timeout: 30000 });

    // Rotating invalidates that verdict: it no longer describes what would run.
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("API key").fill("sk-rotated-e2e-key-777777");
    await stubTestEndpoint(page, {
      status: "ok",
      chat: "ok",
      embed: "ok"
    });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Chat:")).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByText("••••7777")).toBeVisible();
    await expect(page.getByText("Not tested")).toBeVisible();
  });

  test("[ST] deleting removes the row and asks for confirmation first", async ({
    page
  }) => {
    const label = `E2E delete ${randomUUID().slice(0, 8)}`;
    await createCredential({ label });
    await gotoCredentials(page);

    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Delete this credential?")).toBeVisible();
    // Cancelling must not delete.
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(label)).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).first().click();
    await page
      .getByRole("tooltip")
      .getByRole("button", { name: "Delete" })
      .click();

    await expect(page.getByText("Credential deleted")).toBeVisible({
      timeout: 20000
    });
    await expect(page.getByText(label)).toBeHidden();
  });

  test("[ST] double-clicking Save creates exactly one credential", async ({
    page
  }) => {
    const label = `E2E double ${randomUUID().slice(0, 8)}`;
    await gotoCredentials(page);
    await openAddDialog(page);
    await fillCredentialForm(page, { label, apiKey: VALID_KEY });

    const save = page.getByRole("button", { name: "Save" });
    await save.click();
    // The button is disabled while pending, so the second click is a no-op.
    await save.click({ force: true, trial: false }).catch(() => undefined);

    await expect(page.getByText("Chat:")).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByText(label)).toHaveCount(1);
  });
});

test.describe("ai-credentials accessibility", () => {
  test.beforeEach(async () => {
    await resetCredentials();
    await createCredential({ label: "E2E a11y key" });
  });

  test.afterAll(async () => {
    await resetCredentials();
  });

  test("every form field is reachable by its label", async ({ page }) => {
    await gotoCredentials(page);
    await openAddDialog(page);

    await expect(page.getByLabel("Provider")).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("API key")).toBeVisible();
    await expect(page.getByLabel("Chat model")).toBeVisible();
    await expect(page.getByLabel("Embedding model")).toBeVisible();
  });

  test("Escape closes the dialog", async ({ page }) => {
    await gotoCredentials(page);
    await openAddDialog(page);

    // antd routes Escape through the modal wrapper's key handler, so the key
    // has to be pressed with focus inside the dialog — which is where a real
    // user would be after the modal traps focus.
    await page.getByLabel("Name").click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("the row actions are in Test → Edit → Delete tab order", async ({
    page
  }) => {
    await gotoCredentials(page);
    // The list arrives asynchronously; querying before it lands finds no row.
    await expect(page.getByText("E2E a11y key")).toBeVisible({
      timeout: 20000
    });

    const names = await page
      .getByRole("listitem")
      .first()
      .getByRole("button")
      .allTextContents();
    expect(names).toEqual(["Test", "Edit", "Delete"]);
  });

  test("the delete confirmation is operable from the keyboard", async ({
    page
  }) => {
    await gotoCredentials(page);
    await expect(page.getByText("E2E a11y key")).toBeVisible({
      timeout: 20000
    });

    await page.getByRole("button", { name: "Delete" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Delete this credential?")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Delete this credential?")).toBeHidden();
  });
});
