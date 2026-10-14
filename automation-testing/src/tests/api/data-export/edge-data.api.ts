import { createHash, randomBytes } from "node:crypto";
import { test, expect } from "@/fixtures";
import { BULK_DOCUMENT_COUNT, FAKE_PDF, MIME, TEN_MB } from "@/data/test-data/data-export";

// REQ-DATAEXPORT-20…22: empty accounts, rows that disagree with themselves (a mime but no bytes), and the size /
// count boundaries. Rows are seeded straight into the DB: the upload endpoint would refuse most of these shapes.

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

test.describe("GET /me/export — empty, inconsistent and boundary data", () => {
  test(
    "user chưa có dữ liệu nhận zip hợp lệ chỉ gồm data.json",
    { tag: ["@TC-DATAEXPORT-021", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();

      const res = await apiAs(user).me.export();

      expect(res.status).toBe(200);
      const archive = dataExportArchive(res.raw);
      expect(archive.names).toEqual(["data.json"]);
      const manifest = archive.manifest();
      expect(manifest.documents).toEqual([]);
      expect(manifest.matchResults).toEqual([]);
      expect(manifest.aiCredentials).toEqual([]);
    }
  );

  test(
    "tài liệu có mime nhưng không có file và rawText rỗng vẫn export được",
    { tag: ["@TC-DATAEXPORT-022", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();
      const noBytes = await dataExportSeed.document({
        userId: user.userId,
        title: "Mime without bytes",
        sourceFormat: "pdf",
        fileData: null,
        fileMime: MIME.pdf,
      });
      const zeroBytes = await dataExportSeed.document({
        userId: user.userId,
        title: "Zero byte file",
        sourceFormat: "pdf",
        fileData: Buffer.alloc(0),
        fileMime: MIME.pdf,
      });
      const emptyText = await dataExportSeed.document({ userId: user.userId, title: "Empty text", rawText: "" });

      const res = await apiAs(user).me.export();

      expect(res.status).toBe(200);
      const archive = dataExportArchive(res.raw);
      const docs = new Map(archive.manifest().documents.map((d) => [d.id, d]));
      expect(docs.get(noBytes)?.file).toBeNull();
      expect(docs.get(zeroBytes)?.file).toBeNull();
      expect(archive.documentEntries).toEqual([]);
      expect(docs.get(emptyText)).toHaveProperty("rawText", "");
    }
  );

  test(
    "một và 200 tài liệu có file cho đúng số entry",
    { tag: ["@TC-DATAEXPORT-024", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      const single = await dataExportUsers.signedIn();
      await dataExportSeed.document({ userId: single.userId, title: "Only one", fileData: FAKE_PDF(), fileMime: MIME.pdf });
      const many = await dataExportUsers.signedIn();
      await dataExportSeed.bulkDocuments(many.userId, BULK_DOCUMENT_COUNT, FAKE_PDF("bulk"));

      for (const [user, count] of [
        [single, 1],
        [many, BULK_DOCUMENT_COUNT],
      ] as const) {
        const res = await apiAs(user).me.export();
        expect(res.status).toBe(200);
        const archive = dataExportArchive(res.raw);
        expect(archive.documentEntries).toHaveLength(count);
        expect(new Set(archive.documentEntries).size).toBe(count);
        expect(archive.manifest().documents).toHaveLength(count);
      }
    }
  );

  test(
    "file 10 MB và file 1 byte được stream đủ",
    { tag: ["@TC-DATAEXPORT-025", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      test.setTimeout(120_000);
      const user = await dataExportUsers.signedIn();
      const big = randomBytes(TEN_MB);
      const tiny = Buffer.from([0x25]);
      const bigId = await dataExportSeed.document({ userId: user.userId, title: "Ten megabytes", fileData: big, fileMime: MIME.pdf });
      const tinyId = await dataExportSeed.document({ userId: user.userId, title: "One byte", fileData: tiny, fileMime: MIME.pdf });

      const res = await apiAs(user).me.export();

      expect(res.status).toBe(200);
      const archive = dataExportArchive(res.raw);
      const docs = new Map(archive.manifest().documents.map((d) => [d.id, d]));
      for (const [id, bytes] of [
        [bigId, big],
        [tinyId, tiny],
      ] as const) {
        const extracted = archive.bytes(String(docs.get(id)?.file));
        expect(extracted.length).toBe(bytes.length);
        expect(sha256(extracted)).toBe(sha256(bytes));
      }
    }
  );
});
