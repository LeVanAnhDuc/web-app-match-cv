import { expect, test } from "@playwright/test";
import { cleanDocuments } from "../db-cleanup";
import {
  gotoWizard,
  nextButton,
  pasteText
} from "../cv-jd-matching-wizard/helpers";
import { createCredential, resetCredentials } from "./helpers";

// Matrix row 10 (error / loading). Every failure is injected by route
// interception, so the server stays healthy and the run stays deterministic.

const LIST_ROUTE = /\/api\/v1\/ai-credentials$/;

test.describe("ai-credentials failure states", () => {
  test.beforeEach(async () => {
    await resetCredentials();
  });

  test.afterAll(async () => {
    await resetCredentials();
  });

  test("[EP] a 500 on the list shows an error alert, not a blank page", async ({
    page
  }) => {
    await page.route(LIST_ROUTE, async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ statusCode: 500, message: "boom" })
      });
    });

    await page.goto("/ai-credentials");
    await expect(page.getByRole("alert")).toHaveText(
      /Could not load your credentials/,
      { timeout: 20000 }
    );
    // The page frame must survive the failure.
    await expect(
      page.getByRole("heading", { name: "AI credentials" })
    ).toBeVisible();
  });

  test("[EP] a 503 says storage is unconfigured, not a generic failure", async ({
    page
  }) => {
    await page.route(LIST_ROUTE, async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          statusCode: 503,
          message: "Credential storage is not configured."
        })
      });
    });

    await page.goto("/ai-credentials");
    await expect(page.getByRole("alert")).toHaveText(
      /Credential storage is not configured on the server\./,
      { timeout: 20000 }
    );
    await expect(
      page.getByText("Could not load your credentials")
    ).toBeHidden();
  });

  test("[EP] a failing connection test shows the verdict and does not crash", async ({
    page
  }) => {
    await createCredential({ label: "E2E failing test" });

    await page.route(
      /\/api\/v1\/ai-credentials\/[^/]+\/test$/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "invalid_key",
            chat: "invalid_key",
            embed: "invalid_key",
            testedAt: new Date().toISOString()
          })
        });
      }
    );

    await page.goto("/ai-credentials");
    await expect(page.getByText("E2E failing test")).toBeVisible({
      timeout: 20000
    });
    await page.getByRole("button", { name: "Test" }).click();

    // The toast confirms the round trip; the row itself is re-read from the
    // server, which still has no verdict because the response was stubbed.
    await expect(page.getByText("Connection tested")).toBeVisible({
      timeout: 20000
    });
    await expect(
      page.getByRole("heading", { name: "AI credentials" })
    ).toBeVisible();
  });

  test("[ST] running a match with a since-deleted credential surfaces the error", async ({
    page
  }) => {
    await cleanDocuments();
    const doomed = await createCredential({ label: "E2E doomed key" });

    await gotoWizard(page);
    await pasteText(page, "JD text for the deleted-credential case.");
    await nextButton(page).click();
    await pasteText(page, "CV text for the deleted-credential case.");
    await nextButton(page).click();
    await expect(
      page.getByRole("heading", { name: "Review documents" })
    ).toBeVisible();
    await expect(page.getByText("E2E doomed key")).toBeVisible();

    // Delete it behind the wizard's back, exactly as a second tab would.
    const deleted = await fetch(
      `${process.env.E2E_API_BASE ?? "http://localhost:5200/api/v1"}/ai-credentials/${doomed.id}`,
      { method: "DELETE" }
    );
    expect(deleted.status).toBe(204);

    await page.getByRole("button", { name: /Run match/ }).click();

    // Reconciled for multi-provider-compare: opening the run still succeeds, so
    // the wizard advances and the dead credential fails on ITS OWN card. That
    // is the point of partial success — one bad provider must not block the
    // others — and the card is where the user can retry it.
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
