import { expect, test } from "@/fixtures";
import type { ApiClient } from "@/api";
import { EN_CV, EN_JD, VI_CV, VI_JD_ACCENTED, VI_JD_PLAIN } from "@/data/test-data/cv-jd-matching-wizard";
import { createSignedInUser, deleteUsers, type SeededUser } from "@/utils/sessions";

// @live-ai (D1): the only specs of this module that reach the real provider through POST /match on the system key.
// Filtered out and blocked by `guard` unless LIVE_AI=1; the dev server needs OPENROUTER_API_KEY. Five scoring calls in
// total. LLM output is not deterministic, so only the contract, the score formula and RELATIONS between keyword scores
// are asserted — never a fixed number (decisions Q1, Q2).

let user: SeededUser;

test.beforeAll(async () => {
  user = await createSignedInUser();
});

test.afterAll(async () => {
  await deleteUsers([user.userId]);
});

async function paste(api: ApiClient, kind: "CV" | "JD", sourceText: string): Promise<string> {
  const res = await api.documents.create({ kind, save: false, sourceText });
  expect(res.status).toBe(201);
  return res.json().id;
}

async function keywordScore(api: ApiClient, cvDocumentId: string, jdDocumentId: string): Promise<number> {
  const res = await api.match.create({ cvDocumentId, jdDocumentId });
  expect(res.status, res.text).toBe(201);
  const result = res.json();
  expect(result.status, `provider failed: ${result.errorCode}`).toBe("succeeded");
  return result.keywordScore;
}

test.describe("live scoring", () => {
  test(
    "chấm thật trả đúng hợp đồng, công thức điểm và đọc lại không đổi",
    { tag: ["@TC-CVJDMATCHINGWIZARD-070", "@live-ai"] },
    async ({ apiAs }) => {
      const api = apiAs(user);
      const cvDocumentId = await paste(api, "CV", EN_CV);
      const jdDocumentId = await paste(api, "JD", EN_JD);
      const run = await api.match.createRun({ cvDocumentId, jdDocumentId });
      expect(run.status).toBe(201);
      const runId = run.json().id;

      const res = await api.match.create({ cvDocumentId, jdDocumentId, runId });
      expect(res.status, res.text).toBe(201);
      const result = res.json();
      expect(result.status, `provider failed: ${result.errorCode}`).toBe("succeeded");
      expect(result).toMatchObject({
        id: expect.any(String),
        cvDocumentId,
        jdDocumentId,
        runId,
        credentialId: null,
        errorCode: null,
        provider: expect.any(String),
        chatModel: expect.any(String),
        embedModel: expect.any(String),
        createdAt: expect.any(String),
      });
      for (const score of [result.overallScore, result.semanticScore, result.keywordScore]) {
        expect(Number.isInteger(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
      expect(result.overallScore).toBe(Math.round(0.6 * result.semanticScore + 0.4 * result.keywordScore));
      // Most JD tokens appear in the CV: the keyword overlap cannot be zero.
      expect(result.keywordScore).toBeGreaterThan(0);
      for (const list of ["strengths", "gaps", "suggestions"] as const) {
        expect(Array.isArray(result.report[list])).toBe(true);
        for (const item of result.report[list]) expect(typeof item).toBe("string");
      }
      expect(result.report.strengths.length + result.report.suggestions.length).toBeGreaterThan(0);
      expect(res.text).not.toMatch(/apiKey|sk-or-/);

      // Stored: reading it back costs no AI call and gives the same numbers and report.
      const again = await api.match.get(result.id);
      expect(again.status).toBe(200);
      expect(again.json()).toMatchObject({
        overallScore: result.overallScore,
        semanticScore: result.semanticScore,
        keywordScore: result.keywordScore,
        report: result.report,
      });
      const detail = await api.match.getRun(runId);
      expect(detail.json().results.map((r) => r.id)).toEqual([result.id]);
    }
  );

  test(
    "JD không dấu cho cùng keywordScore với JD có dấu",
    { tag: ["@TC-CVJDMATCHINGWIZARD-071", "@live-ai"] },
    async ({ apiAs }) => {
      const api = apiAs(user);
      const cv = await paste(api, "CV", VI_CV);
      const accented = await keywordScore(api, cv, await paste(api, "JD", VI_JD_ACCENTED));
      const plain = await keywordScore(api, cv, await paste(api, "JD", VI_JD_PLAIN));

      expect(accented).toBeGreaterThan(0);
      expect(plain).toBe(accented);
    }
  );

  test(
    "cùng văn bản NFC và NFD cho cùng keywordScore",
    { tag: ["@TC-CVJDMATCHINGWIZARD-072", "@live-ai"] },
    async ({ apiAs }) => {
      const api = apiAs(user);
      const cv = await paste(api, "CV", VI_CV.normalize("NFC"));
      const nfc = await keywordScore(api, cv, await paste(api, "JD", VI_JD_ACCENTED.normalize("NFC")));
      const nfd = await keywordScore(api, cv, await paste(api, "JD", VI_JD_ACCENTED.normalize("NFD")));

      expect(nfc).toBeGreaterThan(0);
      expect(nfd).toBe(nfc);
    }
  );
});
