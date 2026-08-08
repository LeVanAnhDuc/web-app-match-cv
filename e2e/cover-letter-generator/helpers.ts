import { expect, type Locator, type Page } from "@playwright/test";
import { Client } from "pg";
import type { CoverLetterDto } from "../../src/types/CoverLetters";
import {
  advanceToReview,
  runMatchButton,
  stubMatches,
  DB_URL
} from "../multi-provider-compare/helpers";

// Gate A of the §4.3 dual-gate for `cover-letter-generator`
// (docs/specs/cover-letter-generator/e2e.md).

// A GLOB, not an anchored regex: `page.route(/\/cover-letters$/)` silently
// fails to intercept, and the trailing `**` is what also catches the query
// string on the list call and the id segment on PATCH/DELETE.
export const LETTERS_ROUTE = "**/api/v1/cover-letters**";

export const MATCH_ID = "stub-match-0";

export interface LetterStubOptions {
  /** Seed the store so the modal opens with drafts already present. */
  seed?: Array<Partial<CoverLetterDto>>;
  /** Force the next POST to answer with a stored failure row. */
  failNextGenerate?: CoverLetterDto["errorCode"];
  /** Answer GET with this status instead of 200. */
  listStatus?: number;
  /** Answer PATCH with this status instead of 200. */
  patchStatus?: number;
  /** Hold POST back so the pending state can be observed. */
  generateDelayMs?: number;
}

export interface LetterStubHandle {
  postCount: () => number;
  patchCount: () => number;
  deleteCount: () => number;
  rows: () => Array<CoverLetterDto>;
}

let seq = 0;

function makeLetter(over: Partial<CoverLetterDto> = {}): CoverLetterDto {
  seq += 1;
  return {
    id: `letter-${seq}`,
    matchResultId: MATCH_ID,
    tone: "formal",
    length: "standard",
    language: "en",
    content: "Dear hiring manager,\n\nI am writing to apply.",
    omittedRequirements: [],
    status: "succeeded",
    errorCode: null,
    edited: false,
    credentialId: null,
    provider: "openrouter",
    chatModel: "openai/gpt-4o-mini",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over
  };
}

/**
 * Answer the whole /cover-letters surface from memory. Keeps the suite offline
 * — a real generation would spend AI budget — while still exercising the exact
 * contract the UI depends on, failures included.
 */
export async function stubCoverLetters(
  page: Page,
  options: LetterStubOptions = {}
): Promise<LetterStubHandle> {
  const store: Array<CoverLetterDto> = (options.seed ?? []).map((row) =>
    makeLetter(row)
  );
  let posts = 0;
  let patches = 0;
  let deletes = 0;

  await page.route(LETTERS_ROUTE, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const idFromPath = url.pathname.split("/cover-letters/")[1] ?? "";

    if (request.method() === "GET") {
      if (options.listStatus && options.listStatus !== 200) {
        await route.fulfill({
          status: options.listStatus,
          contentType: "application/json",
          body: JSON.stringify({ message: "boom" })
        });
        return;
      }
      const matchResultId = url.searchParams.get("matchResultId");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          store.filter((row) => row.matchResultId === matchResultId)
        )
      });
      return;
    }

    if (request.method() === "POST") {
      posts += 1;
      if (options.generateDelayMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, options.generateDelayMs)
        );
      }
      const body = request.postDataJSON() as Partial<CoverLetterDto>;
      const failed = options.failNextGenerate;
      const created = makeLetter(
        failed
          ? {
              ...body,
              status: "failed",
              errorCode: failed,
              content: "",
              omittedRequirements: []
            }
          : body
      );
      // Newest first, matching the server's `createdAt desc`.
      store.unshift(created);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(created)
      });
      return;
    }

    if (request.method() === "PATCH") {
      patches += 1;
      if (options.patchStatus && options.patchStatus !== 200) {
        await route.fulfill({
          status: options.patchStatus,
          contentType: "application/json",
          body: JSON.stringify({ message: "boom" })
        });
        return;
      }
      const target = store.find((row) => row.id === idFromPath);
      if (!target) {
        await route.fulfill({ status: 404, body: "{}" });
        return;
      }
      const body = request.postDataJSON() as { content: string };
      target.content = body.content;
      target.edited = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(target)
      });
      return;
    }

    if (request.method() === "DELETE") {
      deletes += 1;
      const index = store.findIndex((row) => row.id === idFromPath);
      if (index >= 0) store.splice(index, 1);
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.fallback();
  });

  return {
    postCount: () => posts,
    patchCount: () => patches,
    deleteCount: () => deletes,
    rows: () => store
  };
}

/** Drive the wizard to a succeeded result card, the only entry point. */
export async function advanceToResult(page: Page): Promise<void> {
  await stubMatches(page, [
    {
      overallScore: 82
    }
  ]);
  await advanceToReview(page);
  await runMatchButton(page).click();
  await expect(page.getByText("82%")).toBeVisible({ timeout: 30000 });
}

export function openLetterButton(page: Page) {
  return page.getByRole("button", { name: "Write cover letter" });
}

export function letterDialog(page: Page) {
  return page.getByRole("dialog");
}

/**
 * antd Segmented hides its native radio (opacity 0) and drives state from the
 * visible label, so clicking the input does nothing — the same trap already
 * documented in cv-jd-matching-wizard/helpers.ts `switchToPasteTab`.
 */
export function segmentedOption(dialog: Locator, label: string) {
  return dialog.locator(".ant-segmented-item").filter({ hasText: label });
}

export function selectedSegment(dialog: Locator, group: string) {
  return dialog
    .getByRole("group", { name: group, exact: true })
    .locator(".ant-segmented-item-selected");
}

/**
 * EXACT on purpose: Playwright's `name` is a substring match by default, and
 * the row's delete button is labelled "Delete draft: <same description>", so a
 * loose match resolves to two elements.
 */
export function draftRow(dialog: Locator, description: string) {
  return dialog.getByRole("button", { name: description, exact: true });
}

export function deleteDraftButton(dialog: Locator, description: string) {
  return dialog.getByRole("button", {
    name: `Delete draft: ${description}`,
    exact: true
  });
}

/** Open the wizard, run a match, and open the cover-letter modal. */
export async function openLetterModal(page: Page): Promise<void> {
  await advanceToResult(page);
  await openLetterButton(page).click();
  await expect(letterDialog(page)).toBeVisible();
}

/** Dev DB only — the suite creates documents/matches through the real API. */
export async function resetLetters(): Promise<void> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    // FK order: letters hang off results, results off runs and documents.
    await client.query('DELETE FROM "CoverLetter"');
    await client.query('DELETE FROM "MatchResult"');
    await client.query('DELETE FROM "MatchRun"');
  } finally {
    await client.end();
  }
}
