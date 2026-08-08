import { PassThrough, type Readable } from "stream";
import archiver from "archiver";
import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CurrentUserService } from "../../common/current-user/current-user.service";
import { PrismaService } from "../../prisma/prisma.service";
import { buildExportManifest } from "./export-manifest";
import { tMe } from "./i18n-messages";

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService
  ) {}

  /**
   * Streams a zip of everything the app holds for the current user.
   *
   * Metadata is read inside one transaction (`RepeatableRead`, so every
   * statement sees the same snapshot — the default `ReadCommitted` would let
   * a document uploaded mid-transaction appear in one query and not
   * another) so `data.json` and the files beside it describe the same
   * instant. The transaction's document query deliberately omits
   * `fileData`: a user with many near-the-cap uploads would otherwise put
   * the whole document store in memory before the append loop even starts.
   * `octet_length` gets each file's size (to know whether it has one)
   * without reading its bytes; the bytes themselves are read one document
   * at a time in the append loop below, after the transaction has closed.
   *
   * The method returns as soon as the manifest and archive are ready — it
   * does NOT await the append loop. `archiver`'s internal queue has
   * concurrency 1 and only drains as the output is read, so awaiting the
   * loop here would stall on backpressure with every appended document's
   * bytes still resident (the exact buffering this method exists to avoid).
   * The loop instead runs detached, so the controller can attach the
   * response to `stream` and start draining it immediately.
   */
  async buildExportArchive(): Promise<{
    stream: Readable;
    archive: archiver.Archiver;
    filename: string;
  }> {
    const userId = this.currentUser.getUserId();
    const exportedAt = new Date();

    const [user, documents, matchResults, aiCredentials, fileSizes] =
      await this.prisma.$transaction(
        [
          this.prisma.user.findFirst({ where: { id: userId } }),
          this.prisma.document.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              kind: true,
              title: true,
              sourceFormat: true,
              rawText: true,
              fileMime: true,
              isSaved: true,
              createdAt: true
            }
          }),
          this.prisma.matchResult.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" }
          }),
          // `encryptedKey`/`keyIv`/`keyTag` are deliberately left out of this
          // `select` — the export never reads them, so there is no reason to
          // pull ciphertext out of the DB and pass it across the module
          // boundary just to have it sit unused on `aiCredentials`.
          this.prisma.aiCredential.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              provider: true,
              label: true,
              keyLast4: true,
              chatModel: true,
              embedModel: true,
              lastTestStatus: true,
              lastTestedAt: true,
              lastUsedAt: true,
              createdAt: true
            }
          }),
          this.prisma.$queryRaw<Array<{ id: string; size: number | null }>>`
          SELECT "id", octet_length("fileData") AS "size"
          FROM "Document"
          WHERE "userId" = ${userId}
        `
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
      );

    if (!user) {
      throw new NotFoundException(
        tMe("me.errors.userNotFound", "User not found.")
      );
    }

    // A positive byte length is what "has a file" means; 0 and NULL (no
    // fileData) both mean no file. Only the id set is kept — the size
    // itself is not needed past this check.
    const documentIdsWithFiles = new Set(
      fileSizes.filter((row) => (row.size ?? 0) > 0).map((row) => row.id)
    );

    const manifest = buildExportManifest({
      user,
      documents: documents.map((doc) => ({
        ...doc,
        // From the `octet_length` probe above, not from reading any bytes —
        // `buildExportManifest` takes an explicit boolean rather than
        // `fileData` so it can never be tempted to read more than
        // truthiness out of a value that isn't real file content.
        hasFile: documentIdsWithFiles.has(doc.id)
      })),
      matchResults,
      aiCredentials,
      exportedAt
    });

    // The manifest is the single place the zip entry name is computed
    // (`export-manifest.ts`'s `file` field) — looked up here rather than
    // recomputed, so the two can never drift apart.
    const entryNameByDocId = new Map(
      manifest.documents
        .filter((doc) => doc.file !== null)
        .map((doc) => [doc.id, doc.file as string])
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = new PassThrough();
    // A no-op listener so that a `stream.destroy(err)` call before the
    // controller attaches its own `'error'` listener (the window between
    // this line and `return`) does not throw an uncaught exception and
    // kill the process — `EventEmitter` throws when `'error'` is emitted
    // with zero listeners.
    stream.on("error", () => {});

    // An error after the response headers are out cannot change the status
    // code, so destroy the stream instead: the client gets a visibly broken
    // download rather than a truncated archive that looks like a success.
    archive.on("error", (err) => {
      stream.destroy(err);
    });
    // Missing-file warnings are not fatal; anything else is.
    archive.on("warning", (err) => {
      if (err.code !== "ENOENT") stream.destroy(err);
    });

    archive.pipe(stream);
    archive.append(JSON.stringify(manifest, null, 2), { name: "data.json" });

    // One document's bytes are fetched immediately before being appended, so
    // peak memory is one document, not the whole store. `userId` stays in
    // the `where` here too — per-user scoping holds on every query, not just
    // the first one — and a document deleted between the snapshot above and
    // this read is skipped (`continue`), not turned into a failed export.
    //
    // Runs detached (not awaited by `buildExportArchive`) so the controller
    // can pipe the response to `stream` before this starts pulling bytes —
    // see the method doc comment above for why awaiting it here would
    // defeat the whole point of streaming.
    const documentsWithFiles = documents.filter((doc) =>
      documentIdsWithFiles.has(doc.id)
    );
    void (async () => {
      try {
        for (const doc of documentsWithFiles) {
          // `writableEnded` becomes true once the archive has finished
          // shutting down after `archive.abort()` (the controller calls it
          // when the client disconnects); `destroyed` covers the error path
          // above. Either way, there is no reader left — stop spending DB
          // round trips fetching bytes nobody will receive.
          if (stream.destroyed || stream.writableEnded) return;
          const row = await this.prisma.document.findFirst({
            where: { id: doc.id, userId },
            select: { fileData: true }
          });
          if (!row?.fileData) continue;
          // Prisma's `Bytes` column comes back as a plain `Uint8Array` at
          // runtime in this client, not a `Buffer` — `archiver.append()`
          // rejects a bare `Uint8Array` ("input source must be valid Stream
          // or Buffer instance"). `Buffer.from(uint8Array)` would work but
          // copies the whole file; wrapping the same underlying
          // `ArrayBuffer` in a `Buffer` view does not.
          const fileBuffer = Buffer.from(
            row.fileData.buffer,
            row.fileData.byteOffset,
            row.fileData.byteLength
          );
          archive.append(fileBuffer, {
            name: entryNameByDocId.get(doc.id) ?? `documents/${doc.id}.bin`
          });
        }
        await archive.finalize();
      } catch (err) {
        stream.destroy(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    const day = exportedAt.toISOString().slice(0, 10);
    return { stream, archive, filename: `export-${day}.zip` };
  }
}
