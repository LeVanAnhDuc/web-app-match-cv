import { test, expect } from "@/fixtures";
import {
  COLLIDING_TITLES,
  EMPTY_SLUG_TITLES,
  FAKE_PDF,
  LONG_TITLE,
  MAX_PATH_COMPONENT,
  MAX_SLUG_LENGTH,
  MIME,
  SLUG_CASES,
  WINDOWS_RESERVED,
  WINDOWS_RESERVED_RE,
  ZIP_SLIP_TITLES,
} from "@/data/test-data/data-export";

// REQ-DATAEXPORT-15…19: zip entry names come from a user-controlled title, so naming is a security boundary
// (zip-slip, reserved names, collisions), not cosmetics. Every document here has a file, so every one gets an entry.

/** First 6 hex chars of a uuid, the suffix the server appends. */
const id6 = (id: string) => id.replace(/-/g, "").slice(0, 6);

test.describe("GET /me/export — entry naming", () => {
  test(
    "tên entry là slug tiêu đề cộng 6 hex id, đuôi suy từ mime",
    { tag: ["@TC-DATAEXPORT-014", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();
      const expected: string[] = [];
      for (const c of SLUG_CASES) {
        const id = await dataExportSeed.document({
          userId: user.userId,
          title: c.title,
          fileData: FAKE_PDF(c.slug),
          fileMime: c.mime,
        });
        expected.push(`documents/${c.slug}-${id6(id)}.${c.ext}`);
      }

      const res = await apiAs(user).me.export();
      expect(res.status).toBe(200);

      expect([...dataExportArchive(res.raw).documentEntries].sort()).toEqual([...expected].sort());
    }
  );

  test(
    "tiêu đề kiểu zip-slip không đưa entry ra ngoài documents/",
    { tag: ["@TC-DATAEXPORT-015", "@smoke", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();
      for (const title of ZIP_SLIP_TITLES) {
        await dataExportSeed.document({ userId: user.userId, title, fileData: FAKE_PDF(title), fileMime: MIME.pdf });
      }

      const res = await apiAs(user).me.export();
      expect(res.status).toBe(200);
      const archive = dataExportArchive(res.raw);

      expect(archive.documentEntries).toHaveLength(ZIP_SLIP_TITLES.length);
      for (const name of archive.names.filter((n) => n !== "data.json")) {
        expect(name).toMatch(/^documents\/[^/\\]+$/);
        const base = name.slice("documents/".length);
        expect(base).not.toContain("..");
        // eslint-disable-next-line no-control-regex -- the point is to find control characters
        expect(base).not.toMatch(/[\u0000-\u001f\u007f]/);
      }
    }
  );

  test(
    "tiêu đề rỗng, toàn dấu câu hoặc emoji thành tên document kèm hậu tố id",
    { tag: ["@TC-DATAEXPORT-016", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();
      const expected: string[] = [];
      for (const title of EMPTY_SLUG_TITLES) {
        const id = await dataExportSeed.document({
          userId: user.userId,
          title,
          fileData: FAKE_PDF(title),
          fileMime: MIME.pdf,
        });
        expected.push(`documents/document-${id6(id)}.pdf`);
      }

      const res = await apiAs(user).me.export();
      expect(res.status).toBe(200);

      expect([...dataExportArchive(res.raw).documentEntries].sort()).toEqual([...expected].sort());
    }
  );

  test(
    "hai tiêu đề cùng slug cho hai entry riêng, không ghi đè",
    { tag: ["@TC-DATAEXPORT-017", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();
      const bodies = new Map<string, Buffer>();
      for (const title of COLLIDING_TITLES) {
        const bytes = FAKE_PDF(`content of ${title}`);
        bodies.set(await dataExportSeed.document({ userId: user.userId, title, fileData: bytes, fileMime: MIME.pdf }), bytes);
      }

      const res = await apiAs(user).me.export();
      expect(res.status).toBe(200);
      const archive = dataExportArchive(res.raw);

      expect(archive.documentEntries).toHaveLength(2);
      expect(new Set(archive.documentEntries).size).toBe(2);
      for (const doc of archive.manifest().documents) {
        expect(archive.bytes(String(doc.file)).equals(bodies.get(doc.id)!), doc.title).toBe(true);
      }
    }
  );

  test(
    "tên dành riêng Windows không thành tên entry trần",
    { tag: ["@TC-DATAEXPORT-018", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();
      for (const title of WINDOWS_RESERVED) {
        await dataExportSeed.document({ userId: user.userId, title, fileData: FAKE_PDF(title), fileMime: MIME.pdf });
      }

      const res = await apiAs(user).me.export();
      expect(res.status).toBe(200);
      const entries = dataExportArchive(res.raw).documentEntries;

      expect(entries).toHaveLength(WINDOWS_RESERVED.length);
      for (const name of entries) {
        const stem = name.slice("documents/".length).replace(/\.[^.]+$/, "");
        expect(stem, name).not.toMatch(WINDOWS_RESERVED_RE);
      }
    }
  );

  test(
    "tiêu đề 500 ký tự cho tên entry không quá 255 ký tự",
    { tag: ["@TC-DATAEXPORT-019", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      expect(LONG_TITLE.length).toBeGreaterThanOrEqual(500);
      const user = await dataExportUsers.signedIn();
      const id = await dataExportSeed.document({
        userId: user.userId,
        title: LONG_TITLE,
        fileData: FAKE_PDF("long"),
        fileMime: MIME.pdf,
      });

      const res = await apiAs(user).me.export();
      expect(res.status).toBe(200);
      const [entry] = dataExportArchive(res.raw).documentEntries;

      for (const component of entry.split("/")) expect(component.length).toBeLessThanOrEqual(MAX_PATH_COMPONENT);
      const suffix = `-${id6(id)}.pdf`;
      expect(entry.endsWith(suffix)).toBe(true);
      const slug = entry.slice("documents/".length, -suffix.length);
      expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    }
  );

  test(
    "tên entry thuần ASCII hoặc có cờ UTF-8",
    { tag: ["@TC-DATAEXPORT-020", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();
      for (const title of ["Hồ sơ Nguyễn Thị Đào", "Mô tả công việc kỹ sư"]) {
        await dataExportSeed.document({ userId: user.userId, title, fileData: FAKE_PDF(title), fileMime: MIME.pdf });
      }

      const res = await apiAs(user).me.export();
      expect(res.status).toBe(200);
      const archive = dataExportArchive(res.raw);

      expect(archive.documentEntries).toHaveLength(2);
      for (const name of archive.names) {
        // eslint-disable-next-line no-control-regex -- printable ASCII check
        const ascii = /^[\x20-\x7e]+$/.test(name);
        expect(ascii || archive.utf8Flag(name), name).toBe(true);
      }
    }
  );
});
