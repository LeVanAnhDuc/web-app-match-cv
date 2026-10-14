import { GLOBAL_THROTTLE_LIMIT, MAX_LINEAGE_DEPTH, MODELS } from "@/data/test-data/cv-version-comparison";
import { expect, test } from "@/fixtures";

// Which JD and which stored runs a comparison is built from, the delta it derives and the version numbers
// (REQ-CVVERSIONCOMPARISON-07/08/09/10/11). Seeded timestamps move forward one minute per match (cvcSeed clock),
// so "newest" below is simply "seeded later".

test.describe("cv-version-comparison — result selection", () => {
  test(
    "jdOptions liệt kê mọi JD đã match, mới nhất trước, gồm JD chưa lưu, cờ đúng",
    { tag: ["@TC-CVVERSIONCOMPARISON-011"] },
    async ({ cvcSeed }) => {
      const v1 = await cvcSeed.cv();
      const v2 = await cvcSeed.cv({ parentId: v1 });
      const both = await cvcSeed.jd({ title: cvcSeed.title("Both JD") });
      const baseOnly = await cvcSeed.jd({ title: cvcSeed.title("Base-only JD"), saved: false });
      const revisionOnly = await cvcSeed.jd({ title: cvcSeed.title("Revision-only JD") });
      const failedOnly = await cvcSeed.jd({ title: cvcSeed.title("Failed-only JD") });
      await cvcSeed.match(v1, both);
      await cvcSeed.match(v2, both);
      await cvcSeed.match(v1, baseOnly);
      await cvcSeed.match(v2, revisionOnly);
      await cvcSeed.match(v2, failedOnly, { status: "failed", scores: [0, 0, 0] });

      const res = await cvcSeed.api.comparisons.get(v2);

      expect(res.status).toBe(200);
      expect(res.json().jdOptions.map(({ id, hasBase, hasRevision }) => ({ id, hasBase, hasRevision }))).toEqual([
        { id: revisionOnly, hasBase: false, hasRevision: true },
        { id: baseOnly, hasBase: true, hasRevision: false },
        { id: both, hasBase: true, hasRevision: true },
      ]);
    }
  );

  test(
    "JD mặc định là JD mới nhất đủ hai bên, rồi JD đầu danh sách, rồi null",
    { tag: ["@TC-CVVERSIONCOMPARISON-012"] },
    async ({ cvcSeed }) => {
      // Complete pair exists but is older than a one-sided JD → the complete one is chosen.
      const a1 = await cvcSeed.cv();
      const a2 = await cvcSeed.cv({ parentId: a1 });
      const complete = await cvcSeed.jd();
      const newer = await cvcSeed.jd();
      await cvcSeed.match(a1, complete);
      await cvcSeed.match(a2, complete);
      await cvcSeed.match(a2, newer);
      expect((await cvcSeed.api.comparisons.get(a2)).json().jdDocumentId).toBe(complete);

      // No complete pair → the head of the list (most recently matched), with the missing side null.
      const b1 = await cvcSeed.cv();
      const b2 = await cvcSeed.cv({ parentId: b1 });
      const older = await cvcSeed.jd();
      const latest = await cvcSeed.jd();
      await cvcSeed.match(b1, older);
      await cvcSeed.match(b1, latest);
      const oneSided = (await cvcSeed.api.comparisons.get(b2)).json();
      expect(oneSided.jdDocumentId).toBe(latest);
      expect(oneSided.revisionResult).toBeNull();
      expect(oneSided.baseResult).not.toBeNull();

      // Never matched → everything null.
      const c1 = await cvcSeed.cv();
      const c2 = await cvcSeed.cv({ parentId: c1 });
      const empty = (await cvcSeed.api.comparisons.get(c2)).json();
      expect(empty).toMatchObject({
        jdDocumentId: null,
        jdOptions: [],
        baseResult: null,
        revisionResult: null,
        delta: null,
        gapDiff: null,
      });
    }
  );

  test(
    "jdDocumentId hợp lệ được dùng đúng JD đó",
    { tag: ["@TC-CVVERSIONCOMPARISON-013"] },
    async ({ cvcSeed }) => {
      const v1 = await cvcSeed.cv();
      const v2 = await cvcSeed.cv({ parentId: v1 });
      const first = await cvcSeed.jd();
      const second = await cvcSeed.jd();
      await cvcSeed.match(v1, first, { scores: [40, 40, 40] });
      await cvcSeed.match(v2, first, { scores: [50, 50, 50] });
      await cvcSeed.match(v1, second, { scores: [70, 60, 80] });
      await cvcSeed.match(v2, second, { scores: [65, 66, 60] });

      const res = await cvcSeed.api.comparisons.get(v2, { jdDocumentId: first });

      expect(res.status).toBe(200);
      expect(res.json().jdDocumentId).toBe(first);
      expect(res.json().delta).toEqual({ overall: 10, semantic: 10, keyword: 10 });
    }
  );

  test(
    "lần match failed không bao giờ được chọn",
    { tag: ["@TC-CVVERSIONCOMPARISON-014"] },
    async ({ cvcSeed }) => {
      const { v1, v2, jd } = await cvcSeed.happyPair();
      // Newer failed rows on both sides store 0/0/0; picking one would turn +14 into -61 or +75.
      await cvcSeed.match(v2, jd, { status: "failed", scores: [0, 0, 0] });
      await cvcSeed.match(v1, jd, { status: "failed", scores: [0, 0, 0] });

      const body = (await cvcSeed.api.comparisons.get(v2)).json();

      expect(body.delta?.overall).toBe(14);
      expect(body.revisionResult?.overallScore).toBe(75);
      expect(body.baseResult?.overallScore).toBe(61);
    }
  );

  test(
    "bản gốc ưu tiên lần match cùng model, không có thì lấy mới nhất và báo khác model",
    { tag: ["@TC-CVVERSIONCOMPARISON-015"] },
    async ({ cvcSeed }) => {
      const v1 = await cvcSeed.cv();
      const v2 = await cvcSeed.cv({ parentId: v1 });
      const jd = await cvcSeed.jd();
      const sameModels = await cvcSeed.match(v1, jd, { scores: [60, 60, 60] });
      await cvcSeed.match(v1, jd, { scores: [10, 10, 10], chatModel: MODELS.otherChat });
      await cvcSeed.match(v2, jd, { scores: [70, 70, 70] });

      const preferred = (await cvcSeed.api.comparisons.get(v2)).json();
      expect(preferred.baseResult?.matchResultId).toBe(sameModels);
      expect(preferred.delta).toEqual({ overall: 10, semantic: 10, keyword: 10 });
      expect(preferred.sameChatModel).toBe(true);
      expect(preferred.sameEmbedModel).toBe(true);

      // A second pair with no same-model base run at all.
      const w1 = await cvcSeed.cv();
      const w2 = await cvcSeed.cv({ parentId: w1 });
      await cvcSeed.match(w1, jd, { scores: [30, 30, 30], embedModel: MODELS.otherEmbed });
      const newestBase = await cvcSeed.match(w1, jd, { scores: [40, 40, 40], embedModel: MODELS.otherEmbed });
      await cvcSeed.match(w2, jd, { scores: [45, 45, 45] });

      const fallback = (await cvcSeed.api.comparisons.get(w2)).json();
      expect(fallback.baseResult?.matchResultId).toBe(newestBase);
      expect(fallback.sameChatModel).toBe(true);
      expect(fallback.sameEmbedModel).toBe(false);
    }
  );

  test(
    "thiếu một bên thì delta và gapDiff là null, không bịa số 0",
    { tag: ["@TC-CVVERSIONCOMPARISON-016"] },
    async ({ cvcSeed }) => {
      const { v1, jd } = await cvcSeed.happyPair();
      const lonely = await cvcSeed.cv({ parentId: v1 });

      const res = await cvcSeed.api.comparisons.get(lonely);

      expect(res.status).toBe(200);
      const body = res.json();
      expect(body.revisionResult).toBeNull();
      expect(body.baseResult).not.toBeNull();
      expect(body.delta).toBeNull();
      expect(body.gapDiff).toBeNull();
      expect(body.sameChatModel).toBe(true);
      expect(body.sameEmbedModel).toBe(true);
      // The JD the parent was matched against is still offered.
      expect(body.jdOptions).toEqual([expect.objectContaining({ id: jd, hasBase: true, hasRevision: false })]);
    }
  );

  test(
    "bản mới kém hơn cho delta âm có dấu",
    { tag: ["@TC-CVVERSIONCOMPARISON-017"] },
    async ({ cvcSeed }) => {
      const v1 = await cvcSeed.cv();
      const v2 = await cvcSeed.cv({ parentId: v1 });
      const jd = await cvcSeed.jd();
      await cvcSeed.match(v1, jd, { scores: [100, 0, 50] });
      await cvcSeed.match(v2, jd, { scores: [0, 100, 50] });

      const body = (await cvcSeed.api.comparisons.get(v2)).json();

      expect(body.delta).toEqual({ overall: -100, semantic: 100, keyword: 0 });
    }
  );

  test(
    "số phiên bản suy từ chuỗi parentId, đúng tới 21 phiên bản và không treo khi dài hơn",
    { tag: ["@TC-CVVERSIONCOMPARISON-018"] },
    async ({ cvcSeed }) => {
      const [, v2, v3] = await cvcSeed.chain(3, "Three");
      const three = (await cvcSeed.api.comparisons.get(v3)).json();
      expect([three.base.id, three.base.version, three.revision.version]).toEqual([v2, 2, 3]);

      // At the cap: v21 walks 20 steps to the root.
      const atCap = await cvcSeed.chain(MAX_LINEAGE_DEPTH + 1, "Cap");
      const capped = (await cvcSeed.api.comparisons.get(atCap[MAX_LINEAGE_DEPTH])).json();
      expect([capped.base.version, capped.revision.version]).toEqual([MAX_LINEAGE_DEPTH, MAX_LINEAGE_DEPTH + 1]);

      // Past the cap the walk stops, but the request still answers.
      const past = await cvcSeed.chain(MAX_LINEAGE_DEPTH + 2, "Past");
      const beyond = await cvcSeed.api.comparisons.get(past[MAX_LINEAGE_DEPTH + 1]);
      expect(beyond.status).toBe(200);
    }
  );

  test(
    "endpoint so sánh chỉ chịu throttle global",
    { tag: ["@TC-CVVERSIONCOMPARISON-019"] },
    async ({ cvcSeed }) => {
      const { v2 } = await cvcSeed.happyPair();

      const res = await cvcSeed.api.comparisons.get(v2);

      expect(res.status).toBe(200);
      expect(res.headers["x-ratelimit-limit"]).toBe(String(GLOBAL_THROTTLE_LIMIT));
    }
  );
});
