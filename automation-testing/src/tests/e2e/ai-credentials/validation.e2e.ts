import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  API_BASE,
  createCredential,
  fillCredentialForm,
  gotoCredentials,
  openAddDialog,
  resetCredentials,
  stubTestEndpoint,
  VALID_KEY
} from "./helpers";

// Matrix rows 4 (validation, [EP] + [DT]) and 6 (boundary, [BVA]). All `A only`.

/** Count POST attempts against the collection so we can prove none was sent. */
function countCreateRequests(page: Page): () => number {
  let count = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url() === `${API_BASE}/ai-credentials`
    ) {
      count += 1;
    }
  });
  return () => count;
}

test.describe("ai-credentials validation", () => {
  test.beforeEach(async ({ page }) => {
    await resetCredentials();
    await stubTestEndpoint(page);
  });

  test.afterAll(async () => {
    await resetCredentials();
  });

  test("[EP] an empty key is rejected client-side, with no request sent", async ({
    page
  }) => {
    const creates = countCreateRequests(page);
    await gotoCredentials(page);
    await openAddDialog(page);

    await fillCredentialForm(page, { label: "E2E empty key" });
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("This field is required")).toBeVisible();
    expect(creates()).toBe(0);
  });

  test("[BVA] a 19-character key is rejected, a 20-character key is accepted", async ({
    page
  }) => {
    const creates = countCreateRequests(page);
    await gotoCredentials(page);
    await openAddDialog(page);

    await fillCredentialForm(page, {
      label: `E2E bva ${randomUUID().slice(0, 8)}`,
      apiKey: "x".repeat(19)
    });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByText("The key must be at least 20 characters")
    ).toBeVisible();
    expect(creates()).toBe(0);

    await page.getByLabel("API key").fill("y".repeat(20));
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Chat:")).toBeVisible({ timeout: 30000 });
    expect(creates()).toBe(1);
  });

  test("[BVA] a 401-character key is rejected", async ({ page }) => {
    const creates = countCreateRequests(page);
    await gotoCredentials(page);
    await openAddDialog(page);

    await fillCredentialForm(page, {
      label: "E2E too long",
      apiKey: "z".repeat(401)
    });
    await page.getByRole("button", { name: "Save" }).click();

    await expect(
      page.getByText("The key must be at most 400 characters")
    ).toBeVisible();
    expect(creates()).toBe(0);
  });

  test("[EP] a key containing a space is rejected", async ({ page }) => {
    const creates = countCreateRequests(page);
    await gotoCredentials(page);
    await openAddDialog(page);

    await fillCredentialForm(page, {
      label: "E2E spaced key",
      apiKey: "sk-with a space 1234567890"
    });
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("No spaces allowed")).toBeVisible();
    expect(creates()).toBe(0);
  });

  test("[BVA] a 61-character label is rejected, 60 is accepted", async ({
    page
  }) => {
    await gotoCredentials(page);
    await openAddDialog(page);

    await fillCredentialForm(page, {
      label: "a".repeat(61),
      apiKey: VALID_KEY
    });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Use at most 60 characters")).toBeVisible();

    await page.getByLabel("Name").fill("b".repeat(60));
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Chat:")).toBeVisible({ timeout: 30000 });
  });

  test("[DT] duplicate label + valid key → the 409 lands on the label field", async ({
    page
  }) => {
    const label = `E2E dup ${randomUUID().slice(0, 8)}`;
    await createCredential({ label });

    await gotoCredentials(page);
    await openAddDialog(page);
    await fillCredentialForm(page, { label, apiKey: VALID_KEY });
    await page.getByRole("button", { name: "Save" }).click();

    await expect(
      page.getByText("You already have a credential with this name")
    ).toBeVisible({ timeout: 15000 });
    // Not a toast, and not the generic message.
    await expect(page.getByText("Could not save the credential")).toBeHidden();
  });

  test("[DT] duplicate label + short key → the client-side key error wins and nothing is sent", async ({
    page
  }) => {
    const label = `E2E dup2 ${randomUUID().slice(0, 8)}`;
    await createCredential({ label });

    const creates = countCreateRequests(page);
    await gotoCredentials(page);
    await openAddDialog(page);
    await fillCredentialForm(page, { label, apiKey: "x".repeat(19) });
    await page.getByRole("button", { name: "Save" }).click();

    await expect(
      page.getByText("The key must be at least 20 characters")
    ).toBeVisible();
    // The server never gets a chance to report the duplicate.
    await expect(
      page.getByText("You already have a credential with this name")
    ).toBeHidden();
    expect(creates()).toBe(0);
  });
});
