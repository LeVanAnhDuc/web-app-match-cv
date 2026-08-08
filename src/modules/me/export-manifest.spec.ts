import { buildExportManifest, slugifyDocumentName } from "./export-manifest";

const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("slugifyDocumentName()", () => {
  it("[EP vietnamese] folds diacritics and lowercases", () => {
    expect(slugifyDocumentName("CV Nguyễn Văn A", "a1b2c3d4", PDF)).toBe(
      "cv-nguyen-van-a-a1b2c3.pdf"
    );
  });

  it("[EP extension] takes the extension from the mime type, not the title", () => {
    // The title claims .exe; the mime says docx. The mime wins.
    expect(slugifyDocumentName("payload.exe", "a1b2c3d4", DOCX)).toBe(
      "payload-exe-a1b2c3.docx"
    );
  });

  it("[security zip-slip] strips path separators and traversal", () => {
    const name = slugifyDocumentName("../../etc/passwd", "a1b2c3d4", PDF);
    expect(name).toBe("etc-passwd-a1b2c3.pdf");
    expect(name).not.toContain("/");
    expect(name).not.toContain("..");
  });

  it("[EP empty] falls back to a base name when the title slugs to nothing", () => {
    expect(slugifyDocumentName("!!! ???", "a1b2c3d4", PDF)).toBe(
      "document-a1b2c3.pdf"
    );
    expect(slugifyDocumentName("", "a1b2c3d4", PDF)).toBe(
      "document-a1b2c3.pdf"
    );
  });

  it("[EP collision] two titles that slug alike stay distinct via the id suffix", () => {
    const a = slugifyDocumentName("Resume.pdf", "aaaaaaaa", PDF);
    const b = slugifyDocumentName("resume!!.pdf", "bbbbbbbb", PDF);
    expect(a).not.toBe(b);
  });

  it("[BVA length] truncates a very long title so the entry name stays usable", () => {
    const name = slugifyDocumentName("x".repeat(500), "a1b2c3d4", PDF);
    expect(name.length).toBeLessThanOrEqual(75);
    expect(name.endsWith("-a1b2c3.pdf")).toBe(true);
  });

  it("[error guessing] a Windows-reserved base name is made safe by the id suffix", () => {
    // `CON` alone is unopenable on Windows; `con-a1b2c3` is fine.
    expect(slugifyDocumentName("CON", "a1b2c3d4", PDF)).toBe("con-a1b2c3.pdf");
  });

  it("[error guessing] unknown mime falls back to .bin", () => {
    expect(slugifyDocumentName("thing", "a1b2c3d4", null)).toBe(
      "thing-a1b2c3.bin"
    );
  });
});

describe("buildExportManifest()", () => {
  const exportedAt = new Date("2026-08-08T16:30:00.000Z");
  const user = {
    id: "u1",
    role: "candidate",
    createdAt: new Date("2026-01-01T00:00:00.000Z")
  };

  it("[security] never emits credential ciphertext, only the masked tail", () => {
    // `ExportInput`'s credential `Pick` no longer includes `encryptedKey` /
    // `keyIv` / `keyTag` at all (the caller's `aiCredential.findMany` never
    // selects them either — see `me.service.ts`), so this fixture cannot
    // even construct an input carrying ciphertext. That is the point: the
    // guard moved from "the mapper drops it" to "the type cannot hold it".
    // The exact-key-set assertion below is what still catches a future
    // field slipping into the exported shape.
    const manifest = buildExportManifest({
      user,
      documents: [],
      matchResults: [],
      aiCredentials: [
        {
          id: "c1",
          provider: "openai",
          label: "Key cá nhân",
          keyLast4: "4f2a",
          chatModel: null,
          embedModel: null,
          lastTestStatus: "ok",
          lastTestedAt: exportedAt,
          lastUsedAt: null,
          createdAt: exportedAt
        }
      ],
      exportedAt
    });

    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toContain("encryptedKey");
    expect(serialized).not.toContain("keyIv");
    expect(serialized).not.toContain("keyTag");
    expect(manifest.aiCredentials[0].keyLast4).toBe("4f2a");
    // The strongest guard available: an exact key allow-list. A spread, or a
    // new column mapped by accident, changes this set and fails here — which
    // substring checks cannot catch, because JSON.stringify encodes a Buffer
    // as {"type":"Buffer","data":[...]} rather than as its bytes.
    expect(Object.keys(manifest.aiCredentials[0]).sort()).toEqual(
      [
        "chatModel",
        "createdAt",
        "embedModel",
        "id",
        "keyLast4",
        "label",
        "lastTestStatus",
        "lastTestedAt",
        "lastUsedAt",
        "provider"
      ].sort()
    );
  });

  it("[EP paste-text] a document with hasFile: false gets file: null and no entry name", () => {
    const manifest = buildExportManifest({
      user,
      documents: [
        {
          id: "d1",
          kind: "CV",
          title: "Pasted CV",
          sourceFormat: "text",
          rawText: "hello",
          hasFile: false,
          fileMime: null,
          isSaved: true,
          createdAt: exportedAt
        }
      ],
      matchResults: [],
      aiCredentials: [],
      exportedAt
    });
    expect(manifest.documents[0].file).toBeNull();
  });

  it("[EP mismatched data] fileMime set but hasFile is false still yields file: null", () => {
    const manifest = buildExportManifest({
      user,
      documents: [
        {
          id: "d1",
          kind: "CV",
          title: "Broken",
          sourceFormat: "pdf",
          rawText: "x",
          hasFile: false,
          fileMime: PDF,
          isSaved: true,
          createdAt: exportedAt
        }
      ],
      matchResults: [],
      aiCredentials: [],
      exportedAt
    });
    expect(manifest.documents[0].file).toBeNull();
  });

  it("[EP has-file] hasFile: true yields the slugified entry path", () => {
    const manifest = buildExportManifest({
      user,
      documents: [
        {
          id: "a1b2c3d4",
          kind: "CV",
          title: "Real CV",
          sourceFormat: "pdf",
          rawText: "x",
          hasFile: true,
          fileMime: PDF,
          isSaved: true,
          createdAt: exportedAt
        }
      ],
      matchResults: [],
      aiCredentials: [],
      exportedAt
    });
    expect(manifest.documents[0].file).toBe("documents/real-cv-a1b2c3.pdf");
  });

  it("[error guessing] strips null bytes from rawText so the JSON stays valid", () => {
    const manifest = buildExportManifest({
      user,
      documents: [
        {
          id: "d1",
          kind: "CV",
          title: "Bad parse",
          sourceFormat: "pdf",
          rawText: "hel\u0000lo world",
          hasFile: false,
          fileMime: null,
          isSaved: true,
          createdAt: exportedAt
        }
      ],
      matchResults: [],
      aiCredentials: [],
      exportedAt
    });
    // The NUL is gone; the space is NOT — only control bytes are stripped.
    expect(manifest.documents[0].rawText).toBe("hello world");
    expect(() => {
      JSON.parse(JSON.stringify(manifest));
    }).not.toThrow();
  });

  it("[EP empty] an empty account still produces a valid manifest", () => {
    const manifest = buildExportManifest({
      user,
      documents: [],
      matchResults: [],
      aiCredentials: [],
      exportedAt
    });
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.documents).toEqual([]);
    expect(manifest.matchResults).toEqual([]);
    expect(manifest.aiCredentials).toEqual([]);
    expect(manifest.exportedAt).toBe("2026-08-08T16:30:00.000Z");
  });
});
