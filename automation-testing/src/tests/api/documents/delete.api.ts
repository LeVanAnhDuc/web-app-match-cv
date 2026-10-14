import { test, expect } from "@/fixtures";
import { LANGUAGES, serverMessage } from "@/data/copy";
import { MISSING_ID } from "@/data/test-data/documents";
import { findDocument, findMatchResult } from "@/utils/db";
import { createGuestUser, deleteUsers } from "@/utils/sessions";

// DELETE /documents/:id (REQ-DOCUMENTS-17…20, 34). References are seeded straight into the DB (a MatchResult / an
// empty MatchRun), so no AI call is ever made.

test.describe("DELETE /documents/:id", { tag: ["@creates-data"] }, () => {
  test("xoá tài liệu không bị tham chiếu trả 204 và sau đó đọc lại là 404", { tag: ["@TC-DOCUMENTS-043", "@smoke"] }, async ({ docOwner }) => {
    const doc = await docOwner.paste("JD");

    const res = await docOwner.api.documents.remove(doc.id);

    expect(res.status).toBe(204);
    expect(await findDocument(doc.id)).toBeNull();
    expect((await docOwner.api.documents.get(doc.id)).status).toBe(404);
  });

  test("tài liệu được kết quả match dùng làm CV trả 409 inUseByMatch và giữ nguyên", { tag: ["@TC-DOCUMENTS-044", "@smoke"] }, async ({ docOwner }) => {
    const cv = await docOwner.paste("CV");
    const jd = await docOwner.paste("JD");
    const matchId = await docOwner.referenceInMatch(cv.id, jd.id);

    for (const lng of LANGUAGES) {
      const res = await docOwner.api.lang(lng).documents.remove(cv.id);
      expect(res.status).toBe(409);
      expect(res.error().message).toBe(serverMessage("documents.errors.inUseByMatch", lng));
    }
    expect(await findDocument(cv.id)).not.toBeNull();
    expect(await findMatchResult(matchId)).not.toBeNull();
  });

  test("tài liệu được kết quả match dùng làm JD trả 409 và giữ nguyên", { tag: ["@TC-DOCUMENTS-045"] }, async ({ docOwner }) => {
    const cv = await docOwner.paste("CV");
    const jd = await docOwner.paste("JD");
    const matchId = await docOwner.referenceInMatch(cv.id, jd.id);

    const res = await docOwner.api.documents.remove(jd.id);

    expect(res.status).toBe(409);
    expect(await findDocument(jd.id)).not.toBeNull();
    expect(await findMatchResult(matchId)).not.toBeNull();
  });

  test("xoá tài liệu của người khác, đã xoá hoặc không tồn tại trả 404", { tag: ["@TC-DOCUMENTS-046", "@smoke"] }, async ({ docOwner, docStranger }) => {
    const gone = await docOwner.paste("CV");
    expect((await docOwner.api.documents.remove(gone.id)).status).toBe(204);

    for (const id of [docStranger.docId, gone.id, MISSING_ID]) {
      const res = await docOwner.api.documents.remove(id);
      expect(res.status, id).toBe(404);
      expect(res.error().message).toBe(serverMessage("documents.errors.notFound"));
    }
    expect(await findDocument(docStranger.docId)).not.toBeNull();
  });

  test("khách hoặc không có session xoá trả 401", { tag: ["@TC-DOCUMENTS-047"] }, async ({ anonApi, apiAs, docOwner }) => {
    const doc = await docOwner.paste("JD");
    const guest = await createGuestUser();
    try {
      for (const api of [anonApi, apiAs(guest)]) {
        const res = await api.documents.remove(doc.id);
        expect(res.status).toBe(401);
        expect(res.error().code).toBe("SIGN_IN_REQUIRED");
      }
      expect(await findDocument(doc.id)).not.toBeNull();
    } finally {
      await deleteUsers([guest.userId]);
    }
  });

  test("xoá bản trước thì bản sau còn nguyên và mất liên kết parentId", { tag: ["@TC-DOCUMENTS-048"] }, async ({ docOwner }) => {
    const parent = await docOwner.paste("CV");
    const child = await docOwner.paste("CV");
    expect((await docOwner.api.documents.setParent(child.id, parent.id)).status).toBe(200);

    const res = await docOwner.api.documents.remove(parent.id);

    expect(res.status).toBe(204);
    const after = await docOwner.api.documents.get(child.id);
    expect(after.status).toBe(200);
    expect(after.json().parentId).toBeNull();
  });

  test("tài liệu chỉ được một lượt match chưa có kết quả tham chiếu không làm server lỗi 5xx", { tag: ["@TC-DOCUMENTS-049"] }, async ({ docOwner }) => {
    const cv = await docOwner.paste("CV");
    const jd = await docOwner.paste("JD");
    await docOwner.openRun(cv.id, jd.id);

    const res = await docOwner.api.documents.remove(cv.id);

    expect([204, 409]).toContain(res.status);
    if (res.status === 409) {
      expect(res.error().message).toBe(serverMessage("documents.errors.inUseByMatch"));
      expect(await findDocument(cv.id)).not.toBeNull();
    } else {
      expect(await findDocument(cv.id)).toBeNull();
    }
  });
});
