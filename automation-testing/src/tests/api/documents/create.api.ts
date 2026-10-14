import { test, expect } from "@/fixtures";
import { DOCX_MIME, PDF_MIME } from "@/api";
import { LANGUAGES, serverMessage } from "@/data/copy";
import { LIMITS, SAMPLE_TEXT, docText, docTitle, repeat } from "@/data/test-data/documents";
import { FILES } from "@/data/test-data/shared";
import { findDocument } from "@/utils/db";
import { documentOwner, liveCookie, SESSION_COOKIE, deleteUsers } from "@/utils/sessions";

// POST /documents — FR-02 save contract (REQ-DOCUMENTS-01…06). No AI involved: every case runs against the real API.
// Each test signs in as its own fresh user (docOwner), deleted afterwards.

const message = (body: { message: string | string[] }) =>
  Array.isArray(body.message) ? body.message.join(" ") : body.message;

test.describe("POST /documents", { tag: ["@creates-data"] }, () => {
  test("dán JD với save=false trả 201 DocumentDto dạng text, chưa lưu", { tag: ["@TC-DOCUMENTS-001", "@smoke"] }, async ({ docOwner }) => {
    const text = docText("JD");
    const res = await docOwner.api.documents.create({ kind: "JD", sourceText: text, save: false });

    expect(res.status).toBe(201);
    const doc = res.json();
    expect(doc).toMatchObject({ kind: "JD", sourceFormat: "text", rawText: text, isSaved: false, parentId: null });
    expect(doc.id).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(String(doc.createdAt)))).toBe(false);
  });

  test("lưu CV với save=true và title thì isSaved=true và có trong thư viện", { tag: ["@TC-DOCUMENTS-002", "@smoke"] }, async ({ docOwner }) => {
    const title = docTitle("My CV");
    const res = await docOwner.api.documents.create({ kind: "CV", sourceText: docText("CV"), save: true, title });

    expect(res.status).toBe(201);
    expect(res.json()).toMatchObject({ kind: "CV", sourceFormat: "text", isSaved: true, title });

    const library = await docOwner.api.documents.list({ kind: "CV", saved: true });
    expect(library.json().map((d) => d.id)).toContain(res.json().id);
  });

  test("tài liệu save=false không vào thư viện nhưng vẫn đọc được qua GET theo id", { tag: ["@TC-DOCUMENTS-003"] }, async ({ docOwner }) => {
    const doc = await docOwner.paste("CV", { save: false });

    const library = await docOwner.api.documents.list({ kind: "CV", saved: true });
    expect(library.json().map((d) => d.id)).not.toContain(doc.id);

    const read = await docOwner.api.documents.get(doc.id);
    expect(read.status).toBe(200);
    expect(read.json()).toMatchObject({ id: doc.id, isSaved: false });
  });

  test("save=true thiếu title hoặc title chỉ khoảng trắng trả 400 titleRequiredWhenSaving", { tag: ["@TC-DOCUMENTS-004"] }, async ({ docOwner }) => {
    for (const lng of LANGUAGES) {
      for (const title of [undefined, "   "]) {
        const res = await docOwner.api
          .lang(lng)
          .documents.create({ kind: "CV", sourceText: docText("CV"), save: true, title });
        expect(res.status, `title=${JSON.stringify(title)} lng=${lng}`).toBe(400);
        expect(message(res.error())).toBe(serverMessage("documents.errors.titleRequiredWhenSaving", lng));
      }
    }
    expect((await docOwner.api.documents.list({})).json()).toHaveLength(0);
  });

  test("title được trim trước khi lưu", { tag: ["@TC-DOCUMENTS-005"] }, async ({ docOwner }) => {
    const title = docTitle("Trimmed");
    const doc = await docOwner.paste("JD", { title: `   ${title}  ` });
    expect(doc.title).toBe(title);
  });

  test("save=false không có title thì title là dòng đầu tiên không rỗng", { tag: ["@TC-DOCUMENTS-006"] }, async ({ docOwner }) => {
    const res = await docOwner.api.documents.create({
      kind: "JD",
      save: false,
      sourceText: "\n   \n   Senior Backend Engineer  \nSecond line",
    });
    expect(res.status).toBe(201);
    expect(res.json().title).toBe("Senior Backend Engineer");
  });

  test("title tự suy giữ nguyên 80 ký tự và cắt dòng 81 ký tự thành 80 ký tự kèm dấu ba chấm", { tag: ["@TC-DOCUMENTS-007"] }, async ({ docOwner }) => {
    const at = await docOwner.paste("CV", { save: false, text: `${repeat(LIMITS.derivedTitle, "x")}\nbody` });
    expect(at.title).toBe(repeat(LIMITS.derivedTitle, "x"));

    const over = await docOwner.paste("CV", { save: false, text: `${repeat(LIMITS.derivedTitle + 1, "y")}\nbody` });
    expect(over.title).toBe(`${repeat(LIMITS.derivedTitle, "y")}…`);
  });

  test("không có file mà text rỗng hoặc chỉ khoảng trắng trả 400 emptyText", { tag: ["@TC-DOCUMENTS-008"] }, async ({ docOwner }) => {
    for (const lng of LANGUAGES) {
      for (const sourceText of [undefined, "", "   \n  "]) {
        const res = await docOwner.api.lang(lng).documents.create({ kind: "JD", save: false, sourceText });
        expect(res.status, `sourceText=${JSON.stringify(sourceText)}`).toBe(400);
        expect(message(res.error())).toBe(serverMessage("documents.errors.emptyText", lng));
      }
    }
  });

  test("title 200 ký tự được nhận, 201 ký tự bị từ chối", { tag: ["@TC-DOCUMENTS-009"] }, async ({ docOwner }) => {
    const ok = await docOwner.api.documents.create({
      kind: "CV",
      save: true,
      title: repeat(LIMITS.title),
      sourceText: docText("CV"),
    });
    expect(ok.status).toBe(201);
    expect(ok.json().title).toBe(repeat(LIMITS.title));

    const tooLong = await docOwner.api.documents.create({
      kind: "CV",
      save: true,
      title: repeat(LIMITS.title + 1),
      sourceText: docText("CV"),
    });
    expect(tooLong.status).toBe(400);
  });

  test("sourceText 100000 ký tự được nhận, 100001 ký tự bị từ chối", { tag: ["@TC-DOCUMENTS-010"] }, async ({ docOwner }) => {
    const ok = await docOwner.api.documents.create({ kind: "JD", save: false, sourceText: repeat(LIMITS.sourceText, "j") });
    expect(ok.status).toBe(201);
    expect(ok.json().rawText).toHaveLength(LIMITS.sourceText);

    const tooLong = await docOwner.api.documents.create({
      kind: "JD",
      save: false,
      sourceText: repeat(LIMITS.sourceText + 1, "j"),
    });
    expect(tooLong.status).toBe(400);
  });

  test("upload PDF trả 201 sourceFormat pdf với text trích từ file", { tag: ["@TC-DOCUMENTS-011", "@smoke"] }, async ({ docOwner }) => {
    const res = await docOwner.api.documents.upload({ kind: "JD", save: false, file: FILES.pdf });

    expect(res.status).toBe(201);
    expect(res.json().sourceFormat).toBe("pdf");
    expect(res.json().rawText).toContain(SAMPLE_TEXT.pdf);
  });

  test("upload DOCX trả 201 sourceFormat docx với text trích từ file", { tag: ["@TC-DOCUMENTS-012"] }, async ({ docOwner }) => {
    const res = await docOwner.api.documents.upload({ kind: "CV", save: false, file: FILES.docx });

    expect(res.status).toBe(201);
    expect(res.json().sourceFormat).toBe("docx");
    expect(res.json().rawText).toContain(SAMPLE_TEXT.docx);
  });

  test("file không phải PDF hay DOCX trả 400 unsupportedFileType", { tag: ["@TC-DOCUMENTS-013"] }, async ({ docOwner }) => {
    const files = [
      { name: "resume.txt", mimeType: "text/plain", buffer: Buffer.from("plain text content") },
      { name: "photo.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
    ];
    for (const lng of LANGUAGES) {
      for (const file of files) {
        const res = await docOwner.api.lang(lng).documents.upload({ kind: "JD", save: false, file });
        expect(res.status, `${file.name} ${lng}`).toBe(400);
        expect(message(res.error())).toBe(serverMessage("documents.errors.unsupportedFileType", lng));
      }
    }
  });

  test("file lớn hơn 10 MB trả 400 fileTooLarge", { tag: ["@TC-DOCUMENTS-014"] }, async ({ docOwner }) => {
    const big = { name: "big.pdf", mimeType: PDF_MIME, buffer: Buffer.alloc(LIMITS.fileBytes + 1, "a") };
    for (const lng of LANGUAGES) {
      const res = await docOwner.api.lang(lng).documents.upload({ kind: "JD", save: false, file: big });
      expect(res.status).toBe(400);
      expect(message(res.error())).toBe(serverMessage("documents.errors.fileTooLarge", lng));
    }
  });

  test("file vừa sai loại vừa quá cỡ nhận thông báo sai loại", { tag: ["@TC-DOCUMENTS-015"] }, async ({ docOwner }) => {
    const res = await docOwner.api.documents.upload({
      kind: "JD",
      save: false,
      file: { name: "big.txt", mimeType: "text/plain", buffer: Buffer.alloc(LIMITS.fileBytes + 1, "b") },
    });

    expect(res.status).toBe(400);
    expect(message(res.error())).toBe(serverMessage("documents.errors.unsupportedFileType"));
  });

  test("file gốc được lưu bất kể save, dán text không lưu file, DTO không lộ file", { tag: ["@TC-DOCUMENTS-016"] }, async ({ docOwner }) => {
    for (const [file, mime] of [
      [FILES.pdf, PDF_MIME],
      [FILES.docx, DOCX_MIME],
    ] as const) {
      for (const save of [false, true]) {
        const doc = await docOwner.upload("CV", file, { save });
        const row = await findDocument(doc.id);
        expect(row?.fileMime, `${file} save=${save}`).toBe(mime);
        expect(row?.fileData).not.toBeNull();
        expect(doc).not.toHaveProperty("fileData");
        expect(doc).not.toHaveProperty("fileMime");
      }
    }

    const pasted = await docOwner.paste("JD", { save: false });
    const row = await findDocument(pasted.id);
    expect(row?.fileData).toBeNull();
    expect(row?.fileMime).toBeNull();

    const [read, list] = await Promise.all([docOwner.api.documents.get(pasted.id), docOwner.api.documents.list({})]);
    expect(read.json()).not.toHaveProperty("fileData");
    expect(read.json()).not.toHaveProperty("fileMime");
    for (const summary of list.json()) {
      expect(summary).not.toHaveProperty("fileData");
      expect(summary).not.toHaveProperty("fileMime");
    }
  });

  test("khách chưa có session gửi tài liệu thì nhận 201 và cookie session của user khách mới", { tag: ["@TC-DOCUMENTS-017", "@smoke"] }, async ({ anonApi, apiAs }) => {
    const res = await anonApi.documents.create({ kind: "CV", save: false, sourceText: docText("CV") });

    expect(res.status).toBe(201);
    const cookie = liveCookie(res.setCookies, SESSION_COOKIE);
    expect(cookie).toBeTruthy();
    const owner = await documentOwner(res.json().id);
    try {
      expect(owner?.isGuest).toBe(true);
      const read = await apiAs(cookie).documents.get(res.json().id);
      expect(read.status).toBe(200);
      expect(read.json().rawText).toBe(res.json().rawText);
    } finally {
      if (owner) await deleteUsers([owner.userId]);
    }
  });
});
