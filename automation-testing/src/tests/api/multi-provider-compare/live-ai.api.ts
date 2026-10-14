import { test, expect } from "@/fixtures";
import type { ApiClient } from "@/api";
import {
  credentialLabel,
  expectedOverall,
  fakeApiKey,
  MPC_ERROR_CODES,
  MPC_TEXT,
  MPC_VI_TEXT,
} from "@/data/test-data/multi-provider-compare";
import { createSignedInUser, deleteUsers, type SeededUser } from "@/utils/sessions";
import type { MatchResultDto } from "#/types/Matching";

// @live-ai (D1): these reach the REAL provider — the dev server's system key (OpenRouter) and, for the failure branch,
// OpenRouter with a fake key. Filtered out and blocked by `guard` unless LIVE_AI=1. Each POST /match costs one embed
// pair + one report; the provider can take tens of seconds.

const LIVE_TIMEOUT = 180_000;

function expectScoreContract(result: MatchResultDto) {
  for (const score of [result.overallScore, result.semanticScore, result.keywordScore]) {
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  }
  expect(result.overallScore).toBe(expectedOverall(result.semanticScore, result.keywordScore));
}

test.describe("POST /match against the real provider", () => {
  let owner: SeededUser;
  let client: ApiClient;

  test.beforeAll(async ({ apiAs }) => {
    owner = await createSignedInUser();
    client = apiAs(owner);
  });

  test.afterAll(async () => {
    await deleteUsers([owner.userId]);
  });

  const pair = async (cvText: string, jdText: string) => {
    const cvId = (await client.documents.create({ kind: "CV", sourceText: cvText, save: false })).json().id;
    const jdId = (await client.documents.create({ kind: "JD", sourceText: jdText, save: false })).json().id;
    return { cvId, jdId };
  };

  test(
    "key hệ thống trả kết quả succeeded đúng hợp đồng và công thức điểm",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-019", "@live-ai"] },
    async () => {
      test.setTimeout(LIVE_TIMEOUT);
      const { cvId, jdId } = await pair(MPC_TEXT.cv, MPC_TEXT.jd);
      const runId = (await client.match.createRun({ cvDocumentId: cvId, jdDocumentId: jdId })).json().id;

      const res = await client.match.create({ cvDocumentId: cvId, jdDocumentId: jdId, runId });

      expect(res.status).toBe(201);
      const result = res.json();
      expect(result).toMatchObject({
        cvDocumentId: cvId,
        jdDocumentId: jdId,
        runId,
        credentialId: null,
        status: "succeeded",
        errorCode: null,
        provider: "openrouter",
      });
      expect(result.chatModel).toEqual(expect.any(String));
      expect(result.embedModel).toEqual(expect.any(String));
      expectScoreContract(result);
      for (const list of [result.report.strengths, result.report.gaps, result.report.suggestions]) {
        expect(Array.isArray(list)).toBe(true);
      }
      expect(result.report.strengths.length + result.report.gaps.length + result.report.suggestions.length).toBeGreaterThan(0);

      const detail = (await client.match.getRun(runId)).json();
      expect(detail.results.map((r) => r.id)).toEqual([result.id]);
    }
  );

  test(
    "key bị provider từ chối thành kết quả failed trong run, provider khác vẫn thành công",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-020", "@live-ai"] },
    async () => {
      test.setTimeout(LIVE_TIMEOUT);
      const apiKey = fakeApiKey();
      const credential = await client.aiCredentials.create({ provider: "openrouter", label: credentialLabel("dead"), apiKey });
      expect(credential.status).toBe(201);
      const credentialId = credential.json().id;
      const { cvId, jdId } = await pair(MPC_TEXT.cv, MPC_TEXT.jd);
      const runId = (await client.match.createRun({ cvDocumentId: cvId, jdDocumentId: jdId })).json().id;

      const dead = await client.match.create({ cvDocumentId: cvId, jdDocumentId: jdId, runId, credentialId });

      // A dead provider is the card's outcome, not the request's failure.
      expect(dead.status).toBe(201);
      const failed = dead.json();
      expect(failed).toMatchObject({
        runId,
        credentialId,
        status: "failed",
        errorCode: "invalid_key",
        overallScore: 0,
        semanticScore: 0,
        keywordScore: 0,
        report: { strengths: [], gaps: [], suggestions: [] },
        provider: "openrouter",
      });
      expect(MPC_ERROR_CODES).toContain(failed.errorCode);
      expect(JSON.stringify(dead.body)).not.toContain(apiKey);
      expect(JSON.stringify(dead.body)).not.toContain(apiKey.slice(-8));

      const alive = await client.match.create({ cvDocumentId: cvId, jdDocumentId: jdId, runId });
      expect(alive.status).toBe(201);
      expect(alive.json()).toMatchObject({ runId, credentialId: null, status: "succeeded", errorCode: null });

      const results = (await client.match.getRun(runId)).json().results;
      expect(results).toHaveLength(2);
      expect(results.find((r) => r.credentialId === credentialId)?.status).toBe("failed");
      expect(results.find((r) => r.credentialId === null)?.status).toBe("succeeded");
    }
  );

  test(
    "CV tiếng Việt phù hợp được điểm cao hơn CV tiếng Việt không liên quan",
    { tag: ["@TC-MULTIPROVIDERCOMPARE-021", "@live-ai"] },
    async () => {
      test.setTimeout(LIVE_TIMEOUT);
      const matching = await pair(MPC_VI_TEXT.matchingCv, MPC_VI_TEXT.jd);
      const unrelated = await pair(MPC_VI_TEXT.unrelatedCv, MPC_VI_TEXT.jd);

      const good = await client.match.create({ cvDocumentId: matching.cvId, jdDocumentId: matching.jdId });
      const bad = await client.match.create({ cvDocumentId: unrelated.cvId, jdDocumentId: unrelated.jdId });

      expect(good.status).toBe(201);
      expect(bad.status).toBe(201);
      expect(good.json().status).toBe("succeeded");
      expect(bad.json().status).toBe("succeeded");
      expectScoreContract(good.json());
      expectScoreContract(bad.json());
      expect(good.json().overallScore).toBeGreaterThan(bad.json().overallScore);
      expect(good.json().keywordScore).toBeGreaterThan(bad.json().keywordScore);
    }
  );
});
