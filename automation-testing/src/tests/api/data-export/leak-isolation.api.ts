import { test, expect } from "@/fixtures";
import {
  GUEST_MARKER,
  MIME,
  OTHER_USER_MARKER,
  SECRET_FIELD_NAMES,
  secretMarkers,
} from "@/data/test-data/data-export";

// REQ-DATAEXPORT-13/14: the archive is the user's full PII export, so it is scanned byte by byte.
// Two layers on purpose: the RAW body (entry names, comments and other zip metadata are stored uncompressed, so a leak
// landing there shows up literally) and every entry DECOMPRESSED (data.json is deflated, and deflate does not keep
// substrings byte for byte — only the inflated content proves the JSON itself is clean).

test.describe("GET /me/export — leaks and isolation", () => {
  test(
    "không byte nào trong zip lộ ciphertext, IV, tag của nhiều credential",
    { tag: ["@TC-DATAEXPORT-012", "@smoke", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      const user = await dataExportUsers.signedIn();
      const markers = [secretMarkers("ONE"), secretMarkers("TWO")];
      const ids: string[] = [];
      for (const [i, marker] of markers.entries()) {
        ids.push(
          await dataExportSeed.credential({
            userId: user.userId,
            provider: i === 0 ? "openai" : "gemini",
            label: `Key ${i + 1}`,
            encryptedKey: Buffer.from(marker.encryptedKey),
            keyIv: Buffer.from(marker.keyIv),
            keyTag: Buffer.from(marker.keyTag),
            keyLast4: i === 0 ? "4f2a" : "7c1d",
          })
        );
      }

      const res = await apiAs(user).me.export();
      expect(res.status).toBe(200);
      const archive = dataExportArchive(res.raw);

      const forbidden = [...markers.flatMap((m) => Object.values(m)), ...SECRET_FIELD_NAMES];
      const raw = res.raw.toString("latin1");
      const decompressed = archive.decompressedText();
      for (const needle of forbidden) {
        expect(raw, `raw body contains ${needle}`).not.toContain(needle);
        expect(decompressed, `decompressed entries contain ${needle}`).not.toContain(needle);
      }
      const creds = archive.manifest().aiCredentials;
      expect(creds.map((c) => c.id).sort()).toEqual([...ids].sort());
      expect(creds.map((c) => c.keyLast4).sort()).toEqual(["4f2a", "7c1d"]);
    }
  );

  test(
    "zip không chứa dữ liệu của user khác hay của khách",
    { tag: ["@TC-DATAEXPORT-013", "@smoke", "@creates-data"] },
    async ({ apiAs, dataExportUsers, dataExportSeed, dataExportArchive }) => {
      const owner = await dataExportUsers.signedIn();
      const ownDoc = await dataExportSeed.document({ userId: owner.userId, title: "My own CV", rawText: "mine" });

      const otherIds: string[] = [];
      for (const [userId, marker] of [
        [await dataExportUsers.bare(), OTHER_USER_MARKER],
        [(await dataExportUsers.guest()).userId, GUEST_MARKER],
      ] as const) {
        const cv = await dataExportSeed.document({
          userId,
          kind: "CV",
          title: `${marker} CV`,
          rawText: marker,
          fileData: Buffer.from(`%PDF-1.4 ${marker}`),
          fileMime: MIME.pdf,
        });
        const jd = await dataExportSeed.document({ userId, kind: "JD", title: `${marker} JD`, rawText: marker });
        const cred = await dataExportSeed.credential({ userId, label: marker });
        const match = await dataExportSeed.matchResult({ userId, cvDocumentId: cv, jdDocumentId: jd });
        otherIds.push(cv, jd, cred, match);
      }

      const res = await apiAs(owner).me.export();
      expect(res.status).toBe(200);
      const archive = dataExportArchive(res.raw);
      const manifest = archive.manifest();

      expect(manifest.documents.map((d) => d.id)).toEqual([ownDoc]);
      expect(manifest.matchResults).toEqual([]);
      expect(manifest.aiCredentials).toEqual([]);
      expect(archive.documentEntries).toEqual([]);
      const decompressed = archive.decompressedText();
      for (const needle of [OTHER_USER_MARKER, GUEST_MARKER, ...otherIds]) {
        expect(decompressed, `archive contains ${needle}`).not.toContain(needle);
      }
      // The scan is not vacuous: the owner's own id is in the same text.
      expect(decompressed).toContain(ownDoc);
    }
  );
});
