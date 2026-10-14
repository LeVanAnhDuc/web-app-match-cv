import AdmZip from "adm-zip";
import { test, expect } from "@/fixtures";
import { insertAiCredential, insertDocument, sql } from "@/utils/db";
import { createSignedInUser, createUser, deleteUsers } from "@/utils/sessions";

// Ported from server/test/me.e2e-spec.ts. No AI and no crypto involved (the export only reads rows), so every case
// runs live. Rows the old suite seeded through PrismaService go through `pg` (@/utils/db).

// Markers distinctive enough that a substring search over the WHOLE archive
// (not just data.json) proves they never leaked, and specific enough that a
// coincidental match is not plausible.
const CIPHERTEXT_MARKER = "SUPER_SECRET_CIPHERTEXT_MARKER";
const KEY_IV_MARKER = "IV_MARKER_BYTES";
const KEY_TAG_MARKER = "TAG_MARKER_BYTES";
const OTHER_USER_MARKER = "OTHER_USER_SECRET_MARKER";

interface ExportManifestBody {
  schemaVersion: number;
  documents: Array<unknown>;
  aiCredentials: Array<{ keyLast4: string }>;
}

test.describe("GET /me/export (e2e)", () => {
  let userId: string;
  let cookie: string;
  const otherUserIds: string[] = [];

  test.beforeAll(async () => {
    ({ userId, cookie } = await createSignedInUser());
  });

  test.afterAll(async () => {
    await deleteUsers([userId]);
  });

  test.beforeEach(async () => {
    // Every test starts from an empty account: matchResult first (it holds
    // FKs into document), then document and aiCredential.
    await sql('DELETE FROM "MatchResult" WHERE "userId" = $1', [userId]);
    await sql('DELETE FROM "Document" WHERE "userId" = $1', [userId]);
    await sql('DELETE FROM "AiCredential" WHERE "userId" = $1', [userId]);
  });

  test.afterEach(async () => {
    if (otherUserIds.length) {
      await deleteUsers(otherUserIds);
      otherUserIds.length = 0;
    }
  });

  test("returns a zip containing data.json and one entry per uploaded file, byte-identical to the source", async ({
    http,
  }) => {
    const pdfBytes = Buffer.from("%PDF-1.4 fake pdf bytes");
    await insertDocument({
      userId,
      kind: "CV",
      title: "CV Nguyen Van A",
      sourceFormat: "pdf",
      rawText: "hello",
      fileData: pdfBytes,
      fileMime: "application/pdf",
      isSaved: true,
    });

    const res = await http(cookie).get("/me/export");
    expect(res.status).toBe(200);

    expect(res.headers["content-type"]).toContain("application/zip");
    expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="export-\d{4}-\d{2}-\d{2}\.zip"$/);

    const zip = new AdmZip(res.raw);
    const names = zip.getEntries().map((e) => e.entryName);
    expect(names).toContain("data.json");

    const fileEntries = names.filter((n) => n.startsWith("documents/"));
    expect(fileEntries).toHaveLength(1);
    // Byte-identical, compared as bytes — not by length.
    expect(zip.getEntry(fileEntries[0])!.getData().equals(pdfBytes)).toBe(true);
  });

  test("never leaks credential ciphertext into the archive", async ({ http }) => {
    await insertAiCredential({
      userId,
      provider: "openai",
      label: "Key ca nhan",
      encryptedKey: Buffer.from(CIPHERTEXT_MARKER),
      keyIv: Buffer.from(KEY_IV_MARKER),
      keyTag: Buffer.from(KEY_TAG_MARKER),
      keyLast4: "4f2a",
    });

    const res = await http(cookie).get("/me/export");
    expect(res.status).toBe(200);

    // Layer 1 — raw compressed body. Entry NAMES and other zip metadata
    // (central directory, comments, extra fields) are stored uncompressed,
    // so a leak landing in a filename or comment still surfaces here.
    const rawBody = res.raw.toString("latin1");
    for (const marker of [CIPHERTEXT_MARKER, KEY_IV_MARKER, KEY_TAG_MARKER, "encryptedKey", "keyIv", "keyTag"]) {
      expect(rawBody).not.toContain(marker);
    }

    // Layer 2 — decompressed entry content. `data.json` is deflate-compressed
    // (zlib level 9), so a marker leaked into its JSON body would NOT appear
    // literally in the raw compressed bytes above — deflate does not preserve
    // substrings byte-for-byte. `AdmZip#getData()` inflates each entry, so
    // this is the layer that actually proves the *content* is clean, not
    // just the metadata around it.
    const zip = new AdmZip(res.raw);
    const decompressedAll = zip
      .getEntries()
      .map((entry) => entry.getData().toString("latin1"))
      .join("\n");
    for (const marker of [CIPHERTEXT_MARKER, KEY_IV_MARKER, KEY_TAG_MARKER, "encryptedKey", "keyIv", "keyTag"]) {
      expect(decompressedAll).not.toContain(marker);
    }

    const manifest = JSON.parse(zip.getEntry("data.json")!.getData().toString("utf8")) as ExportManifestBody;
    expect(manifest.aiCredentials).toHaveLength(1);
    expect(manifest.aiCredentials[0].keyLast4).toBe("4f2a");
  });

  test("excludes another user's documents (per-user isolation)", async ({ http }) => {
    const other = await createUser();
    otherUserIds.push(other);
    await insertDocument({
      userId: other,
      kind: "CV",
      title: "OTHER USER SECRET CV",
      sourceFormat: "text",
      rawText: OTHER_USER_MARKER,
      isSaved: true,
    });

    const res = await http(cookie).get("/me/export");
    expect(res.status).toBe(200);

    // The marker lives in `rawText`, which lands inside the deflate-compressed
    // `data.json` entry — so, as in the ciphertext-leak case above, only a
    // decompressed-content scan (not a raw-compressed-bytes scan) actually
    // proves it is absent.
    expect(res.raw.toString("latin1")).not.toContain(OTHER_USER_MARKER);
    const zip = new AdmZip(res.raw);
    const decompressedAll = zip
      .getEntries()
      .map((entry) => entry.getData().toString("latin1"))
      .join("\n");
    expect(decompressedAll).not.toContain(OTHER_USER_MARKER);
  });

  test("returns a valid empty archive when the account has no data", async ({ http }) => {
    // Table cleanup in beforeEach leaves the account empty.
    const res = await http(cookie).get("/me/export");
    expect(res.status).toBe(200);

    const zip = new AdmZip(res.raw);
    expect(zip.getEntries().map((e) => e.entryName)).toEqual(["data.json"]);

    const manifest = JSON.parse(zip.getEntry("data.json")!.getData().toString("utf8")) as ExportManifestBody;
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.documents).toEqual([]);
    expect(manifest.aiCredentials).toEqual([]);
  });

  test("rejects a wrong method with 404", async ({ http }) => {
    expect((await http(cookie).post("/me/export")).status).toBe(404);
  });

  test("ignores a Range header rather than serving a truncated archive", async ({ http }) => {
    // The zip is a non-seekable stream. Serving a partial body with 200 would
    // hand the client a broken archive that looks like a complete download —
    // the worst outcome, since the client cannot tell it apart from success.
    const res = await http(cookie).get("/me/export", { headers: { Range: "bytes=0-100" } });

    const body = res.raw;
    expect([200, 416]).toContain(res.status);
    if (res.status === 200) {
      // Full body: it must still open as a valid zip.
      const zip = new AdmZip(body);
      expect(() => zip.getEntries()).not.toThrow();
      expect(zip.getEntries().map((e) => e.entryName)).toContain("data.json");
    }
  });
});
