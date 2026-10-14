import { test, expect } from "@/fixtures";
import { LANGUAGES, serverMessage } from "@/data/copy";
import { LIMITS, docTitle, repeat } from "@/data/test-data/documents";
import { findDocument } from "@/utils/db";
import { createGuestUser, deleteUsers } from "@/utils/sessions";

// PATCH /documents/:id { title } (REQ-DOCUMENTS-15, 16). DTO validation errors are asserted by status only: their
// messages come from class-validator in English whatever the language (decision Q7, tech debt).

test.describe("PATCH /documents/:id", { tag: ["@creates-data"] }, () => {
  test("đổi tên trả 200 và đọc lại thấy title mới", { tag: ["@TC-DOCUMENTS-036", "@smoke"] }, async ({ docOwner }) => {
    const doc = await docOwner.paste("JD");
    const title = docTitle("Renamed");

    const res = await docOwner.api.documents.rename(doc.id, title);

    expect(res.status).toBe(200);
    expect(res.json()).toMatchObject({ id: doc.id, title, rawText: doc.rawText });
    expect((await docOwner.api.documents.get(doc.id)).json().title).toBe(title);
  });

  test("title mới được trim", { tag: ["@TC-DOCUMENTS-037"] }, async ({ docOwner }) => {
    const doc = await docOwner.paste("CV");

    const res = await docOwner.api.documents.rename(doc.id, "   Trimmed name  ");

    expect(res.status).toBe(200);
    expect(res.json().title).toBe("Trimmed name");
  });

  test("title 199 và 200 ký tự được nhận, 201 ký tự bị từ chối", { tag: ["@TC-DOCUMENTS-038"] }, async ({ docOwner }) => {
    const doc = await docOwner.paste("CV");

    for (const n of [LIMITS.title - 1, LIMITS.title]) {
      const res = await docOwner.api.documents.rename(doc.id, repeat(n));
      expect(res.status, `${n} chars`).toBe(200);
      expect(res.json().title).toBe(repeat(n));
    }

    const tooLong = await docOwner.api.documents.rename(doc.id, repeat(LIMITS.title + 1));
    expect(tooLong.status).toBe(400);
    expect((await findDocument(doc.id))?.title).toBe(repeat(LIMITS.title));
  });

  test("title rỗng, chỉ khoảng trắng, thiếu hoặc không phải chuỗi trả 400", { tag: ["@TC-DOCUMENTS-039"] }, async ({ docOwner }) => {
    const doc = await docOwner.paste("JD");

    for (const body of [{ title: "" }, { title: "   " }, {}, { title: 123 }, { title: null }, { title: ["a"] }]) {
      const res = await docOwner.api.documents.rename(doc.id, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect((await findDocument(doc.id))?.title).toBe(doc.title);
  });

  test("đặt lại đúng tên cũ vẫn trả 200", { tag: ["@TC-DOCUMENTS-040"] }, async ({ docOwner }) => {
    const doc = await docOwner.paste("CV");

    const res = await docOwner.api.documents.rename(doc.id, doc.title);

    expect(res.status).toBe(200);
    expect(res.json().title).toBe(doc.title);
  });

  test("đổi tên tài liệu của người khác trả 404 và title của họ không đổi", { tag: ["@TC-DOCUMENTS-041", "@smoke"] }, async ({ docOwner, docStranger }) => {
    for (const lng of LANGUAGES) {
      const res = await docOwner.api.lang(lng).documents.rename(docStranger.docId, "Hijacked");
      expect(res.status).toBe(404);
      expect(res.error().message).toBe(serverMessage("documents.errors.notFound", lng));
    }
    expect((await findDocument(docStranger.docId))?.title).toBe(docStranger.title);
  });

  test("khách hoặc không có session đổi tên trả 401", { tag: ["@TC-DOCUMENTS-042"] }, async ({ anonApi, apiAs, docOwner }) => {
    const doc = await docOwner.paste("CV");
    const guest = await createGuestUser();
    try {
      for (const api of [anonApi, apiAs(guest)]) {
        const res = await api.documents.rename(doc.id, "Guest rename");
        expect(res.status).toBe(401);
        expect(res.error().code).toBe("SIGN_IN_REQUIRED");
      }
      expect((await findDocument(doc.id))?.title).toBe(doc.title);
    } finally {
      await deleteUsers([guest.userId]);
    }
  });
});
