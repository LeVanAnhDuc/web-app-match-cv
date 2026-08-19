import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect, test, type Page } from "@playwright/test";

// Gate A of the §4.3 dual-gate for `home-dashboard-library`
// (docs/specs/home-dashboard-library/e2e.md). Self-contained: seeds its own
// saved docs via the API + one MatchResult via pg (no OpenRouter call), so it
// is deterministic and safe to re-run. Runs against the already-running dev
// pair; point E2E_BASE_URL / E2E_API_BASE / E2E_DATABASE_URL at the worktree
// ports when not on the defaults. Each mutation test targets its OWN document,
// so the tests are order-independent.

const API_BASE = process.env.E2E_API_BASE ?? "http://localhost:5200/api/v1";
const DB_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/matchcv";
const STUB_USER_ID = "00000000-0000-0000-0000-000000000001";

const MATCHED_CV = "E2E Matched CV";
const MATCHED_JD = "E2E Matched JD";
const RENAME_CV = "E2E Rename CV";
const DELETE_CV = "E2E Delete CV";

async function createDoc(
  kind: "CV" | "JD",
  title: string,
  text: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, sourceText: text, save: true, title })
  });
  if (!res.ok) throw new Error(`seed ${kind} "${title}" failed: ${res.status}`);
  return ((await res.json()) as { id: string }).id;
}

async function resetDb(): Promise<void> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query('DELETE FROM "MatchResult"');
    await client.query('DELETE FROM "Document"');
  } finally {
    await client.end();
  }
}

async function insertMatch(cvId: string, jdId: string): Promise<void> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query(
      // provider/chatModel/embedModel are NOT NULL with no default since the
      // add_ai_credential migration: a match row records which AI produced it.
      `INSERT INTO "MatchResult"
       (id,"userId","cvDocumentId","jdDocumentId","overallScore","semanticScore","keywordScore",report,
        provider,"chatModel","embedModel","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'openrouter','openai/gpt-4o-mini','openai/text-embedding-3-small',now())`,
      [
        randomUUID(),
        STUB_USER_ID,
        cvId,
        jdId,
        73,
        88,
        50,
        JSON.stringify({
          strengths: ["Solid backend fundamentals"],
          gaps: ["No Kubernetes experience"],
          suggestions: ["Add measurable API impact"]
        })
      ]
    );
  } finally {
    await client.end();
  }
}

/** Wait for TanStack Start hydration (dev-only window.__i18n hook). */
async function waitHydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => "__i18n" in window, undefined, {
    timeout: 15_000
  });
}

function row(page: Page, title: string) {
  return page.getByRole("listitem").filter({ hasText: title });
}

/** Confirm an open antd Popconfirm (its confirm button lives in the overlay). */
async function confirmPopconfirm(page: Page): Promise<void> {
  await page
    .locator(".ant-popconfirm")
    .getByRole("button", { name: "Delete" })
    .click();
}

test.beforeAll(async () => {
  // Reset first so the seed is idempotent across Playwright projects (this file
  // runs once per viewport project — desktop/tablet/mobile).
  await resetDb();
  const cvId = await createDoc(
    "CV",
    MATCHED_CV,
    "Alice Nguyen. Node.js, NestJS, PostgreSQL, REST APIs, 6 years backend."
  );
  const jdId = await createDoc(
    "JD",
    MATCHED_JD,
    "Senior Backend Engineer. Node.js, NestJS, PostgreSQL, Docker required."
  );
  await createDoc("CV", RENAME_CV, "Draft CV used to verify rename.");
  await createDoc(
    "CV",
    DELETE_CV,
    "Throwaway CV used to verify a plain delete."
  );
  await insertMatch(cvId, jdId);
});

test.describe("home dashboard", () => {
  test("[happy][data-render] hero CTA + recent match row", async ({ page }) => {
    await page.goto("/");
    await waitHydrated(page);
    await expect(
      page.getByRole("link", { name: /start matching/i })
    ).toBeVisible();
    await expect(page.getByText("Total matches")).toBeVisible();
    await expect(
      page.getByRole("button", { name: new RegExp(MATCHED_CV) })
    ).toBeVisible();
  });

  test("[i18n] switches nav to Vietnamese", async ({ page }) => {
    await page.goto("/");
    await waitHydrated(page);
    await page.evaluate(async () => {
      await (
        window as unknown as {
          __i18n: { changeLanguage: (l: string) => Promise<unknown> };
        }
      ).__i18n.changeLanguage("vi");
    });
    // Assert on main content (visible at every viewport — the sidebar collapses
    // to a hamburger on tablet/mobile): the hero CTA switches to Vietnamese.
    await expect(page.getByRole("link", { name: /bắt đầu/i })).toBeVisible();
  });

  test("[responsive] hamburger sidebar on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    await waitHydrated(page);
    await page.getByRole("button", { name: /open menu/i }).click();
    await expect(
      page.getByRole("link", { name: "Curriculum Vitae" })
    ).toBeVisible();
  });
});

test.describe("saved CV library", () => {
  test("[happy] lists saved CVs", async ({ page }) => {
    await page.goto("/cv");
    await waitHydrated(page);
    await expect(
      page.getByRole("heading", { name: "Curriculum Vitae" })
    ).toBeVisible();

    // Scenario 8 — the old wording must be gone everywhere on this page.
    await expect(page.getByText("Saved CVs")).toHaveCount(0);
    await expect(page.getByText("Saved JDs")).toHaveCount(0);
    await expect(page.getByText(MATCHED_CV)).toBeVisible();
    await expect(page.getByText(DELETE_CV)).toBeVisible();
  });

  test("[happy] previews parsed content", async ({ page }) => {
    await page.goto("/cv");
    await waitHydrated(page);
    await row(page, MATCHED_CV)
      .getByRole("button", { name: "Preview" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Alice Nguyen/);
  });

  test("[mutation] renames a saved CV", async ({ page }) => {
    await page.goto("/cv");
    await waitHydrated(page);
    await row(page, RENAME_CV).getByRole("button", { name: "Rename" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill("E2E Renamed CV");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("E2E Renamed CV")).toBeVisible();
  });

  test("[mutation][validation] delete blocked (409) while used by a match", async ({
    page
  }) => {
    await page.goto("/cv");
    await waitHydrated(page);
    await row(page, MATCHED_CV).getByRole("button", { name: "Delete" }).click();
    await confirmPopconfirm(page);
    await expect(page.getByText(/used in a match history/i)).toBeVisible();
    await expect(page.getByText(MATCHED_CV)).toBeVisible();
  });

  test("[mutation] deletes an unreferenced CV", async ({ page }) => {
    await page.goto("/cv");
    await waitHydrated(page);
    await row(page, DELETE_CV).getByRole("button", { name: "Delete" }).click();
    await confirmPopconfirm(page);
    await expect(page.getByText(DELETE_CV)).toHaveCount(0);
  });
});
