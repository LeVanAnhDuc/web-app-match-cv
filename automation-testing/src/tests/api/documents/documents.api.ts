import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect } from "@/fixtures";
import type { CallOptions, HttpResponse } from "@/api/http.client";
import { deleteDocuments, deleteMatchResults, findDocument, insertDocument, insertMatchResult } from "@/utils/db";
import { createSignedInUser, createUser, deleteUsers } from "@/utils/sessions";

// Ported from server/test/documents.e2e-spec.ts. No AI is involved, so every case runs live. Seeding that the old
// suite did through PrismaService (another user's rows, a referencing match) goes through `pg` (@/utils/db). The other
// users get a fresh random id per run instead of the fixed 00000000-…-0099 ids, so a crashed run can never collide.

const PDF_FIXTURE = resolve(__dirname, "../../../data/files/sample.pdf");
const DOCX_FIXTURE = resolve(__dirname, "../../../data/files/sample.docx");
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface DocumentResponseBody {
  id: string;
  kind: string;
  title: string;
  sourceFormat: string;
  rawText: string;
  isSaved: boolean;
  createdAt: string;
}

interface ErrorResponseBody {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

interface DocumentSummaryResponseBody {
  id: string;
  kind: string;
  title: string;
  sourceFormat: string;
  createdAt: string;
}

const pdfFile = () => ({ name: "sample.pdf", mimeType: "application/pdf", buffer: readFileSync(PDF_FIXTURE) });

test.describe("Documents (e2e)", () => {
  let userId: string;
  let cookie: string;
  const createdDocumentIds: string[] = [];

  test.beforeAll(async () => {
    ({ userId, cookie } = await createSignedInUser());
  });

  test.afterAll(async () => {
    await deleteDocuments(createdDocumentIds);
    await deleteUsers([userId]);
  });

  const track = (res: HttpResponse) => {
    const body = res.body as DocumentResponseBody;
    if (body?.id) createdDocumentIds.push(body.id);
    return res;
  };

  test.describe("POST /documents", () => {
    test("[EP] paste JD text (save=false) → 201 DocumentDto (sourceFormat=text)", async ({ http }) => {
      const res = track(
        await http(cookie).post("/documents", {
          data: {
            kind: "JD",
            sourceText: "We are hiring a Senior Backend Engineer...",
            save: false,
          },
        })
      );

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        kind: "JD",
        sourceFormat: "text",
        rawText: "We are hiring a Senior Backend Engineer...",
        isSaved: false,
      });
      const body = res.body as DocumentResponseBody;
      expect(body.id).toEqual(expect.any(String));
      expect(body.createdAt).toEqual(expect.any(String));
    });

    test("[EP] paste CV text with save=true + title → 201, isSaved=true", async ({ http }) => {
      const res = track(
        await http(cookie).post("/documents", {
          data: {
            kind: "CV",
            sourceText: "Experienced software engineer with 5 years...",
            save: true,
            title: "My CV v1",
          },
        })
      );

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        kind: "CV",
        sourceFormat: "text",
        isSaved: true,
        title: "My CV v1",
      });
    });

    test("[EP] upload real PDF file → 201 DocumentDto (sourceFormat=pdf, rawText extracted)", async ({ http }) => {
      const res = track(
        await http(cookie).post("/documents", {
          multipart: { kind: "JD", save: "false", file: pdfFile() },
        })
      );

      expect(res.status).toBe(201);
      const body = res.body as DocumentResponseBody;
      expect(body.sourceFormat).toBe("pdf");
      expect(body.rawText).toContain("Hello matchcv PDF");
    });

    test("[EP] upload real DOCX file → 201 DocumentDto (sourceFormat=docx, rawText extracted)", async ({ http }) => {
      const res = track(
        await http(cookie).post("/documents", {
          multipart: {
            kind: "CV",
            save: "false",
            file: { name: "sample.docx", mimeType: DOCX_MIME, buffer: readFileSync(DOCX_FIXTURE) },
          },
        })
      );

      expect(res.status).toBe(201);
      const body = res.body as DocumentResponseBody;
      expect(body.sourceFormat).toBe("docx");
      expect(body.rawText).toContain("Apple");
    });

    test("[EP] upload wrong type .txt → 400", async ({ http }) => {
      const res = await http(cookie).post("/documents", {
        multipart: {
          kind: "JD",
          save: "false",
          file: { name: "resume.txt", mimeType: "text/plain", buffer: Buffer.from("plain text content") },
        },
      });

      expect(res.status).toBe(400);
    });

    test("[EP] upload wrong type .png → 400", async ({ http }) => {
      const res = await http(cookie).post("/documents", {
        multipart: {
          kind: "JD",
          save: "false",
          file: { name: "photo.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
        },
      });

      expect(res.status).toBe(400);
    });

    test("[EP] oversize file (>10MB, correct type) → 400", async ({ http }) => {
      const big = Buffer.alloc(11 * 1024 * 1024, "a");
      const res = await http(cookie).post("/documents", {
        multipart: {
          kind: "JD",
          save: "false",
          file: { name: "big.pdf", mimeType: "application/pdf", buffer: big },
        },
      });

      expect(res.status).toBe(400);
    });

    test("[EP] paste empty text (whitespace only) → 400", async ({ http }) => {
      const res = await http(cookie).post("/documents", {
        data: { kind: "JD", sourceText: "   ", save: false },
      });

      expect(res.status).toBe(400);
    });

    test("[EP] save=true without title → 400", async ({ http }) => {
      const res = await http(cookie).post("/documents", {
        data: {
          kind: "CV",
          sourceText: "Some CV content here",
          save: true,
        },
      });

      expect(res.status).toBe(400);
    });

    test("[DT] wrong-type + oversize combined → 400, type message wins (checked first)", async ({ http }) => {
      const bigWrongType = Buffer.alloc(11 * 1024 * 1024, "b");
      const res = await http(cookie).post("/documents", {
        multipart: {
          kind: "JD",
          save: "false",
          file: { name: "big.txt", mimeType: "text/plain", buffer: bigWrongType },
        },
      });

      expect(res.status).toBe(400);
      const errorBody = res.body as ErrorResponseBody;
      const message = Array.isArray(errorBody.message) ? errorBody.message.join(" ") : errorBody.message;
      expect(message.toLowerCase()).toContain("unsupported");
      expect(message.toLowerCase()).not.toContain("too large");
    });
  });

  test.describe("POST /documents (fileData/fileMime persistence)", () => {
    test("[EP] upload PDF → DB row has fileMime=application/pdf and fileData not null", async ({ http }) => {
      const res = track(
        await http(cookie).post("/documents", {
          multipart: { kind: "JD", save: "false", file: pdfFile() },
        })
      );

      expect(res.status).toBe(201);
      const body = res.body as DocumentResponseBody;

      const stored = await findDocument(body.id);
      expect(stored?.fileMime).toBe("application/pdf");
      expect(stored?.fileData).not.toBeNull();
    });

    test("[EP] paste text (no file) → DB row has fileData=null and fileMime=null", async ({ http }) => {
      const res = track(
        await http(cookie).post("/documents", {
          data: {
            kind: "JD",
            sourceText: "Paste-only JD, no original file attached.",
            save: false,
          },
        })
      );

      expect(res.status).toBe(201);
      const body = res.body as DocumentResponseBody;

      const stored = await findDocument(body.id);
      expect(stored?.fileData).toBeNull();
      expect(stored?.fileMime).toBeNull();
    });
  });

  test.describe("GET /documents", () => {
    let otherUserId: string;
    let savedJdIds: string[];
    let unsavedJdId: string;
    let otherUserDocId: string;

    test.beforeAll(async ({ http }) => {
      const post = async (options: CallOptions) => track(await http(cookie).post("/documents", options));
      const r1 = await post({
        data: { kind: "JD", sourceText: "JD saved doc one content", save: true, title: "Saved JD One" },
      });
      const r2 = await post({
        data: { kind: "JD", sourceText: "JD saved doc two content", save: true, title: "Saved JD Two" },
      });
      const r3 = await post({ data: { kind: "JD", sourceText: "JD unsaved doc content", save: false } });

      savedJdIds = [(r1.body as DocumentResponseBody).id, (r2.body as DocumentResponseBody).id];
      unsavedJdId = (r3.body as DocumentResponseBody).id;

      otherUserId = await createUser();
      otherUserDocId = await insertDocument({
        userId: otherUserId,
        kind: "JD",
        title: "Other user JD",
        sourceFormat: "text",
        rawText: "other user content",
        isSaved: true,
      });
    });

    test.afterAll(async () => {
      await deleteUsers([otherUserId]);
    });

    test("[EP] lists saved JD docs for current user only, no rawText, ordered createdAt desc", async ({ http }) => {
      const res = await http(cookie).get("/documents", { params: { kind: "JD", saved: "true" } });

      expect(res.status).toBe(200);
      const body = res.body as DocumentSummaryResponseBody[];
      expect(Array.isArray(body)).toBe(true);

      const ids = body.map((d) => d.id);
      expect(ids).toEqual(expect.arrayContaining(savedJdIds));
      expect(ids).not.toContain(unsavedJdId);
      // per-user isolation: another user's document must never leak in
      expect(ids).not.toContain(otherUserDocId);

      for (const doc of body) {
        expect(doc).not.toHaveProperty("rawText");
        expect(doc.kind).toBe("JD");
      }

      const timestamps = body.map((d) => new Date(d.createdAt).getTime());
      const sortedDesc = [...timestamps].sort((a, b) => b - a);
      expect(timestamps).toEqual(sortedDesc);
    });

    test("[EP] saved=false excludes the saved docs", async ({ http }) => {
      const res = await http(cookie).get("/documents", { params: { kind: "JD", saved: "false" } });

      expect(res.status).toBe(200);
      const body = res.body as DocumentSummaryResponseBody[];
      const ids = body.map((d) => d.id);
      expect(ids).toContain(unsavedJdId);
      expect(ids).not.toEqual(expect.arrayContaining(savedJdIds));
    });

    test("[EP] per-user isolation: second user document never appears for stub user, regardless of filter", async ({
      http,
    }) => {
      const res = await http(cookie).get("/documents", { params: { kind: "JD" } });

      expect(res.status).toBe(200);
      const body = res.body as DocumentSummaryResponseBody[];
      const ids = body.map((d) => d.id);
      expect(ids).not.toContain(otherUserDocId);
    });
  });

  test.describe("GET /documents/:id", () => {
    let otherUserId: string;
    let ownDocId: string;
    let otherUserDocId: string;

    test.beforeAll(async ({ http }) => {
      const res = track(
        await http(cookie).post("/documents", {
          data: { kind: "JD", sourceText: "JD content for GET by id test", save: false },
        })
      );
      ownDocId = (res.body as DocumentResponseBody).id;

      otherUserId = await createUser();
      otherUserDocId = await insertDocument({
        userId: otherUserId,
        kind: "JD",
        title: "Other user JD",
        sourceFormat: "text",
        rawText: "other user content",
        isSaved: true,
      });
    });

    test.afterAll(async () => {
      await deleteUsers([otherUserId]);
    });

    test("[EP] returns the DocumentDto (with rawText) for the current user", async ({ http }) => {
      const res = await http(cookie).get(`/documents/${ownDocId}`);
      expect(res.status).toBe(200);
      const body = res.body as DocumentResponseBody;
      expect(body.id).toBe(ownDocId);
      expect(body.rawText).toBe("JD content for GET by id test");
    });

    test("[EP] per-user isolation: another user's document → 404", async ({ http }) => {
      const res = await http(cookie).get(`/documents/${otherUserDocId}`);
      expect(res.status).toBe(404);
    });

    test("[boundary] non-existent (but valid uuid) id → 404", async ({ http }) => {
      const res = await http(cookie).get("/documents/00000000-0000-0000-0000-000000000001");
      expect(res.status).toBe(404);
    });
  });

  test.describe("GET /documents/:id/file", () => {
    const pdfBytes = readFileSync(PDF_FIXTURE);
    let otherUserId: string;
    let pdfDocId: string;
    let textDocId: string;
    let otherUserDocId: string;

    test.beforeAll(async ({ http }) => {
      const res = track(
        await http(cookie).post("/documents", {
          multipart: { kind: "CV", save: "true", title: "CV1", file: pdfFile() },
        })
      );
      pdfDocId = (res.body as DocumentResponseBody).id;

      const textRes = track(
        await http(cookie).post("/documents", {
          data: { kind: "JD", sourceText: "Paste-only JD, no original file attached.", save: false },
        })
      );
      textDocId = (textRes.body as DocumentResponseBody).id;

      otherUserId = await createUser();
      otherUserDocId = await insertDocument({
        userId: otherUserId,
        kind: "CV",
        title: "Other user CV",
        sourceFormat: "pdf",
        rawText: "other user content",
        isSaved: true,
        fileData: pdfBytes,
        fileMime: "application/pdf",
      });
    });

    test.afterAll(async () => {
      await deleteUsers([otherUserId]);
    });

    test("[EP] returns original PDF bytes, content-type application/pdf, inline by default", async ({ http }) => {
      const res = await http(cookie).get(`/documents/${pdfDocId}/file`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(res.headers["content-disposition"]).toContain("inline");
      expect(Buffer.compare(res.raw, pdfBytes)).toBe(0);
    });

    test("[EP] ?download=1 → content-disposition contains attachment", async ({ http }) => {
      const res = await http(cookie).get(`/documents/${pdfDocId}/file`, { params: { download: "1" } });

      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toContain("attachment");
    });

    test("[EP] per-user isolation: another user's document → 404", async ({ http }) => {
      const res = await http(cookie).get(`/documents/${otherUserDocId}/file`);
      expect(res.status).toBe(404);
    });

    test("[error-guessing] title with quotes/CRLF/semicolon → Content-Disposition filename is sanitized", async ({
      http,
    }) => {
      const evilTitle = 'evil";x=1\r\nSet-Cookie: a';
      const res = track(
        await http(cookie).post("/documents", {
          multipart: { kind: "CV", save: "true", title: evilTitle, file: pdfFile() },
        })
      );
      const evilDocId = (res.body as DocumentResponseBody).id;

      const fileRes = await http(cookie).get(`/documents/${evilDocId}/file`);

      expect(fileRes.status).toBe(200);
      const disposition = fileRes.headers["content-disposition"];
      // the whole header is one line with a single quoted filename: no stray
      // quote, CR, LF, or semicolon can have survived sanitization.
      expect(disposition).toBe('inline; filename="evil_x_1_Set-Cookie_a.pdf"');
    });

    test("[EP] paste-text doc (no original file) → 404", async ({ http }) => {
      const res = await http(cookie).get(`/documents/${textDocId}/file`);
      expect(res.status).toBe(404);
    });
  });

  test.describe("PATCH /documents/:id", () => {
    let otherUserId: string;
    let ownDocId: string;
    let otherUserDocId: string;

    test.beforeAll(async ({ http }) => {
      const res = track(
        await http(cookie).post("/documents", {
          data: { kind: "JD", sourceText: "JD content for PATCH test", save: true, title: "Original title" },
        })
      );
      ownDocId = (res.body as DocumentResponseBody).id;

      otherUserId = await createUser();
      otherUserDocId = await insertDocument({
        userId: otherUserId,
        kind: "JD",
        title: "Other user JD",
        sourceFormat: "text",
        rawText: "other user content",
        isSaved: true,
      });
    });

    test.afterAll(async () => {
      await deleteUsers([otherUserId]);
    });

    test("[EP] renames the document → 200, title updated", async ({ http }) => {
      const res = await http(cookie).patch(`/documents/${ownDocId}`, { data: { title: "New" } });

      expect(res.status).toBe(200);
      const body = res.body as DocumentResponseBody;
      expect(body.title).toBe("New");
    });

    test("[BVA] empty title → 400", async ({ http }) => {
      const res = await http(cookie).patch(`/documents/${ownDocId}`, { data: { title: "" } });

      expect(res.status).toBe(400);
    });

    test("[BVA] whitespace-only title (trims to empty) → 400", async ({ http }) => {
      const res = await http(cookie).patch(`/documents/${ownDocId}`, { data: { title: "   " } });

      expect(res.status).toBe(400);
    });

    test("[BVA] 201-char title → 400", async ({ http }) => {
      const res = await http(cookie).patch(`/documents/${ownDocId}`, { data: { title: "a".repeat(201) } });

      expect(res.status).toBe(400);
    });

    test("[BVA] 200-char title (max valid boundary) → 200, title accepted in full", async ({ http }) => {
      const title = "a".repeat(200);
      const res = await http(cookie).patch(`/documents/${ownDocId}`, { data: { title } });

      expect(res.status).toBe(200);
      const body = res.body as DocumentResponseBody;
      expect(body.title).toBe(title);
    });

    test("[EP] per-user isolation: another user's document → 404", async ({ http }) => {
      const res = await http(cookie).patch(`/documents/${otherUserDocId}`, { data: { title: "Hijacked" } });

      expect(res.status).toBe(404);
    });
  });

  test.describe("DELETE /documents/:id", () => {
    let otherUserId: string;
    let freeDocId: string;
    let inUseCvId: string;
    let inUseJdId: string;
    let matchResultId: string;
    let otherUserDocId: string;

    test.beforeAll(async ({ http }) => {
      const post = async (options: CallOptions) =>
        (track(await http(cookie).post("/documents", options)).body as DocumentResponseBody).id;
      freeDocId = await post({
        data: { kind: "JD", sourceText: "JD content not referenced by any match", save: true, title: "Free doc" },
      });
      inUseCvId = await post({
        data: { kind: "CV", sourceText: "CV content referenced by a match", save: true, title: "In-use CV" },
      });
      inUseJdId = await post({
        data: { kind: "JD", sourceText: "JD content referenced by a match", save: true, title: "In-use JD" },
      });

      matchResultId = await insertMatchResult({
        userId,
        cvDocumentId: inUseCvId,
        jdDocumentId: inUseJdId,
        scores: [80, 80, 80],
        report: {},
      });

      otherUserId = await createUser();
      otherUserDocId = await insertDocument({
        userId: otherUserId,
        kind: "JD",
        title: "Other user JD",
        sourceFormat: "text",
        rawText: "other user content",
        isSaved: true,
      });
    });

    test.afterAll(async () => {
      await deleteMatchResults([matchResultId]);
      await deleteUsers([otherUserId]);
    });

    test("[EP] deletes a document not referenced by any match → 204, row gone", async ({ http }) => {
      const res = await http(cookie).delete(`/documents/${freeDocId}`);
      expect(res.status).toBe(204);

      const stored = await findDocument(freeDocId);
      expect(stored).toBeNull();
    });

    test("[DT] CV-referencing document (cvDocumentId arm) → 409, row still present", async ({ http }) => {
      const res = await http(cookie).delete(`/documents/${inUseCvId}`);
      expect(res.status).toBe(409);

      const stored = await findDocument(inUseCvId);
      expect(stored).not.toBeNull();
    });

    test("[DT] JD-referencing document (jdDocumentId arm) → 409, row still present", async ({ http }) => {
      const res = await http(cookie).delete(`/documents/${inUseJdId}`);
      expect(res.status).toBe(409);

      const stored = await findDocument(inUseJdId);
      expect(stored).not.toBeNull();
    });

    test("[EP] per-user isolation: another user's document → 404", async ({ http }) => {
      const res = await http(cookie).delete(`/documents/${otherUserDocId}`);
      expect(res.status).toBe(404);
    });
  });
});
