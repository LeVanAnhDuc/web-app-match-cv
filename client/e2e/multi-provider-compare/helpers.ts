import { Client } from "pg";
import { expect, type Page } from "@playwright/test";
import {
  gotoWizard,
  nextButton,
  pasteText
} from "../cv-jd-matching-wizard/helpers";

// Gate A of the §4.3 dual-gate for `multi-provider-compare`
// (docs/specs/multi-provider-compare/e2e.md).

export const API_BASE =
  process.env.E2E_API_BASE ?? "http://localhost:5200/api/v1";

export const DB_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/matchcv";

export const VALID_KEY = "sk-e2e-multi-provider-secret-1234";

export const JD_TEXT = "Hiring a senior backend engineer with NestJS.";
export const CV_TEXT = "Senior backend engineer, six years of Node.js.";

// Globs for fixed paths (the form already proven by the wizard helpers); a
// regex is only needed where a path segment varies, as in the run detail route.
export const MATCH_ROUTE = "**/api/v1/match";
export const RUNS_ROUTE = "**/api/v1/match/runs";
export const RUN_DETAIL_ROUTE = /\/api\/v1\/match\/runs\/[^/]+$/;

export interface StubResult {
  status?: "succeeded" | "failed";
  errorCode?: string | null;
  provider?: string;
  chatModel?: string;
  overallScore?: number;
  /** Hold the response back so a slower card can be observed as a skeleton. */
  delayMs?: number;
}

function buildResult(index: number, stub: StubResult) {
  const status = stub.status ?? "succeeded";
  return {
    id: `stub-match-${index}`,
    cvDocumentId: "stub-cv",
    jdDocumentId: "stub-jd",
    overallScore: status === "failed" ? 0 : (stub.overallScore ?? 80 + index),
    semanticScore: status === "failed" ? 0 : 90,
    keywordScore: status === "failed" ? 0 : 70,
    report:
      status === "failed"
        ? { strengths: [], gaps: [], suggestions: [] }
        : {
            strengths: [`Stub strength ${index}`],
            gaps: [`Stub gap ${index}`],
            suggestions: [`Stub suggestion ${index}`]
          },
    credentialId: null,
    runId: "stub-run",
    status,
    errorCode: status === "failed" ? (stub.errorCode ?? "no_quota") : null,
    provider: stub.provider ?? "openrouter",
    chatModel: stub.chatModel ?? "openai/gpt-4o-mini",
    embedModel: "openai/text-embedding-3-small",
    createdAt: new Date().toISOString()
  };
}

/**
 * Answer `POST /match` from a script, one entry per call in order. Keeps the
 * suite offline and lets a test place a failure at a chosen position — the
 * whole point of partial success.
 */
export async function stubMatches(
  page: Page,
  script: Array<StubResult>
): Promise<() => number> {
  let call = 0;
  await page.route(MATCH_ROUTE, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    const index = call;
    call += 1;
    const stub = script[index] ?? script[script.length - 1] ?? {};
    if (stub.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, stub.delayMs));
    }
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(buildResult(index, stub))
    });
  });
  return () => call;
}

/** Seed a credential through the real API so step 3 has something to tick. */
export async function createCredential(label: string, provider = "openrouter") {
  const res = await fetch(`${API_BASE}/ai-credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, label, apiKey: VALID_KEY })
  });
  if (!res.ok) throw new Error(`seed credential failed: ${res.status}`);
  return (await res.json()) as { id: string };
}

/** Dev DB only. Runs cascade to their results. */
export async function resetRunsAndCredentials(): Promise<void> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query('DELETE FROM "MatchResult"');
    await client.query('DELETE FROM "MatchRun"');
    await client.query('DELETE FROM "AiCredential"');
  } finally {
    await client.end();
  }
}

/** Drive steps 1–2 with pasted text and land on step 3. */
export async function advanceToReview(page: Page): Promise<void> {
  await gotoWizard(page);
  await pasteText(page, JD_TEXT);
  await nextButton(page).click();
  await pasteText(page, CV_TEXT);
  await nextButton(page).click();
  await expect(
    page.getByRole("heading", { name: "Review documents" })
  ).toBeVisible();
}

export function runMatchButton(page: Page) {
  return page.getByRole("button", { name: /run match/i });
}

/** Switch the UI language through the dev-only i18n hook. */
export async function setLanguage(page: Page, lng: "en" | "vi"): Promise<void> {
  await page.evaluate(async (target) => {
    await (
      window as unknown as {
        __i18n: { changeLanguage: (l: string) => Promise<unknown> };
      }
    ).__i18n.changeLanguage(target);
  }, lng);
}
