import { test, expect } from "@/fixtures";
import { DOCX_MIME, PDF_MIME } from "@/api";
import { LANGUAGES, serverMessage } from "@/data/copy";
import {
  EVIL_TITLE,
  EVIL_TITLE_FILENAME,
  LIMITS,
  MISSING_ID,
  VI_TITLE,
  repeat,
  sampleBytes,
} from "@/data/test-data/documents";
import { FILES } from "@/data/test-data/shared";
import { createGuestUser, deleteUsers } from "@/utils/sessions";

// GET /documents/:id and GET /documents/:id/file (REQ-DOCUMENTS-10…14, 38). Real API, one fresh user per test;
// docStranger is "another user" who owns a CV with an original PDF.

test.describe("GET /documents/:id", { tag: ["@creates-data"] }, () => {
  test("chủ sở hữu đọc được DocumentDto kèm rawText", { tag: ["@TC-DOCUMENTS-025", "@smoke"] }, async ({ docOwner }) => {
    const doc = await docOwner.paste("JD", { save: false, text: "JD content for GET by id" });

    const res = await docOwner.api.documents.get(doc.id);

    expect(res.status).toBe(200);
    expect(res.json()).toMatchObject({
      id: doc.id,
      kind: "JD",
      title: doc.title,
      sourceFormat: "text",
      rawText: "JD content for GET by id",
      isSaved: false,
      parentId: null,
    });
  });

  test("tài liệu của người khác và id không tồn tại cùng trả 404 notFound như nhau", { tag: ["@TC-DOCUMENTS-026", "@smoke"] }, async ({ docOwner, docStranger }) => {
    for (const lng of LANGUAGES) {
      const other = await docOwner.api.lang(lng).documents.get(docStranger.docId);
      const missing = await docOwner.api.lang(lng).documents.get(MISSING_ID);

      expect(other.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(other.error().message).toBe(serverMessage("documents.errors.notFound", lng));
      expect(other.body).toEqual(missing.body);
    }
  });

  test("id không phải UUID trả 400", { tag: ["@TC-DOCUMENTS-027"] }, async ({ docOwner }) => {
    for (const id of ["abc", "123", `${MISSING_ID}x`]) {
      const res = await docOwner.api.documents.get(id);
      expect(res.status, id).toBe(400);
    }
  });

  test("khách đọc được tài liệu của mình nhưng không đọc được của người khác", { tag: ["@TC-DOCUMENTS-028"] }, async ({ apiAs, docStranger }) => {
    const guest = await createGuestUser();
    try {
      const api = apiAs(guest);
      const created = await api.documents.create({ kind: "CV", save: false, sourceText: "Guest CV text" });
      expect(created.status).toBe(201);

      const own = await api.documents.get(created.json().id);
      expect(own.status).toBe(200);
      expect(own.json().rawText).toBe("Guest CV text");

      expect((await api.documents.get(docStranger.docId)).status).toBe(404);
      expect((await api.documents.file(docStranger.docId)).status).toBe(404);
    } finally {
      await deleteUsers([guest.userId]);
    }
  });
});

test.describe("GET /documents/:id/file", { tag: ["@creates-data"] }, () => {
  test("file PDF trả đúng byte gốc, application/pdf, inline và tên file theo title", { tag: ["@TC-DOCUMENTS-029", "@smoke"] }, async ({ docOwner }) => {
    const title = "CV_one";
    const doc = await docOwner.upload("CV", FILES.pdf, { title });

    const res = await docOwner.api.documents.file(doc.id);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain(PDF_MIME);
    expect(res.headers["content-disposition"]).toBe(`inline; filename="${title}.pdf"`);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.compare(res.raw, sampleBytes("pdf"))).toBe(0);
  });

  test("download=1 trả Content-Disposition attachment", { tag: ["@TC-DOCUMENTS-030"] }, async ({ docOwner }) => {
    const doc = await docOwner.upload("CV", FILES.pdf, { title: "CV_two" });

    const res = await docOwner.api.documents.file(doc.id, { download: true });

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toBe('attachment; filename="CV_two.pdf"');
  });

  test("file DOCX trả MIME DOCX và đuôi docx", { tag: ["@TC-DOCUMENTS-031"] }, async ({ docOwner }) => {
    const doc = await docOwner.upload("JD", FILES.docx, { title: "JD_docx" });

    const res = await docOwner.api.documents.file(doc.id, { download: true });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain(DOCX_MIME);
    expect(res.headers["content-disposition"]).toBe('attachment; filename="JD_docx.docx"');
    expect(Buffer.compare(res.raw, sampleBytes("docx"))).toBe(0);
  });

  test("tài liệu dán text, của người khác hoặc không tồn tại trả 404 noOriginalFile", { tag: ["@TC-DOCUMENTS-032"] }, async ({ docOwner, docStranger }) => {
    const pasted = await docOwner.paste("JD", { save: false });
    for (const lng of LANGUAGES) {
      for (const id of [pasted.id, docStranger.docId, MISSING_ID]) {
        const res = await docOwner.api.lang(lng).documents.file(id);
        expect(res.status, id).toBe(404);
        expect(res.error().message).toBe(serverMessage("documents.errors.noOriginalFile", lng));
      }
    }
  });

  test("title có ngoặc kép, xuống dòng, chấm phẩy được sanitize trong tên file", { tag: ["@TC-DOCUMENTS-033"] }, async ({ docOwner }) => {
    const doc = await docOwner.upload("CV", FILES.pdf, { title: EVIL_TITLE });

    const res = await docOwner.api.documents.file(doc.id);

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toBe(`inline; filename="${EVIL_TITLE_FILENAME}"`);
    expect(res.setCookies).toEqual([]);
  });

  test("title dài hơn 100 ký tự bị cắt còn 100 ký tự trong tên file", { tag: ["@TC-DOCUMENTS-034"] }, async ({ docOwner }) => {
    const doc = await docOwner.upload("CV", FILES.pdf, { title: repeat(150, "t") });

    const res = await docOwner.api.documents.file(doc.id);

    expect(res.headers["content-disposition"]).toBe(`inline; filename="${repeat(LIMITS.filename, "t")}.pdf"`);
  });

  test("title tiếng Việt có dấu được giữ nguyên qua filename* UTF-8", { tag: ["@TC-DOCUMENTS-035"] }, async ({ docOwner }) => {
    // BUG: defects/documents.md#bug-documents-05
    test.fail();
    const doc = await docOwner.upload("CV", FILES.pdf, { title: VI_TITLE });

    const res = await docOwner.api.documents.file(doc.id, { download: true });

    expect(res.status).toBe(200);
    const disposition = res.headers["content-disposition"];
    // The ASCII fallback stays header-safe (REQ-DOCUMENTS-14)…
    expect(disposition).toMatch(/filename="[\w.-]+\.pdf"/);
    // …and the RFC 5987 form restores the real name (REQ-DOCUMENTS-38).
    const star = disposition.match(/filename\*=UTF-8''([^;\s]+)/i);
    expect(star, disposition).not.toBeNull();
    expect(decodeURIComponent(star![1])).toBe(`${VI_TITLE}.pdf`);
  });
});
