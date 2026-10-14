import { randomUUID } from "node:crypto";
import { serverMessage } from "@/data/copy";
import { expect, test } from "@/fixtures";

// Who may read a comparison or declare a lineage link (REQ-CVVERSIONCOMPARISON-03/04). Rows are seeded per test.

test.describe("cv-version-comparison — access", () => {
  test(
    "khách và người chưa đăng nhập nhận 401 SIGN_IN_REQUIRED ở cả hai endpoint",
    { tag: ["@TC-CVVERSIONCOMPARISON-001", "@smoke"] },
    async ({ cvcSeed, anonApi, apiAs }) => {
      const { v1, v2 } = await cvcSeed.happyPair();
      const guestApi = apiAs(await cvcSeed.guest());

      for (const caller of [anonApi, guestApi]) {
        const compared = await caller.comparisons.get(v2);
        expect(compared.status).toBe(401);
        expect(compared.error().code).toBe("SIGN_IN_REQUIRED");
        expect(compared.error().message).toBe(serverMessage("auth.errors.signInRequired"));

        const linked = await caller.documents.setParent(v2, null);
        expect(linked.status).toBe(401);
        expect(linked.error().code).toBe("SIGN_IN_REQUIRED");
      }
      // Nothing was written by the rejected calls.
      expect(await cvcSeed.parentOf(v2)).toBe(v1);
    }
  );

  test(
    "CV và tài liệu của user khác trả 404 như không tồn tại",
    { tag: ["@TC-CVVERSIONCOMPARISON-002", "@smoke"] },
    async ({ cvcSeed }) => {
      const other = await cvcSeed.otherUser();
      const theirV1 = await cvcSeed.cv({ owner: other.userId, title: cvcSeed.title("Their v1") });
      const theirV2 = await cvcSeed.cv({ owner: other.userId, title: cvcSeed.title("Their v2"), parentId: theirV1 });
      const theirJd = await cvcSeed.jd({ owner: other.userId });
      await cvcSeed.match(theirV1, theirJd, { owner: other.userId, scores: [10, 10, 10] });
      await cvcSeed.match(theirV2, theirJd, { owner: other.userId, scores: [90, 90, 90] });

      const foreign = await cvcSeed.api.comparisons.get(theirV2);
      const unknown = await cvcSeed.api.comparisons.get(randomUUID());
      expect(foreign.status).toBe(404);
      expect(foreign.error().message).toBe(serverMessage("comparison.errors.documentNotFound"));
      // Indistinguishable from an id that does not exist.
      expect(foreign.error().message).toBe(unknown.error().message);
      expect(foreign.text).not.toContain("Their v");

      const relinked = await cvcSeed.api.documents.setParent(theirV2, null);
      expect(relinked.status).toBe(404);
      expect(await cvcSeed.parentOf(theirV2)).toBe(theirV1);
    }
  );

  test(
    "bản trước thuộc user khác bị từ chối giống hệt id không tồn tại",
    { tag: ["@TC-CVVERSIONCOMPARISON-003", "@smoke"] },
    async ({ cvcSeed }) => {
      const other = await cvcSeed.otherUser();
      const theirCv = await cvcSeed.cv({ owner: other.userId });
      const mine = await cvcSeed.cv();

      const foreign = await cvcSeed.api.documents.setParent(mine, theirCv);
      const missing = await cvcSeed.api.documents.setParent(mine, randomUUID());

      expect(foreign.status).toBe(400);
      expect(missing.status).toBe(400);
      expect(foreign.error().message).toBe(serverMessage("documents.errors.lineageParentNotFound"));
      expect(foreign.error().message).toBe(missing.error().message);
      expect(await cvcSeed.parentOf(mine)).toBeNull();
    }
  );

  test(
    "JD của user khác ở jdDocumentId trả 400 jdNotComparable và không lộ dữ liệu",
    { tag: ["@TC-CVVERSIONCOMPARISON-004"] },
    async ({ cvcSeed }) => {
      const { v2 } = await cvcSeed.happyPair();
      const other = await cvcSeed.otherUser();
      const theirTitle = cvcSeed.title("Their secret JD");
      const theirJd = await cvcSeed.jd({ owner: other.userId, title: theirTitle });

      const res = await cvcSeed.api.comparisons.get(v2, { jdDocumentId: theirJd });

      expect(res.status).toBe(400);
      expect(res.error().message).toBe(serverMessage("comparison.errors.jdNotComparable"));
      expect(res.text).not.toContain(theirTitle);
    }
  );
});
