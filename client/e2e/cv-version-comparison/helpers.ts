import { expect, type Page } from "@playwright/test";
import type { CvComparisonDto } from "../../src/types/Comparison";
import type { DocumentSummaryDto } from "../../src/types/Documents";

// Gate A of the §4.3 dual-gate for `cv-version-comparison`
// (docs/specs/cv-version-comparison/e2e.md).
//
// Everything is route-stubbed. The comparison endpoint never calls a provider,
// so the stubbing here is about determinism rather than cost — and one test
// (`error-and-mutation`) asserts the absence of any match request, which only
// means something when nothing else is firing them either.

export const V1_ID = "11111111-1111-1111-1111-111111111111";
export const V2_ID = "22222222-2222-2222-2222-222222222222";
export const JD_ID = "33333333-3333-3333-3333-333333333333";
export const JD2_ID = "44444444-4444-4444-4444-444444444444";

// Globs for fixed paths. `*` never crosses a slash.
export const COMPARISON_ROUTE = "**/api/v1/comparisons/*";
export const SAVED_DOCS_ROUTE = "**/api/v1/documents?*";
export const DOCUMENT_PARENT_ROUTE = "**/api/v1/documents/*/parent";
export const MATCH_ROUTE = "**/api/v1/match";

export const CLOSED_GAP = "Kubernetes not mentioned";
export const BASE_GAP = "No CI/CD experience mentioned";
export const REVISION_GAP = "CI/CD exposure is still limited to one tool";
export const NEW_GAP = "No Terraform experience";

export const STUB_COMPARISON: CvComparisonDto = {
  base: {
    id: V1_ID,
    title: "Backend Resume",
    version: 1,
    createdAt: "2026-08-08T00:00:00.000Z"
  },
  revision: {
    id: V2_ID,
    title: "Backend Resume (improved)",
    version: 2,
    createdAt: "2026-08-09T00:00:00.000Z"
  },
  jdDocumentId: JD_ID,
  jdOptions: [
    {
      id: JD_ID,
      title: "Senior Backend Engineer",
      hasBase: true,
      hasRevision: true
    },
    {
      id: JD2_ID,
      title: "Platform Engineer",
      hasBase: true,
      hasRevision: false
    }
  ],
  baseResult: {
    matchResultId: "m1",
    overallScore: 61,
    semanticScore: 70,
    keywordScore: 48,
    provider: "openrouter",
    chatModel: "openai/gpt-4o-mini",
    embedModel: "openai/text-embedding-3-small",
    gaps: [BASE_GAP, CLOSED_GAP],
    createdAt: "2026-08-08T00:00:00.000Z"
  },
  revisionResult: {
    matchResultId: "m2",
    overallScore: 75,
    semanticScore: 78,
    keywordScore: 71,
    provider: "openrouter",
    chatModel: "openai/gpt-4o-mini",
    embedModel: "openai/text-embedding-3-small",
    gaps: [REVISION_GAP, NEW_GAP],
    createdAt: "2026-08-09T00:00:00.000Z"
  },
  delta: { overall: 14, semantic: 8, keyword: 23 },
  gapDiff: {
    closed: [CLOSED_GAP],
    persisted: [{ base: BASE_GAP, revision: REVISION_GAP }],
    introduced: [NEW_GAP]
  },
  sameChatModel: true,
  sameEmbedModel: true
};

export const SAVED_CVS: Array<DocumentSummaryDto> = [
  {
    id: V1_ID,
    kind: "CV",
    title: "Backend Resume",
    sourceFormat: "text",
    parentId: null,
    createdAt: "2026-08-08T00:00:00.000Z"
  },
  {
    id: V2_ID,
    kind: "CV",
    title: "Backend Resume (improved)",
    sourceFormat: "text",
    parentId: V1_ID,
    createdAt: "2026-08-09T00:00:00.000Z"
  }
];

async function json(
  route: Parameters<Parameters<Page["route"]>[1]>[0],
  body: unknown,
  status = 200
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
}

/** Answer GET /comparisons/:id with a comparison, or with an HTTP error. */
export async function stubComparison(
  page: Page,
  outcome: Partial<CvComparisonDto> | { status: number } = {}
): Promise<() => Array<string>> {
  const urls: Array<string> = [];
  await page.route(COMPARISON_ROUTE, async (route) => {
    urls.push(route.request().url());
    if ("status" in outcome && typeof outcome.status === "number") {
      await json(route, { message: "stubbed failure" }, outcome.status);
      return;
    }
    await json(route, { ...STUB_COMPARISON, ...outcome });
  });
  return () => urls;
}

/** Answer the library's saved-document list. */
export async function stubSavedDocs(
  page: Page,
  docs: Array<DocumentSummaryDto> = SAVED_CVS
): Promise<void> {
  await page.route(SAVED_DOCS_ROUTE, (route) => json(route, docs));
}

/** Answer PATCH /documents/:id/parent, capturing what the client sent. */
export async function stubSetParent(
  page: Page,
  status = 200
): Promise<() => Array<{ parentId: string | null }>> {
  const bodies: Array<{ parentId: string | null }> = [];
  await page.route(DOCUMENT_PARENT_ROUTE, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }
    bodies.push(route.request().postDataJSON() as { parentId: string | null });
    if (status !== 200) {
      await json(route, { message: "stubbed failure" }, status);
      return;
    }
    await json(route, { ...SAVED_CVS[1], rawText: "…", isSaved: true });
  });
  return () => bodies;
}

/** Open the comparison page directly and wait for hydration. */
export async function gotoCompare(
  page: Page,
  documentId = V2_ID,
  search = ""
): Promise<void> {
  await page.goto(`/compare/${documentId}${search}`);
  await expect(
    page.getByRole("heading", { name: "Version comparison" })
  ).toBeVisible();
  // Dev-only hook attached after hydration — a reliable "React is wired" signal.
  await page.waitForFunction(() => "__i18n" in window, undefined, {
    timeout: 15000
  });
}

/**
 * Open an antd `Select` by name.
 *
 * Clicking the combobox itself is flaky: antd puts the `combobox` role on a
 * readonly search input that sits UNDER the rendered selection label, so once
 * a value is shown Playwright reports the label "intercepts pointer events".
 * `{ force: true }` silences that but also drops the stability wait, which
 * loses the race against a modal's entrance animation.
 *
 * Clicking the wrapper instead keeps every actionability check: the hit target
 * resolves to the label, which is a descendant of the element being clicked,
 * so Playwright is satisfied and antd receives the mousedown it opens on.
 */
export async function openSelect(page: Page, name: string): Promise<void> {
  await page
    .locator(".ant-select")
    .filter({ has: page.getByRole("combobox", { name }) })
    .click();
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
