import { test, expect } from "@/fixtures";
import { LANGUAGES, serverMessage } from "@/data/copy";
import { createGuestUser, deleteUsers } from "@/utils/sessions";

// GET /documents — the caller's own documents only (REQ-DOCUMENTS-07…09). Real API, one fresh user per test.

const SUMMARY_KEYS = ["createdAt", "id", "kind", "parentId", "sourceFormat", "title"];

test.describe("GET /documents", { tag: ["@creates-data"] }, () => {
  test("danh sách JD đã lưu chỉ gồm tài liệu của mình, mới nhất trước, không có rawText", { tag: ["@TC-DOCUMENTS-019", "@smoke"] }, async ({ docOwner, docStranger }) => {
    const first = await docOwner.paste("JD");
    const second = await docOwner.paste("JD");
    const third = await docOwner.paste("JD");
    const unsaved = await docOwner.paste("JD", { save: false });
    const cv = await docOwner.paste("CV");

    const res = await docOwner.api.documents.list({ kind: "JD", saved: true });

    expect(res.status).toBe(200);
    const docs = res.json();
    expect(docs.map((d) => d.id)).toEqual([third.id, second.id, first.id]);
    expect(docs.map((d) => d.id)).not.toContain(unsaved.id);
    expect(docs.map((d) => d.id)).not.toContain(cv.id);
    expect(docs.map((d) => d.id)).not.toContain(docStranger.docId);
    for (const doc of docs) {
      expect(Object.keys(doc).sort()).toEqual(SUMMARY_KEYS);
      expect(doc.kind).toBe("JD");
    }
  });

  test("saved=false chỉ trả tài liệu chưa lưu", { tag: ["@TC-DOCUMENTS-020"] }, async ({ docOwner }) => {
    const saved = await docOwner.paste("JD");
    const unsaved = await docOwner.paste("JD", { save: false });

    const res = await docOwner.api.documents.list({ kind: "JD", saved: false });

    expect(res.status).toBe(200);
    expect(res.json().map((d) => d.id)).toEqual([unsaved.id]);
    expect(res.json().map((d) => d.id)).not.toContain(saved.id);
  });

  test("không lọc thì trả cả CV lẫn JD của mình và không có tài liệu của người khác", { tag: ["@TC-DOCUMENTS-021"] }, async ({ docOwner, docStranger }) => {
    const cv = await docOwner.paste("CV");
    const jd = await docOwner.paste("JD", { save: false });

    const res = await docOwner.api.documents.list();

    expect(res.status).toBe(200);
    expect(res.json().map((d) => d.id)).toEqual([jd.id, cv.id]);
    expect(res.json().map((d) => d.id)).not.toContain(docStranger.docId);
  });

  test("kind không phải CV hoặc JD trả 400", { tag: ["@TC-DOCUMENTS-022"] }, async ({ docOwner }) => {
    for (const kind of ["cv", "XX", "CVJD", ""]) {
      const res = await docOwner.api.documents.list({ kind });
      expect(res.status, `kind=${JSON.stringify(kind)}`).toBe(400);
    }
  });

  test("không có session trả 401 SIGN_IN_REQUIRED theo ngôn ngữ", { tag: ["@TC-DOCUMENTS-023", "@smoke"] }, async ({ anonApi }) => {
    for (const lng of LANGUAGES) {
      const res = await anonApi.lang(lng).documents.list({ kind: "CV", saved: true });
      expect(res.status).toBe(401);
      expect(res.error()).toMatchObject({
        code: "SIGN_IN_REQUIRED",
        message: serverMessage("auth.errors.signInRequired", lng),
      });
    }
  });

  test("session khách trả 401 SIGN_IN_REQUIRED", { tag: ["@TC-DOCUMENTS-024"] }, async ({ apiAs }) => {
    const guest = await createGuestUser();
    try {
      const res = await apiAs(guest).documents.list({ kind: "CV", saved: true });
      expect(res.status).toBe(401);
      expect(res.error().code).toBe("SIGN_IN_REQUIRED");
    } finally {
      await deleteUsers([guest.userId]);
    }
  });
});
