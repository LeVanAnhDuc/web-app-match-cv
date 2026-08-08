import { expect, type Page } from "@playwright/test";
import type { MatchResultDto } from "../../src/types/Matching";
import type { CvRewriteProposalDto } from "../../src/types/CvRewrite";
import type { DocumentDto } from "../../src/types/Documents";

// Gate A of the §4.3 dual-gate for `cv-rewrite-assistant`
// (docs/specs/cv-rewrite-assistant/e2e.md).
//
// Everything is route-stubbed: generating a rewrite is a real chat completion
// on a real provider, which an E2E suite must never spend.

export const MATCH_ID = "11111111-1111-1111-1111-111111111111";
export const CV_ID = "22222222-2222-2222-2222-222222222222";
export const JD_ID = "33333333-3333-3333-3333-333333333333";

export const API_BULLET = "Built REST APIs with Node.js and Express.";
export const MIGRATION_BULLET = "Led a monolith migration across three teams.";

export const CV_TEXT = `EXPERIENCE\n- ${API_BULLET}\n- ${MIGRATION_BULLET}`;

// Globs for fixed paths. `*` does not cross a slash, so `**/api/v1/cv-rewrite`
// matches only the base path and never `/cv-rewrite/accept`.
export const REWRITE_ROUTE = "**/api/v1/cv-rewrite";
export const ACCEPT_ROUTE = "**/api/v1/cv-rewrite/accept";
export const MATCH_BY_ID_ROUTE = "**/api/v1/match/*";
export const HISTORY_ROUTE = "**/api/v1/match";
export const DOCUMENT_ROUTE = "**/api/v1/documents/*";
export const CREDENTIALS_ROUTE = "**/api/v1/ai-credentials";
export const PROVIDERS_ROUTE = "**/api/v1/ai-credentials/providers";

export const STUB_MATCH: MatchResultDto = {
  id: MATCH_ID,
  cvDocumentId: CV_ID,
  jdDocumentId: JD_ID,
  overallScore: 61,
  semanticScore: 70,
  keywordScore: 48,
  report: {
    strengths: ["Solid Node.js fundamentals"],
    gaps: ["No CI/CD experience mentioned"],
    suggestions: ["Mention delivery pipelines"]
  },
  credentialId: null,
  runId: null,
  status: "succeeded",
  errorCode: null,
  provider: "openrouter",
  chatModel: "openai/gpt-4o-mini",
  embedModel: "openai/text-embedding-3-small",
  createdAt: "2026-08-09T00:00:00.000Z"
};

export const STUB_CV: DocumentDto = {
  id: CV_ID,
  kind: "CV",
  title: "Backend Resume",
  sourceFormat: "text",
  rawText: CV_TEXT,
  isSaved: true,
  parentId: null,
  createdAt: "2026-08-09T00:00:00.000Z"
};

export const STUB_PROPOSAL: CvRewriteProposalDto = {
  matchResultId: MATCH_ID,
  cvDocumentId: CV_ID,
  cvTitle: STUB_CV.title,
  provider: "openrouter",
  chatModel: "openai/gpt-4o-mini",
  changes: [
    {
      id: "0",
      sectionHint: "Experience",
      original: API_BULLET,
      replacement: "Built, documented and deployed REST APIs.",
      rationale: "Names the delivery work the JD asks for.",
      addressesGap: "No CI/CD experience mentioned"
    },
    {
      id: "1",
      sectionHint: "Experience",
      original: MIGRATION_BULLET,
      replacement: `${MIGRATION_BULLET} Automated the release pipeline.`,
      rationale: "Ties the migration to CI/CD.",
      addressesGap: null
    }
  ],
  unaddressedGaps: ["5 years of Kubernetes in production"]
};

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

/** Everything the rewrite page reads before the user presses anything. */
export async function stubPageContext(
  page: Page,
  over: { match?: Partial<MatchResultDto>; cv?: Partial<DocumentDto> } = {}
): Promise<void> {
  await page.route(PROVIDERS_ROUTE, (route) =>
    json(route, [
      {
        id: "openrouter",
        label: "OpenRouter",
        defaultChatModel: "openai/gpt-4o-mini",
        defaultEmbedModel: "openai/text-embedding-3-small"
      }
    ])
  );
  await page.route(CREDENTIALS_ROUTE, (route) => json(route, []));
  await page.route(DOCUMENT_ROUTE, (route) =>
    json(route, { ...STUB_CV, ...over.cv })
  );
  await page.route(MATCH_BY_ID_ROUTE, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await json(route, { ...STUB_MATCH, ...over.match });
  });
}

/** Answer POST /cv-rewrite with a proposal, or with an HTTP error. */
export async function stubGenerate(
  page: Page,
  outcome: Partial<CvRewriteProposalDto> | { status: number }
): Promise<() => number> {
  let calls = 0;
  await page.route(REWRITE_ROUTE, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    calls += 1;
    if ("status" in outcome && typeof outcome.status === "number") {
      await json(route, { message: "stubbed failure" }, outcome.status);
      return;
    }
    await json(route, { ...STUB_PROPOSAL, ...outcome }, 201);
  });
  return () => calls;
}

/** Answer POST /cv-rewrite/accept, capturing what the client actually sent. */
export async function stubAccept(
  page: Page,
  status = 201
): Promise<
  () => Array<{ title: string; changes: Array<{ original: string }> }>
> {
  const bodies: Array<{ title: string; changes: Array<{ original: string }> }> =
    [];
  await page.route(ACCEPT_ROUTE, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    bodies.push(
      route.request().postDataJSON() as {
        title: string;
        changes: Array<{ original: string }>;
      }
    );
    if (status !== 201) {
      await json(route, { message: "stubbed failure" }, status);
      return;
    }
    await json(
      route,
      {
        ...STUB_CV,
        id: "new-cv-id",
        title: "Backend Resume (improved)",
        parentId: CV_ID
      },
      201
    );
  });
  return () => bodies;
}

/** Open the rewrite page directly and wait for hydration. */
export async function gotoRewrite(
  page: Page,
  matchId = MATCH_ID
): Promise<void> {
  await page.goto(`/cv-rewrite/${matchId}`);
  await expect(
    page.getByRole("heading", { name: "Improve this CV" })
  ).toBeVisible();
  // Dev-only hook attached after hydration — a reliable "React is wired" signal.
  await page.waitForFunction(() => "__i18n" in window, undefined, {
    timeout: 15000
  });
}

export function generateButton(page: Page) {
  return page.getByRole("button", { name: /Generate suggestions|Sinh gợi ý/ });
}

export function saveButton(page: Page) {
  return page.getByRole("button", { name: /Save as new CV|Lưu thành CV mới/ });
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
