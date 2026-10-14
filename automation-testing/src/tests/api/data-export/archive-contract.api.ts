import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test, expect } from "@/fixtures";
import { FILES } from "@/data/test-data/shared";
import {
  AI_CREDENTIAL_FIELDS,
  DOCUMENT_FIELDS,
  FAKE_PDF,
  MANIFEST_ROOT_KEYS,
  MATCH_RESULT_FIELDS,
  MIME,
  exportFilenames,
} from "@/data/test-data/data-export";

// REQ-DATAEXPORT-05…12: the happy-path contract of the archive — headers, entries, data.json shape, byte integrity,
// ordering. Every test runs as its own fresh signed-in user, so the archive holds exactly what the test seeded.

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

test.describe("GET /me/export — archive contract", () => {
  test(
    "export trả zip kèm header attachment, tên theo ngày UTC và no-store",
    { tag: ["@TC-DATAEXPORT-004", "@smoke", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();
      const before = new Date();

      const res = await apiAs(user).me.export();

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/zip");
      const disposition = res.headers["content-disposition"] ?? "";
      const filename = disposition.match(/^attachment; filename="([^"]+)"$/)?.[1];
      expect(filename, disposition).toBeDefined();
      expect(filename).toMatch(/^[a-z0-9.-]+$/);
      expect(exportFilenames(before)).toContain(filename);
      expect(res.headers["cache-control"]).toContain("no-store");
      expect(dataExportArchive(res.raw).has("data.json")).toBe(true);
    }
  );

  test(
    "zip có data.json và đúng một entry cho mỗi tài liệu có file",
    { tag: ["@TC-DATAEXPORT-005", "@smoke", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();
      const api = apiAs(user);
      const pdf = await api.documents.upload({ kind: "CV", save: true, title: "Export PDF", file: FILES.pdf });
      const docx = await api.documents.upload({ kind: "CV", save: true, title: "Export DOCX", file: FILES.docx });
      const paste = await api.documents.create({ kind: "JD", save: true, title: "Export paste", sourceText: "Backend engineer, NestJS" });
      for (const created of [pdf, docx, paste]) expect(created.status, created.text).toBe(201);

      const res = await api.me.export();
      expect(res.status).toBe(200);
      const archive = dataExportArchive(res.raw);

      // Nothing but data.json and the per-document files (directory records, if any, are ignored).
      expect(archive.names.filter((n) => !n.endsWith("/")).sort()).toEqual(
        ["data.json", ...archive.documentEntries].sort()
      );
      expect(archive.documentEntries).toHaveLength(2);
      const byId = new Map(archive.manifest().documents.map((d) => [d.id, d]));
      expect(byId.get(paste.json().id)?.file).toBeNull();
      const files = [pdf, docx].map((r) => byId.get(r.json().id)?.file);
      expect(files.every((f) => typeof f === "string")).toBe(true);
      expect([...files].sort()).toEqual([...archive.documentEntries].sort());
    }
  );

  test(
    "data.json có đủ khoá gốc và user là chính người gọi",
    { tag: ["@TC-DATAEXPORT-006", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();
      const before = Date.now();

      const res = await apiAs(user).me.export();
      const after = Date.now();
      expect(res.status).toBe(200);
      const manifest = dataExportArchive(res.raw).manifest();

      for (const key of MANIFEST_ROOT_KEYS) expect(manifest, key).toHaveProperty(key);
      expect(Number.isInteger(manifest.schemaVersion) && manifest.schemaVersion > 0).toBe(true);
      expect(manifest.exportedAt).toMatch(ISO_UTC);
      const exportedAt = Date.parse(manifest.exportedAt);
      expect(exportedAt).toBeGreaterThanOrEqual(before - 1_000);
      expect(exportedAt).toBeLessThanOrEqual(after + 1_000);
      expect(manifest.user.id).toBe(user.userId);
      expect(manifest.user.role).toBe("candidate");
      expect(manifest.user.createdAt).toMatch(ISO_UTC);
      expect(Array.isArray(manifest.documents)).toBe(true);
      expect(Array.isArray(manifest.matchResults)).toBe(true);
      expect(Array.isArray(manifest.aiCredentials)).toBe(true);
    }
  );

  test(
    "mỗi tài liệu trong data.json có đủ field và giá trị đúng",
    { tag: ["@TC-DATAEXPORT-007", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();
      const cvId = await dataExportSeed.document({
        userId: user.userId,
        kind: "CV",
        title: "CV with file",
        sourceFormat: "pdf",
        rawText: "Extracted CV text",
        fileData: FAKE_PDF("cv"),
        fileMime: MIME.pdf,
        isSaved: true,
      });
      const jdId = await dataExportSeed.document({
        userId: user.userId,
        kind: "JD",
        title: "Pasted JD",
        sourceFormat: "text",
        rawText: "Pasted JD text",
        isSaved: false,
      });

      const res = await apiAs(user).me.export();
      expect(res.status).toBe(200);
      const archive = dataExportArchive(res.raw);
      const docs = archive.manifest().documents;

      for (const doc of docs) for (const field of DOCUMENT_FIELDS) expect(doc, field).toHaveProperty(field);
      const cv = docs.find((d) => d.id === cvId);
      const jd = docs.find((d) => d.id === jdId);
      expect(cv).toMatchObject({
        kind: "CV",
        title: "CV with file",
        sourceFormat: "pdf",
        isSaved: true,
        rawText: "Extracted CV text",
      });
      expect(String(cv?.createdAt)).toMatch(ISO_UTC);
      expect(cv?.file).toMatch(/^documents\//);
      expect(archive.has(String(cv?.file))).toBe(true);
      expect(jd).toMatchObject({
        kind: "JD",
        title: "Pasted JD",
        sourceFormat: "text",
        isSaved: false,
        rawText: "Pasted JD text",
        file: null,
      });
    }
  );

  test(
    "kết quả match trong data.json có đủ field, credentialId chỉ là id tham chiếu",
    { tag: ["@TC-DATAEXPORT-008", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();
      const { cvId, jdId } = await dataExportSeed.pair(user.userId);
      const credentialId = await dataExportSeed.credential({ userId: user.userId });
      const withCred = await dataExportSeed.matchResult({
        userId: user.userId,
        cvDocumentId: cvId,
        jdDocumentId: jdId,
        credentialId,
      });
      const withoutCred = await dataExportSeed.matchResult({
        userId: user.userId,
        cvDocumentId: cvId,
        jdDocumentId: jdId,
      });

      const res = await apiAs(user).me.export();
      expect(res.status).toBe(200);
      const matches = dataExportArchive(res.raw).manifest().matchResults;

      expect(matches.map((m) => m.id).sort()).toEqual([withCred, withoutCred].sort());
      for (const match of matches) for (const field of MATCH_RESULT_FIELDS) expect(match, field).toHaveProperty(field);
      const withCredRow = matches.find((m) => m.id === withCred);
      expect(withCredRow).toMatchObject({ cvDocumentId: cvId, jdDocumentId: jdId, overallScore: 72, credentialId });
      expect(typeof withCredRow?.credentialId).toBe("string");
      expect(matches.find((m) => m.id === withoutCred)?.credentialId).toBeNull();
    }
  );

  test(
    "credential trong data.json chỉ có đúng tập field cho phép",
    { tag: ["@TC-DATAEXPORT-009", "@smoke", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();
      const id = await dataExportSeed.credential({ userId: user.userId, label: "Work key", keyLast4: "9z8y" });

      const res = await apiAs(user).me.export();
      expect(res.status).toBe(200);
      const creds = dataExportArchive(res.raw).manifest().aiCredentials;

      expect(creds).toHaveLength(1);
      expect(Object.keys(creds[0]).sort()).toEqual([...AI_CREDENTIAL_FIELDS].sort());
      expect(creds[0]).toMatchObject({ id, label: "Work key", keyLast4: "9z8y", provider: "openai" });
    }
  );

  test(
    "file trong zip giống hệt từng byte bản đã upload",
    { tag: ["@TC-DATAEXPORT-010", "@smoke", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();
      const api = apiAs(user);
      const uploads = [
        { path: FILES.pdf, res: await api.documents.upload({ kind: "CV", save: true, title: "Export PDF", file: FILES.pdf }) },
        { path: FILES.docx, res: await api.documents.upload({ kind: "JD", save: true, title: "Export DOCX", file: FILES.docx }) },
      ];
      for (const { res } of uploads) expect(res.status, res.text).toBe(201);

      const res = await api.me.export();
      expect(res.status).toBe(200);
      const archive = dataExportArchive(res.raw);
      const docs = archive.manifest().documents;

      for (const upload of uploads) {
        const entry = docs.find((d) => d.id === upload.res.json().id)?.file;
        expect(entry, upload.path).toBeTruthy();
        // Compared as hashes of the full bytes, not by length.
        expect(sha256(archive.bytes(String(entry))), upload.path).toBe(sha256(readFileSync(upload.path)));
      }
    }
  );

  test(
    "các mảng trong data.json sắp theo createdAt tăng dần",
    { tag: ["@TC-DATAEXPORT-011", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();
      const userId = user.userId;
      const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000);
      // Inserted out of order, so insertion order and createdAt order disagree.
      const doc3 = await dataExportSeed.document({ userId, title: "Third", createdAt: at(10) });
      const doc1 = await dataExportSeed.document({ userId, title: "First", createdAt: at(30) });
      const doc2 = await dataExportSeed.document({ userId, title: "Second", createdAt: at(20) });
      const match2 = await dataExportSeed.matchResult({
        userId,
        cvDocumentId: doc1,
        jdDocumentId: doc2,
        createdAt: at(5),
      });
      const match1 = await dataExportSeed.matchResult({
        userId,
        cvDocumentId: doc1,
        jdDocumentId: doc3,
        createdAt: at(8),
      });
      const cred2 = await dataExportSeed.credential({ userId, label: "Newer", createdAt: at(2) });
      const cred1 = await dataExportSeed.credential({ userId, label: "Older", createdAt: at(4) });

      const res = await apiAs(user).me.export();
      expect(res.status).toBe(200);
      const manifest = dataExportArchive(res.raw).manifest();

      expect(manifest.documents.map((d) => d.id)).toEqual([doc1, doc2, doc3]);
      expect(manifest.matchResults.map((m) => m.id)).toEqual([match1, match2]);
      expect(manifest.aiCredentials.map((c) => c.id)).toEqual([cred1, cred2]);
    }
  );
});
