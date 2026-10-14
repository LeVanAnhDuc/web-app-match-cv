import type { MatchResultDto } from "#/types/Matching";
import type { CvcSeed } from "@/fixtures/modules/cv-version-comparison.fixture";
import { LIVE_TEXT } from "@/data/test-data/cv-version-comparison";
import { expect, test } from "@/fixtures";

// @live-ai (D1): the only specs of this module that reach the REAL provider — they run two real matches through
// POST /match and check that the comparison built from them is consistent with the stored results. Filtered out and
// blocked by `guard` unless LIVE_AI=1. Everything else in the module reads seeded rows.

async function realMatch(seed: CvcSeed, cvId: string, jdId: string): Promise<MatchResultDto> {
  const res = await seed.api.match.create({ cvDocumentId: cvId, jdDocumentId: jdId });
  expect(res.status).toBe(201);
  const result = res.json();
  expect(result.status).toBe("succeeded");
  // Contract of a stored result: overall = round(0.6 × semantic + 0.4 × keyword), every score 0–100.
  for (const score of [result.overallScore, result.semanticScore, result.keywordScore]) {
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  }
  expect(result.overallScore).toBe(Math.round(0.6 * result.semanticScore + 0.4 * result.keywordScore));
  return result;
}

async function compareRealPair(seed: CvcSeed, texts: { jd: string; v1: string; v2: string }) {
  const jd = await seed.jd({ text: texts.jd });
  const v1 = await seed.cv({ text: texts.v1 });
  const v2 = await seed.cv({ text: texts.v2, parentId: v1 });
  const base = await realMatch(seed, v1, jd);
  const revision = await realMatch(seed, v2, jd);

  const res = await seed.api.comparisons.get(v2);
  expect(res.status).toBe(200);
  const body = res.json();
  expect(body.baseResult?.matchResultId).toBe(base.id);
  expect(body.revisionResult?.matchResultId).toBe(revision.id);
  expect(body.delta).toEqual({
    overall: revision.overallScore - base.overallScore,
    semantic: revision.semanticScore - base.semanticScore,
    keyword: revision.keywordScore - base.keywordScore,
  });
  // Every gap of each side lands in exactly one bucket, verbatim.
  const diff = body.gapDiff!;
  expect([...diff.closed, ...diff.persisted.map((p) => p.base)].sort()).toEqual([...base.report.gaps].slice(0, 50).sort());
  expect([...diff.introduced, ...diff.persisted.map((p) => p.revision)].sort()).toEqual(
    [...revision.report.gaps].slice(0, 50).sort()
  );
  return { base, revision, body };
}

test.describe("cv-version-comparison — live provider", () => {
  test(
    "hai lần match thật cho delta và gap diff khớp kết quả đã lưu",
    { tag: ["@TC-CVVERSIONCOMPARISON-030", "@live-ai"] },
    async ({ cvcSeed }) => {
      const { body } = await compareRealPair(cvcSeed, { jd: LIVE_TEXT.jd, v1: LIVE_TEXT.cvV1, v2: LIVE_TEXT.cvV2 });
      expect(body.sameChatModel).toBe(true);
      expect(body.sameEmbedModel).toBe(true);
    }
  );

  test(
    "so sánh hai phiên bản CV tiếng Việt chấm bằng provider thật",
    { tag: ["@TC-CVVERSIONCOMPARISON-031", "@live-ai"] },
    async ({ cvcSeed }) => {
      const { base, revision } = await compareRealPair(cvcSeed, {
        jd: LIVE_TEXT.jdVi,
        v1: LIVE_TEXT.cvV1Vi,
        v2: LIVE_TEXT.cvV2Vi,
      });
      // The richer Vietnamese v2 (Docker, CI/CD, PostgreSQL, TypeScript) must not score below v1 on keywords.
      expect(revision.keywordScore).toBeGreaterThanOrEqual(base.keywordScore);
    }
  );
});
