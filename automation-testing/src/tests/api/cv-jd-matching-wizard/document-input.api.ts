import { expect, test } from "@/fixtures";
import { serverMessage } from "@/data/copy";
import {
  DERIVED_TITLE_LENGTH,
  MAX_SOURCE_TEXT,
  MAX_TITLE,
  MAX_UPLOAD_BYTES,
  PDF_MIME,
  blankFile,
  corruptPdf,
  docxOfExactSize,
  docxOverExtractCeiling,
  docxWithText,
} from "@/data/test-data/cv-jd-matching-wizard";
import { FILES } from "@/data/test-data/shared";
import { createGuestUser, createSignedInUser, deleteUsers, type SeededUser } from "@/utils/sessions";

// POST /documents as the wizard uses it (REQ-14–18, 20, 23, 49): server-side file checks, parse ceilings, paste
// limits, the DocumentDto contract and the save rules. One throwaway user for the file; deleted (cascade) afterwards.

/** The error message, flattened (class-validator answers with an array). */
const messageOf = (body: { message: string | string[] }) =>
  Array.isArray(body.message) ? body.message.join(" | ") : body.message;

let user: SeededUser;

test.beforeAll(async () => {
  user = await createSignedInUser();
});

test.afterAll(async () => {
  await deleteUsers([user.userId]);
});

test.describe("POST /documents — file checks", () => {
  test(
    "MIME ngoài PDF/DOCX bị từ chối với unsupportedFileType",
    { tag: ["@TC-CVJDMATCHINGWIZARD-019"] },
    async ({ apiAs }) => {
      for (const file of [blankFile("photo.png", "image/png", 512), blankFile("notes.txt", "text/plain", 512)]) {
        const res = await apiAs(user).documents.upload({ kind: "CV", save: false, file });
        expect(res.status, file.name).toBe(400);
        expect(messageOf(res.error())).toBe(serverMessage("documents.errors.unsupportedFileType"));
      }
    }
  );

  test(
    "file vượt 10 MB bị từ chối với fileTooLarge",
    { tag: ["@TC-CVJDMATCHINGWIZARD-020"] },
    async ({ apiAs }) => {
      const res = await apiAs(user).documents.upload({
        kind: "CV",
        save: false,
        file: blankFile("over.pdf", PDF_MIME, MAX_UPLOAD_BYTES + 1),
      });
      expect(res.status).toBe(400);
      expect(messageOf(res.error())).toBe(serverMessage("documents.errors.fileTooLarge"));
    }
  );

  test(
    "file đúng 10 485 760 byte được nhận",
    { tag: ["@TC-CVJDMATCHINGWIZARD-021"] },
    async ({ apiAs }) => {
      // BUG: defects/cv-jd-matching-wizard.md#bug-cvjdmatchingwizard-02
      test.fail();
      const file = docxOfExactSize(MAX_UPLOAD_BYTES);
      expect(file.buffer.length).toBe(MAX_UPLOAD_BYTES);

      const res = await apiAs(user).documents.upload({ kind: "CV", save: false, file });

      expect(res.status, res.text).toBe(201);
      expect(res.json().sourceFormat).toBe("docx");
    }
  );

  test(
    "vừa sai loại vừa quá cỡ thì server báo lỗi loại",
    { tag: ["@TC-CVJDMATCHINGWIZARD-022"] },
    async ({ apiAs }) => {
      const res = await apiAs(user).documents.upload({
        kind: "CV",
        save: false,
        file: blankFile("huge.png", "image/png", MAX_UPLOAD_BYTES + 1),
      });
      expect(res.status).toBe(400);
      expect(messageOf(res.error())).toBe(serverMessage("documents.errors.unsupportedFileType"));
    }
  );

  test(
    "file hỏng và DOCX rỗng trả parseFailed",
    { tag: ["@TC-CVJDMATCHINGWIZARD-023"] },
    async ({ apiAs }) => {
      for (const file of [corruptPdf(), docxWithText([], "empty.docx")]) {
        const res = await apiAs(user).documents.upload({ kind: "CV", save: false, file });
        expect(res.status, file.name).toBe(400);
        expect(messageOf(res.error())).toBe(serverMessage("documents.errors.parseFailed"));
      }
    }
  );

  test(
    "DOCX trích ra hơn 2 000 000 ký tự trả parseFailed, không 5xx",
    { tag: ["@TC-CVJDMATCHINGWIZARD-024"] },
    async ({ apiAs }) => {
      const res = await apiAs(user).documents.upload({ kind: "JD", save: false, file: docxOverExtractCeiling() });
      expect(res.status).toBe(400);
      expect(messageOf(res.error())).toBe(serverMessage("documents.errors.parseFailed"));
    }
  );
});

test.describe("POST /documents — pasted text", () => {
  test(
    "text rỗng hoặc toàn khoảng trắng trả emptyText",
    { tag: ["@TC-CVJDMATCHINGWIZARD-025"] },
    async ({ apiAs }) => {
      for (const body of [
        { kind: "JD", save: false, sourceText: "" },
        { kind: "JD", save: false, sourceText: "  \n\t  " },
        { kind: "JD", save: false },
      ]) {
        const res = await apiAs(user).documents.create(body);
        expect(res.status, JSON.stringify(body)).toBe(400);
        expect(messageOf(res.error())).toBe(serverMessage("documents.errors.emptyText"));
      }
    }
  );

  test(
    "sourceText 100 000 ký tự được nhận, 100 001 bị từ chối",
    { tag: ["@TC-CVJDMATCHINGWIZARD-026"] },
    async ({ apiAs }) => {
      const atMax = await apiAs(user).documents.create({ kind: "CV", save: false, sourceText: "a".repeat(MAX_SOURCE_TEXT) });
      expect(atMax.status).toBe(201);
      expect(atMax.json().rawText).toHaveLength(MAX_SOURCE_TEXT);

      const over = await apiAs(user).documents.create({ kind: "CV", save: false, sourceText: "a".repeat(MAX_SOURCE_TEXT + 1) });
      expect(over.status).toBe(400);
    }
  );

  test(
    "tạo tài liệu trả DocumentDto, tự đặt tiêu đề từ dòng đầu và cắt 80 ký tự",
    { tag: ["@TC-CVJDMATCHINGWIZARD-027", "@smoke"] },
    async ({ apiAs }) => {
      const res = await apiAs(user).documents.create({
        kind: "JD",
        save: false,
        sourceText: "\n\n   Senior Backend Engineer   \nNestJS, PostgreSQL\n",
      });
      expect(res.status).toBe(201);
      const doc = res.json();
      expect(Object.keys(doc).sort()).toEqual(
        ["createdAt", "id", "isSaved", "kind", "parentId", "rawText", "sourceFormat", "title"].sort()
      );
      expect(doc).toMatchObject({
        kind: "JD",
        title: "Senior Backend Engineer",
        sourceFormat: "text",
        rawText: "Senior Backend Engineer   \nNestJS, PostgreSQL",
        isSaved: false,
        parentId: null,
      });
      expect(Number.isNaN(Date.parse(doc.createdAt as unknown as string))).toBe(false);

      const longLine = "L".repeat(DERIVED_TITLE_LENGTH + 40);
      const long = await apiAs(user).documents.create({ kind: "CV", save: false, sourceText: `${longLine}\nrest` });
      expect(long.status).toBe(201);
      expect(long.json().title).toBe(`${"L".repeat(DERIVED_TITLE_LENGTH)}…`);

      const exact = await apiAs(user).documents.create({ kind: "CV", save: false, sourceText: "E".repeat(DERIVED_TITLE_LENGTH) });
      expect(exact.json().title).toBe("E".repeat(DERIVED_TITLE_LENGTH));
    }
  );

  test(
    "upload PDF/DOCX giữ file gốc để xem trước",
    { tag: ["@TC-CVJDMATCHINGWIZARD-028"] },
    async ({ apiAs }) => {
      for (const [path, format, mime] of [
        [FILES.pdf, "pdf", "application/pdf"],
        [FILES.docx, "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ] as const) {
        const res = await apiAs(user).documents.upload({ kind: "CV", save: false, file: path });
        expect(res.status, path).toBe(201);
        const doc = res.json();
        expect(doc.sourceFormat).toBe(format);
        expect(doc.rawText.length).toBeGreaterThan(0);

        const original = await apiAs(user).documents.file(doc.id);
        expect(original.status).toBe(200);
        expect(original.headers["content-type"]).toContain(mime);
        expect(original.raw.length).toBeGreaterThan(0);
      }
    }
  );

  test(
    "kind ngoài CV/JD bị từ chối",
    { tag: ["@TC-CVJDMATCHINGWIZARD-029"] },
    async ({ apiAs }) => {
      for (const kind of ["XX", "cv", ""]) {
        const res = await apiAs(user).documents.create({ kind, save: false, sourceText: "text" });
        expect(res.status, kind).toBe(400);
      }
    }
  );
});

test.describe("POST /documents — save for reuse", () => {
  test(
    "lưu mà tiêu đề rỗng trả titleRequiredWhenSaving",
    { tag: ["@TC-CVJDMATCHINGWIZARD-030"] },
    async ({ apiAs }) => {
      for (const body of [
        { kind: "JD", save: true, sourceText: "JD text" },
        { kind: "JD", save: true, title: "   ", sourceText: "JD text" },
      ]) {
        const res = await apiAs(user).documents.create(body);
        expect(res.status, JSON.stringify(body)).toBe(400);
        expect(messageOf(res.error())).toBe(serverMessage("documents.errors.titleRequiredWhenSaving"));
      }
    }
  );

  test(
    "tiêu đề 200 ký tự được nhận, 201 bị từ chối",
    { tag: ["@TC-CVJDMATCHINGWIZARD-031"] },
    async ({ apiAs }) => {
      const atMax = await apiAs(user).documents.create({ kind: "JD", save: true, title: "T".repeat(MAX_TITLE), sourceText: "JD" });
      expect(atMax.status).toBe(201);
      expect(atMax.json()).toMatchObject({ title: "T".repeat(MAX_TITLE), isSaved: true });

      const over = await apiAs(user).documents.create({ kind: "JD", save: true, title: "T".repeat(MAX_TITLE + 1), sourceText: "JD" });
      expect(over.status).toBe(400);
    }
  );

  test(
    "lỗi validate tiêu đề quá dài trả message tiếng Việt khi request tiếng Việt",
    { tag: ["@TC-CVJDMATCHINGWIZARD-032"] },
    async ({ apiAs }) => {
      // BUG: defects/cv-jd-matching-wizard.md#bug-cvjdmatchingwizard-03
      test.fail();
      const res = await apiAs(user)
        .lang("vi")
        .documents.create({ kind: "JD", save: true, title: "T".repeat(MAX_TITLE + 1), sourceText: "JD" });
      expect(res.status).toBe(400);
      // Required: a Vietnamese message. Today class-validator's raw English sentence comes back untranslated.
      expect(messageOf(res.error())).not.toMatch(/must be shorter than or equal to/i);
    }
  );
});

test.describe("documents — guest & language", () => {
  test(
    "phiên khách không xem được danh sách tài liệu",
    { tag: ["@TC-CVJDMATCHINGWIZARD-033"] },
    async ({ apiAs }) => {
      const guest = await createGuestUser();
      try {
        const created = await apiAs(guest).documents.create({ kind: "JD", save: false, sourceText: "guest JD" });
        expect(created.status).toBe(201);

        const res = await apiAs(guest).documents.list({ kind: "JD", saved: true });
        expect(res.status).toBe(401);
        expect(res.error().code).toBe("SIGN_IN_REQUIRED");
      } finally {
        await deleteUsers([guest.userId]);
      }
    }
  );

  test(
    "lỗi documents trả theo ngôn ngữ của request",
    { tag: ["@TC-CVJDMATCHINGWIZARD-034"] },
    async ({ apiAs }) => {
      const viHeader = await apiAs(user).lang("vi").documents.create({ kind: "JD", save: false, sourceText: " " });
      expect(viHeader.status).toBe(400);
      expect(messageOf(viHeader.error())).toBe(serverMessage("documents.errors.emptyText", "vi"));

      const viQuery = await apiAs(user).documents.create({ kind: "JD", save: true, sourceText: "x" }, { params: { lang: "vi" } });
      expect(viQuery.status).toBe(400);
      expect(messageOf(viQuery.error())).toBe(serverMessage("documents.errors.titleRequiredWhenSaving", "vi"));

      const en = await apiAs(user).lang("en").documents.create({ kind: "JD", save: false, sourceText: " " });
      expect(messageOf(en.error())).toBe(serverMessage("documents.errors.emptyText", "en"));
    }
  );
});
