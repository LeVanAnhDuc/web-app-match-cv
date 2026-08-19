import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import {
  gotoWizard,
  nextButton,
  pasteText,
  stubMatchApi
} from "../cv-jd-matching-wizard/helpers";
import {
  createCredential,
  fillCredentialForm,
  gotoCredentials,
  markUsed,
  openAddDialog,
  resetCredentials,
  stubTestEndpoint,
  VALID_KEY
} from "./helpers";

// Matrix row 1 (happy path). Mutation-heavy cases are marked `A only`: gate B
// walks the same screens for read/render without repeating the writes.

const JD_TEXT =
  "We are hiring a senior backend engineer with NestJS experience.";
const CV_TEXT = "Senior backend engineer, 6 years with Node.js and NestJS.";

test.describe("ai-credentials happy path", () => {
  test.beforeEach(async () => {
    await resetCredentials();
  });

  test.afterAll(async () => {
    await resetCredentials();
  });

  test("empty page offers the add action and explains the fallback", async ({
    page
  }) => {
    await gotoCredentials(page);

    await expect(page.getByText("No credentials yet")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add credential" }).first()
    ).toBeVisible();
    await expect(page.getByText(/system key/i).first()).toBeVisible();
  });

  test("[A only] creating a credential shows it masked and reports the test per capability", async ({
    page
  }) => {
    await stubTestEndpoint(page, {
      status: "model_unavailable",
      chat: "ok",
      embed: "model_unavailable"
    });
    await gotoCredentials(page);
    const label = `E2E create ${randomUUID().slice(0, 8)}`;

    await openAddDialog(page);
    await fillCredentialForm(page, { label, apiKey: VALID_KEY });
    await page.getByRole("button", { name: "Save" }).click();

    // The dialog stays open until the post-save connection test settles, and
    // reports chat and embeddings as two separate lines (design D3/D8).
    await expect(page.getByText("Chat: Tested OK")).toBeVisible({
      timeout: 30000
    });
    await expect(page.getByText("Embeddings: Model unavailable")).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(label)).toBeVisible();
    await expect(page.getByText("••••1234")).toBeVisible();
  });

  test("[A only] testing an existing credential replaces the 'Not tested' chip", async ({
    page
  }) => {
    await createCredential({ label: `E2E test ${randomUUID().slice(0, 8)}` });
    await gotoCredentials(page);

    await expect(page.getByText("Not tested")).toBeVisible();
    await page.getByRole("button", { name: "Test" }).click();

    // Deliberately NOT stubbed: the row chip is re-read from the server after
    // the mutation, so stubbing the response would leave the database untested
    // and the chip would flip straight back. What matters is that a verdict got
    // persisted — the seeded key is bogus, so the verdict is invalid_key when
    // OpenRouter answers and unreachable when it does not. Either way the chip
    // must stop saying "Not tested".
    await expect(page.getByText("Not tested")).toBeHidden({ timeout: 30000 });
  });

  test("wizard step 3 defaults to the most recently used credential and names the provider", async ({
    page
  }) => {
    await cleanDocuments();
    const older = await createCredential({ label: "E2E older key" });
    const newer = await createCredential({ label: "E2E newer key" });
    await markUsed(older.id, "2026-08-01T00:00:00.000Z");
    await markUsed(newer.id, "2026-08-05T00:00:00.000Z");

    await gotoWizard(page);
    await pasteText(page, JD_TEXT);
    await nextButton(page).click();
    await pasteText(page, CV_TEXT);
    await nextButton(page).click();
    await expect(
      page.getByRole("heading", { name: "Review documents" })
    ).toBeVisible();

    // Reconciled for multi-provider-compare: the Select became a checkbox
    // group, and the notice lists every selected provider.
    await expect(page.getByLabel("Run with")).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: /E2E newer key/ })
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: /E2E older key/ })
    ).not.toBeChecked();

    await expect(
      page.getByText("Your CV and JD text will be sent to: OpenRouter.")
    ).toBeVisible();
  });

  test("step 4 shows which provider and model produced the result", async ({
    page
  }) => {
    await cleanDocuments();
    await stubMatchApi(page);

    await gotoWizard(page);
    await pasteText(page, JD_TEXT);
    await nextButton(page).click();
    await pasteText(page, CV_TEXT);
    await nextButton(page).click();
    await expect(
      page.getByRole("heading", { name: "Review documents" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Run match" }).click();

    // Attribution moved onto each result card's title once step 4 became a
    // list of cards, one per provider.
    await expect(page.getByText("OpenRouter · openai/gpt-4o-mini")).toBeVisible(
      { timeout: 30000 }
    );
  });
});
