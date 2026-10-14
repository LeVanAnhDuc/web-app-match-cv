import { randomUUID } from "node:crypto";
import { serverMessage } from "@/data/copy";
import { FORBIDDEN_RESPONSE_KEYS, GAPS, HAPPY_DELTA } from "@/data/test-data/cv-version-comparison";
import { expect, test } from "@/fixtures";

// GET /comparisons/:documentId — response shape and its error classes (REQ-CVVERSIONCOMPARISON-05/06/27).

/** Every key of a JSON value, at any depth. */
function keysDeep(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => keysDeep(item, into));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      into.add(key);
      keysDeep(child, into);
    }
  }
  return into;
}

test.describe("cv-version-comparison — GET /comparisons contract", () => {
  test(
    "so sánh hai phiên bản trả delta, gap diff và số phiên bản",
    { tag: ["@TC-CVVERSIONCOMPARISON-005", "@smoke"] },
    async ({ cvcSeed }) => {
      const { v1, v2, jd, titles } = await cvcSeed.happyPair();

      const res = await cvcSeed.api.comparisons.get(v2);

      expect(res.status).toBe(200);
      const body = res.json();
      expect(body.base).toEqual({ id: v1, title: titles.v1, version: 1, createdAt: expect.any(String) });
      expect(body.revision).toEqual({ id: v2, title: titles.v2, version: 2, createdAt: expect.any(String) });
      expect(body.jdDocumentId).toBe(jd);
      expect(body.jdOptions).toEqual([{ id: jd, title: titles.jd, hasBase: true, hasRevision: true }]);
      expect(body.baseResult).toMatchObject({ overallScore: 61, semanticScore: 70, keywordScore: 48 });
      expect(body.revisionResult).toMatchObject({ overallScore: 75, semanticScore: 78, keywordScore: 71 });
      expect(body.delta).toEqual(HAPPY_DELTA);
      expect(body.gapDiff).toEqual({
        closed: [GAPS.closed],
        persisted: [{ base: GAPS.reworded.base, revision: GAPS.reworded.revision }],
        introduced: [GAPS.introduced],
      });
      expect(body.sameChatModel).toBe(true);
      expect(body.sameEmbedModel).toBe(true);
    }
  );

  test(
    "response không chứa raw text, file, errorCode hay key",
    { tag: ["@TC-CVVERSIONCOMPARISON-006", "@smoke"] },
    async ({ cvcSeed }) => {
      const { v2, texts } = await cvcSeed.happyPair();

      const res = await cvcSeed.api.comparisons.get(v2);

      expect(res.status).toBe(200);
      const keys = keysDeep(res.json());
      for (const forbidden of FORBIDDEN_RESPONSE_KEYS) expect(keys.has(forbidden), `key "${forbidden}"`).toBe(false);
      for (const text of Object.values(texts)) expect(res.text).not.toContain(text);
    }
  );

  test(
    "documentId sai lớp trả đúng mã lỗi và message",
    { tag: ["@TC-CVVERSIONCOMPARISON-007"] },
    async ({ cvcSeed }) => {
      const root = await cvcSeed.cv();
      const jd = await cvcSeed.jd();

      const notUuid = await cvcSeed.api.comparisons.get("not-a-uuid");
      expect(notUuid.status).toBe(400);

      const unknown = await cvcSeed.api.comparisons.get(randomUUID());
      expect(unknown.status).toBe(404);
      expect(unknown.error().message).toBe(serverMessage("comparison.errors.documentNotFound"));

      const isJd = await cvcSeed.api.comparisons.get(jd);
      expect(isJd.status).toBe(400);
      expect(isJd.error().message).toBe(serverMessage("comparison.errors.notCv"));

      const noParent = await cvcSeed.api.comparisons.get(root);
      expect(noParent.status).toBe(400);
      expect(noParent.error().message).toBe(serverMessage("comparison.errors.noParent"));
    }
  );

  test(
    "jdDocumentId không hợp lệ bị từ chối, không âm thầm đổi JD",
    { tag: ["@TC-CVVERSIONCOMPARISON-008"] },
    async ({ cvcSeed }) => {
      const { v2 } = await cvcSeed.happyPair();
      const unmatchedJd = await cvcSeed.jd();

      const notUuid = await cvcSeed.api.comparisons.get(v2, { jdDocumentId: "not-a-uuid" });
      expect(notUuid.status).toBe(400);

      for (const jdDocumentId of [randomUUID(), unmatchedJd]) {
        const res = await cvcSeed.api.comparisons.get(v2, { jdDocumentId });
        expect(res.status).toBe(400);
        expect(res.error().message).toBe(serverMessage("comparison.errors.jdNotComparable"));
      }
    }
  );

  test(
    "bản gốc bị xoá biến so sánh thành noParent",
    { tag: ["@TC-CVVERSIONCOMPARISON-009"] },
    async ({ cvcSeed }) => {
      const v1 = await cvcSeed.cv();
      const v2 = await cvcSeed.cv({ parentId: v1 });

      // v1 has no match, so the library delete is allowed; ON DELETE SET NULL unlinks v2.
      const removed = await cvcSeed.api.documents.remove(v1);
      expect(removed.status).toBe(204);

      const res = await cvcSeed.api.comparisons.get(v2);
      expect(res.status).toBe(400);
      expect(res.error().message).toBe(serverMessage("comparison.errors.noParent"));
    }
  );

  test(
    "message lỗi so sánh theo ngôn ngữ của request",
    { tag: ["@TC-CVVERSIONCOMPARISON-010"] },
    async ({ cvcSeed }) => {
      const { v2 } = await cvcSeed.happyPair();
      const root = await cvcSeed.cv();
      const jd = await cvcSeed.jd();
      const vi = cvcSeed.api.lang("vi");

      expect((await vi.comparisons.get(randomUUID())).error().message).toBe(
        serverMessage("comparison.errors.documentNotFound", "vi")
      );
      expect((await vi.comparisons.get(jd)).error().message).toBe(serverMessage("comparison.errors.notCv", "vi"));
      expect((await vi.comparisons.get(root)).error().message).toBe(serverMessage("comparison.errors.noParent", "vi"));
      expect((await vi.comparisons.get(v2, { jdDocumentId: jd })).error().message).toBe(
        serverMessage("comparison.errors.jdNotComparable", "vi")
      );
    }
  );
});
