import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import AdmZip from "adm-zip";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { STUB_USER_ID } from "../src/common/current-user/current-user.service";
import { PrismaService } from "../src/prisma/prisma.service";

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

describe("GET /me/export (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const otherUserIds: string[] = [];

  // supertest types `.parse()` as accepting a superagent Response, not a raw
  // IncomingMessage — so declare it that way and narrow to the stream we
  // actually consume, rather than fighting the overload resolution. Copied
  // from `test/documents.e2e-spec.ts` (not exported there).
  const binaryParser = (
    res: import("superagent").Response,
    cb: (err: Error | null, body: Buffer) => void
  ) => {
    const chunks: Buffer[] = [];
    const stream = res as unknown as import("stream").Readable;
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => cb(null, Buffer.concat(chunks)));
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Every test starts from an empty account: matchResult first (it holds
    // FKs into document), then document and aiCredential.
    await prisma.matchResult.deleteMany({ where: { userId: STUB_USER_ID } });
    await prisma.document.deleteMany({ where: { userId: STUB_USER_ID } });
    await prisma.aiCredential.deleteMany({ where: { userId: STUB_USER_ID } });
  });

  afterEach(async () => {
    if (otherUserIds.length) {
      await prisma.document.deleteMany({
        where: { userId: { in: otherUserIds } }
      });
      await prisma.user.deleteMany({ where: { id: { in: otherUserIds } } });
      otherUserIds.length = 0;
    }
  });

  it("returns a zip containing data.json and one entry per uploaded file, byte-identical to the source", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4 fake pdf bytes");
    await prisma.document.create({
      data: {
        userId: STUB_USER_ID,
        kind: "CV",
        title: "CV Nguyen Van A",
        sourceFormat: "pdf",
        rawText: "hello",
        fileData: pdfBytes,
        fileMime: "application/pdf",
        isSaved: true
      }
    });

    const res = await request(app.getHttpServer())
      .get("/api/v1/me/export")
      .buffer()
      .parse(binaryParser)
      .expect(200);

    expect(res.headers["content-type"]).toContain("application/zip");
    expect(res.headers["content-disposition"]).toMatch(
      /^attachment; filename="export-\d{4}-\d{2}-\d{2}\.zip"$/
    );

    const zip = new AdmZip(res.body as Buffer);
    const names = zip.getEntries().map((e) => e.entryName);
    expect(names).toContain("data.json");

    const fileEntries = names.filter((n) => n.startsWith("documents/"));
    expect(fileEntries).toHaveLength(1);
    // Byte-identical, compared as bytes — not by length.
    expect(zip.getEntry(fileEntries[0])!.getData().equals(pdfBytes)).toBe(true);
  });

  it("never leaks credential ciphertext into the archive", async () => {
    await prisma.aiCredential.create({
      data: {
        userId: STUB_USER_ID,
        provider: "openai",
        label: "Key ca nhan",
        encryptedKey: Buffer.from(CIPHERTEXT_MARKER),
        keyIv: Buffer.from(KEY_IV_MARKER),
        keyTag: Buffer.from(KEY_TAG_MARKER),
        keyLast4: "4f2a"
      }
    });

    const res = await request(app.getHttpServer())
      .get("/api/v1/me/export")
      .buffer()
      .parse(binaryParser)
      .expect(200);

    // Layer 1 — raw compressed body. Entry NAMES and other zip metadata
    // (central directory, comments, extra fields) are stored uncompressed,
    // so a leak landing in a filename or comment still surfaces here.
    const rawBody = (res.body as Buffer).toString("latin1");
    for (const marker of [
      CIPHERTEXT_MARKER,
      KEY_IV_MARKER,
      KEY_TAG_MARKER,
      "encryptedKey",
      "keyIv",
      "keyTag"
    ]) {
      expect(rawBody).not.toContain(marker);
    }

    // Layer 2 — decompressed entry content. `data.json` is deflate-compressed
    // (zlib level 9), so a marker leaked into its JSON body would NOT appear
    // literally in the raw compressed bytes above — deflate does not preserve
    // substrings byte-for-byte. `AdmZip#getData()` inflates each entry, so
    // this is the layer that actually proves the *content* is clean, not
    // just the metadata around it.
    const zip = new AdmZip(res.body as Buffer);
    const decompressedAll = zip
      .getEntries()
      .map((entry) => entry.getData().toString("latin1"))
      .join("\n");
    for (const marker of [
      CIPHERTEXT_MARKER,
      KEY_IV_MARKER,
      KEY_TAG_MARKER,
      "encryptedKey",
      "keyIv",
      "keyTag"
    ]) {
      expect(decompressedAll).not.toContain(marker);
    }

    const manifest = JSON.parse(
      zip.getEntry("data.json")!.getData().toString("utf8")
    ) as ExportManifestBody;
    expect(manifest.aiCredentials).toHaveLength(1);
    expect(manifest.aiCredentials[0].keyLast4).toBe("4f2a");
  });

  it("excludes another user's documents (per-user isolation)", async () => {
    const other = await prisma.user.create({ data: { role: "candidate" } });
    otherUserIds.push(other.id);
    await prisma.document.create({
      data: {
        userId: other.id,
        kind: "CV",
        title: "OTHER USER SECRET CV",
        sourceFormat: "text",
        rawText: OTHER_USER_MARKER,
        isSaved: true
      }
    });

    const res = await request(app.getHttpServer())
      .get("/api/v1/me/export")
      .buffer()
      .parse(binaryParser)
      .expect(200);

    // The marker lives in `rawText`, which lands inside the deflate-compressed
    // `data.json` entry — so, as in the ciphertext-leak case above, only a
    // decompressed-content scan (not a raw-compressed-bytes scan) actually
    // proves it is absent.
    expect((res.body as Buffer).toString("latin1")).not.toContain(
      OTHER_USER_MARKER
    );
    const zip = new AdmZip(res.body as Buffer);
    const decompressedAll = zip
      .getEntries()
      .map((entry) => entry.getData().toString("latin1"))
      .join("\n");
    expect(decompressedAll).not.toContain(OTHER_USER_MARKER);
  });

  it("returns a valid empty archive when the account has no data", async () => {
    // Table cleanup in beforeEach leaves the account empty.
    const res = await request(app.getHttpServer())
      .get("/api/v1/me/export")
      .buffer()
      .parse(binaryParser)
      .expect(200);

    const zip = new AdmZip(res.body as Buffer);
    expect(zip.getEntries().map((e) => e.entryName)).toEqual(["data.json"]);

    const manifest = JSON.parse(
      zip.getEntry("data.json")!.getData().toString("utf8")
    ) as ExportManifestBody;
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.documents).toEqual([]);
    expect(manifest.aiCredentials).toEqual([]);
  });

  it("rejects a wrong method with 404", async () => {
    await request(app.getHttpServer()).post("/api/v1/me/export").expect(404);
  });

  it("ignores a Range header rather than serving a truncated archive", async () => {
    // The zip is a non-seekable stream. Serving a partial body with 200 would
    // hand the client a broken archive that looks like a complete download —
    // the worst outcome, since the client cannot tell it apart from success.
    const res = await request(app.getHttpServer())
      .get("/api/v1/me/export")
      .set("Range", "bytes=0-100")
      .buffer()
      .parse(binaryParser);

    const body = res.body as Buffer;
    expect([200, 416]).toContain(res.status);
    if (res.status === 200) {
      // Full body: it must still open as a valid zip.
      const zip = new AdmZip(body);
      expect(() => zip.getEntries()).not.toThrow();
      expect(zip.getEntries().map((e) => e.entryName)).toContain("data.json");
    }
  });
});
