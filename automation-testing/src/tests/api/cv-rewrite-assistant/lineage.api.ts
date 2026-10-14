import { test, expect } from "@/fixtures";
import { serverMessage } from "@/data/copy";
import { API_BULLET, API_REWORDED } from "@/data/test-data/cv-rewrite-assistant";

// What deleting an original does to its rewrite (REQ-30, ADR-0015: parentId is ON DELETE SET NULL, never CASCADE),
// through DELETE /documents/:id rather than raw SQL.

test.describe("cv rewrite — lineage", () => {
  test(
    "CV gốc đang có lịch sử match không xoá được, bản viết lại giữ nguyên",
    { tag: ["@TC-CVREWRITEASSISTANT-025", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: me.userId });
      const accepted = await me.api.cvRewrite.accept({
        matchResultId: seed.matchId,
        title: "Kept rewrite",
        changes: [{ original: API_BULLET, replacement: API_REWORDED }],
      });
      expect(accepted.status).toBe(201);
      const child = accepted.json();

      const res = await me.api.documents.remove(seed.cvId);

      expect(res.status).toBe(409);
      expect(res.error().message).toBe(serverMessage("documents.errors.inUseByMatch"));
      expect(await rewriteData.document(seed.cvId)).not.toBeNull();
      expect((await rewriteData.document(child.id))?.parentId).toBe(seed.cvId);
    }
  );

  test(
    "xoá CV cha không kéo theo bản con",
    { tag: ["@TC-CVREWRITEASSISTANT-026", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const parent = await rewriteData.cv({ userId: me.userId, title: "Disposable parent" });
      const child = await rewriteData.cv({ userId: me.userId, title: "Disposable child", parentId: parent });

      const res = await me.api.documents.remove(parent);

      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      expect(await rewriteData.document(parent)).toBeNull();
      const survivor = await rewriteData.document(child);
      expect(survivor).not.toBeNull();
      expect(survivor?.parentId).toBeNull();
    }
  );
});
