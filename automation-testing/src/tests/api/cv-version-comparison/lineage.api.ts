import { randomUUID } from "node:crypto";
import { serverMessage, type ServerKey } from "@/data/copy";
import { MAX_LINEAGE_DEPTH } from "@/data/test-data/cv-version-comparison";
import { expect, test } from "@/fixtures";

// PATCH /documents/:id/parent — declaring which document this one is a newer version of
// (REQ-CVVERSIONCOMPARISON-22/23/26/27).

test.describe("cv-version-comparison — lineage endpoint", () => {
  test(
    "khai báo rồi gỡ liên kết phiên bản trước",
    { tag: ["@TC-CVVERSIONCOMPARISON-022", "@smoke"] },
    async ({ cvcSeed }) => {
      const v1 = await cvcSeed.cv();
      const manual = await cvcSeed.cv();

      const linked = await cvcSeed.api.documents.setParent(manual, v1);
      expect(linked.status).toBe(200);
      expect(linked.json()).toMatchObject({ id: manual, parentId: v1 });

      const cleared = await cvcSeed.api.documents.setParent(manual, null);
      expect(cleared.status).toBe(200);
      expect(cleared.json().parentId).toBeNull();
      expect(await cvcSeed.parentOf(manual)).toBeNull();
    }
  );

  test(
    "body hoặc id không hợp lệ trả 400 và không âm thầm gỡ liên kết",
    { tag: ["@TC-CVVERSIONCOMPARISON-023"] },
    async ({ cvcSeed }) => {
      const v1 = await cvcSeed.cv();
      const v2 = await cvcSeed.cv({ parentId: v1 });

      for (const body of [{}, { parentId: "not-a-uuid" }, { parentId: 42 }, { parentId: "" }]) {
        const res = await cvcSeed.api.documents.setParent(v2, body);
        expect(res.status, JSON.stringify(body)).toBe(400);
      }
      const badId = await cvcSeed.api.documents.setParent("not-a-uuid", null);
      expect(badId.status).toBe(400);

      expect(await cvcSeed.parentOf(v2)).toBe(v1);
    }
  );

  test(
    "tự trỏ, khác loại, tạo vòng, cha không tồn tại đều bị từ chối và giữ nguyên lineage",
    { tag: ["@TC-CVVERSIONCOMPARISON-024"] },
    async ({ cvcSeed }) => {
      const [v1, v2, v3] = await cvcSeed.chain(3);
      const jd = await cvcSeed.jd();
      const cases: Array<[string, string, ServerKey]> = [
        [v2, v2, "documents.errors.lineageSelf"],
        [v2, jd, "documents.errors.lineageKindMismatch"],
        [jd, v1, "documents.errors.lineageKindMismatch"],
        [v1, v2, "documents.errors.lineageCycle"],
        [v1, v3, "documents.errors.lineageCycle"],
        [v2, randomUUID(), "documents.errors.lineageParentNotFound"],
      ];

      for (const [id, parentId, key] of cases) {
        const res = await cvcSeed.api.documents.setParent(id, parentId);
        expect(res.status, key).toBe(400);
        expect(res.error().message).toBe(serverMessage(key));
      }

      expect(await cvcSeed.parentOf(v1)).toBeNull();
      expect(await cvcSeed.parentOf(v2)).toBe(v1);
      expect(await cvcSeed.parentOf(v3)).toBe(v2);
      expect(await cvcSeed.parentOf(jd)).toBeNull();
    }
  );

  test(
    "cha có đúng 20 tài liệu trong chuỗi được nhận, 21 bị từ chối lineageTooDeep",
    { tag: ["@TC-CVVERSIONCOMPARISON-025"] },
    async ({ cvcSeed }) => {
      const atLimit = await cvcSeed.chain(MAX_LINEAGE_DEPTH, "Limit");
      const accepted = await cvcSeed.cv();
      const ok = await cvcSeed.api.documents.setParent(accepted, atLimit[MAX_LINEAGE_DEPTH - 1]);
      expect(ok.status).toBe(200);

      const overLimit = await cvcSeed.chain(MAX_LINEAGE_DEPTH + 1, "Over");
      const refused = await cvcSeed.cv();
      const res = await cvcSeed.api.documents.setParent(refused, overLimit[MAX_LINEAGE_DEPTH]);
      expect(res.status).toBe(400);
      expect(res.error().message).toBe(serverMessage("documents.errors.lineageTooDeep"));
      expect(await cvcSeed.parentOf(refused)).toBeNull();
    }
  );

  test(
    "danh sách thư viện trả parentId của từng tài liệu",
    { tag: ["@TC-CVVERSIONCOMPARISON-026"] },
    async ({ cvcSeed }) => {
      const v1 = await cvcSeed.cv();
      const v2 = await cvcSeed.cv({ parentId: v1 });

      const res = await cvcSeed.api.documents.list({ kind: "CV", saved: true });

      expect(res.status).toBe(200);
      const byId = new Map(res.json().map((doc) => [doc.id, doc.parentId]));
      expect(byId.get(v1)).toBeNull();
      expect(byId.get(v2)).toBe(v1);
    }
  );

  test(
    "vòng đời lineage phản ánh ngay ở so sánh",
    { tag: ["@TC-CVVERSIONCOMPARISON-027"] },
    async ({ cvcSeed }) => {
      const v1 = await cvcSeed.cv();
      const v2 = await cvcSeed.cv();

      expect((await cvcSeed.api.comparisons.get(v2)).status).toBe(400);

      await cvcSeed.api.documents.setParent(v2, v1);
      const linked = await cvcSeed.api.comparisons.get(v2);
      expect(linked.status).toBe(200);
      expect(linked.json().base.id).toBe(v1);

      await cvcSeed.api.documents.setParent(v2, null);
      const cleared = await cvcSeed.api.comparisons.get(v2);
      expect(cleared.status).toBe(400);
      expect(cleared.error().message).toBe(serverMessage("comparison.errors.noParent"));
    }
  );

  test(
    "message lỗi lineage theo ngôn ngữ của request",
    { tag: ["@TC-CVVERSIONCOMPARISON-028"] },
    async ({ cvcSeed }) => {
      const [v1, v2] = await cvcSeed.chain(2);
      const jd = await cvcSeed.jd();
      const vi = cvcSeed.api.lang("vi");
      const cases: Array<[string, string, ServerKey]> = [
        [v2, v2, "documents.errors.lineageSelf"],
        [v2, jd, "documents.errors.lineageKindMismatch"],
        [v1, v2, "documents.errors.lineageCycle"],
        [v2, randomUUID(), "documents.errors.lineageParentNotFound"],
      ];
      for (const [id, parentId, key] of cases) {
        expect((await vi.documents.setParent(id, parentId)).error().message).toBe(serverMessage(key, "vi"));
      }

      const deep = await cvcSeed.chain(MAX_LINEAGE_DEPTH + 1, "Deep");
      const target = await cvcSeed.cv();
      expect((await vi.documents.setParent(target, deep[MAX_LINEAGE_DEPTH])).error().message).toBe(
        serverMessage("documents.errors.lineageTooDeep", "vi")
      );
    }
  );

  test(
    "mỗi lớp lỗi 400 trả code máy đọc được riêng",
    { tag: ["@TC-CVVERSIONCOMPARISON-029"] },
    async ({ cvcSeed }) => {
      // BUG: defects/cv-version-comparison.md#bug-cvversioncomparison-02
      test.fail();
      const { v2 } = await cvcSeed.happyPair();
      const root = await cvcSeed.cv();
      const jd = await cvcSeed.jd();
      const [c1, c2] = await cvcSeed.chain(2);
      const deep = await cvcSeed.chain(MAX_LINEAGE_DEPTH + 1, "Deep");
      const target = await cvcSeed.cv();

      const responses = [
        await cvcSeed.api.comparisons.get(jd), // notCv
        await cvcSeed.api.comparisons.get(root), // noParent
        await cvcSeed.api.comparisons.get(v2, { jdDocumentId: jd }), // jdNotComparable
        await cvcSeed.api.documents.setParent(c2, c2), // lineageSelf
        await cvcSeed.api.documents.setParent(c2, randomUUID()), // lineageParentNotFound
        await cvcSeed.api.documents.setParent(c2, jd), // lineageKindMismatch
        await cvcSeed.api.documents.setParent(c1, c2), // lineageCycle
        await cvcSeed.api.documents.setParent(target, deep[MAX_LINEAGE_DEPTH]), // lineageTooDeep
      ];

      const codes = responses.map((res) => {
        expect(res.status).toBe(400);
        return res.error().code;
      });
      for (const code of codes) expect(typeof code === "string" && code.length > 0).toBe(true);
      expect(new Set(codes).size).toBe(codes.length);
    }
  );
});
