# Data Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho user tải về một file zip chứa toàn bộ dữ liệu của chính họ — `data.json` có cấu trúc + các file PDF/DOCX gốc đã upload.

**Architecture:** Module BE mới `src/modules/me/` với một endpoint `GET /me/export`. Phần dựng nội dung tách thành hàm **thuần** `buildExportManifest()` để test được bất biến bảo mật quan trọng nhất (ciphertext credential không bao giờ ra ngoài) mà không cần DB hay HTTP. Service đọc metadata trong **một transaction** rồi stream zip qua `archiver`. FE thêm route `/my-data` với một nút tải.

**Tech Stack:** NestJS 11 · Prisma 6 · **`archiver`** (dependency mới) · Jest · TanStack Start (React 19) · Ant Design + Tailwind · i18next · Vitest · Playwright

## Global Constraints

- **Ba bất biến bảo mật** (`design.md` §5), mỗi cái có test riêng:
  1. `encryptedKey` / `keyIv` / `keyTag` **KHÔNG BAO GIỜ** vào zip. Export chỉ được chứa `keyLast4`.
  2. Per-user isolation — mọi query scope theo `CurrentUserService.getUserId()`.
  3. Tên entry trong zip không được thoát khỏi `documents/`. Slug chỉ giữ `[a-z0-9-]`.
- **Tên file tải về do server sinh** (`export-<YYYY-MM-DD>.zip`), **không bao giờ** lấy từ dữ liệu user — đây là thứ chặn header injection ngay từ thiết kế.
- **Đuôi file lấy từ `fileMime`**, không từ tiêu đề user đặt.
- **Không đổi `prisma/schema.prisma`**, không tạo migration. Feature này chỉ đọc.
- **Import**: `server/` dùng **relative** (không có path alias); `client/` dùng alias **`#/`**. Nhầm chiều là lỗi.
- Chạy `npx prisma generate` **trước** `yarn lint` — thiếu bước này rule typed của ESLint sẽ gỡ nhầm type assertion thật.
- Worktree: `docs/`, `server/`, `client/` — đều ở `.worktrees/data-export`, branch `feat/data-export`.

## File Structure

| File | Trách nhiệm |
|---|---|
| `server/src/modules/me/export-manifest.ts` **(mới)** | Hàm thuần: `slugifyDocumentName()` + `buildExportManifest()`. Không I/O, không DI. |
| `server/src/modules/me/export-manifest.spec.ts` **(mới)** | Test bất biến bảo mật + đặt tên file. |
| `server/src/modules/me/me.service.ts` **(mới)** | Đọc DB trong transaction, dựng archive, trả stream. |
| `server/src/modules/me/me.controller.ts` **(mới)** | `GET /me/export`, set header, trả `StreamableFile`. |
| `server/src/modules/me/me.module.ts` **(mới)** | Wiring. |
| `server/src/modules/me/i18n-messages.ts` **(mới)** | `tMe(key, fallback)`. |
| `server/src/i18n/{en,vi}/me.json` **(mới)** | Message i18n. |
| `server/src/app.module.ts` **(sửa)** | Đăng ký `MeModule`. |
| `server/test/me.e2e-spec.ts` **(mới)** | Giải nén zip thật, kiểm isolation + toàn vẹn file. |
| `client/src/types/MyData/index.ts` **(mới)** | Kiểu cho response (chỉ blob + filename). |
| `client/src/constants/endpoints.ts` **(sửa)** | Thêm `meExport`. |
| `client/src/requests/myData.ts` **(mới)** | `downloadMyData()`. |
| `client/src/views/MyData/index.tsx` **(mới)** | Trang. |
| `client/src/routes/_app/my-data.tsx` **(mới)** | Route. |
| `client/src/views/AppShell/components/Sidebar/index.tsx` **(sửa)** | Thêm mục nav. |
| `client/src/locales/{en,vi}/translation.json` **(sửa)** | Chuỗi cho trang + nav. |
| `client/e2e/data-export/*.e2e.ts` **(mới)** | E2E theo Scenario Matrix. |

**Quyết định phân rã**: `export-manifest.ts` tách khỏi service vì nó là nơi bất biến bảo mật sống, và test nó không cần DB/HTTP — test quan trọng nhất của feature phải là test rẻ nhất để chạy.

---

### Task 1: `export-manifest.ts` — hàm thuần dựng nội dung

**Files:**
- Create: `server/src/modules/me/export-manifest.ts`
- Create: `server/src/modules/me/export-manifest.spec.ts`

**Interfaces:**
- Consumes: type `Document`, `MatchResult`, `AiCredential`, `User` từ `@prisma/client`
- Produces:
  - `export function slugifyDocumentName(title: string, id: string, fileMime: string | null): string`
  - `export interface ExportManifest`
  - `export function buildExportManifest(input: ExportInput): ExportManifest`
  - `export interface ExportInput { user; documents; matchResults; aiCredentials; exportedAt: Date }`

- [ ] **Step 1: Viết test thất bại**

Tạo `server/src/modules/me/export-manifest.spec.ts`:

```ts
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
    expect(slugifyDocumentName("CON", "a1b2c3d4", PDF)).toBe(
      "con-a1b2c3.pdf"
    );
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
          createdAt: exportedAt,
          encryptedKey: Buffer.from("SUPER_SECRET_CIPHERTEXT"),
          keyIv: Buffer.from("IV_BYTES"),
          keyTag: Buffer.from("TAG_BYTES")
        }
      ],
      exportedAt
    });

    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toContain("SUPER_SECRET_CIPHERTEXT");
    expect(serialized).not.toContain("IV_BYTES");
    expect(serialized).not.toContain("TAG_BYTES");
    expect(serialized).not.toContain("encryptedKey");
    expect(serialized).not.toContain("keyIv");
    expect(serialized).not.toContain("keyTag");
    expect(manifest.aiCredentials[0].keyLast4).toBe("4f2a");
  });

  it("[security] tolerates a legacy credential row with no keyLast4", () => {
    const manifest = buildExportManifest({
      user,
      documents: [],
      matchResults: [],
      aiCredentials: [
        {
          id: "c1",
          provider: "openai",
          label: "Legacy",
          keyLast4: null,
          chatModel: null,
          embedModel: null,
          lastTestStatus: null,
          lastTestedAt: null,
          lastUsedAt: null,
          createdAt: exportedAt,
          encryptedKey: Buffer.from("SECRET"),
          keyIv: Buffer.from("IV"),
          keyTag: Buffer.from("TAG")
        }
      ],
      exportedAt
    });
    expect(manifest.aiCredentials[0].keyLast4).toBeNull();
    expect(JSON.stringify(manifest)).not.toContain("SECRET");
  });

  it("[EP paste-text] a document with no fileData gets file: null and no entry name", () => {
    const manifest = buildExportManifest({
      user,
      documents: [
        {
          id: "d1",
          kind: "CV",
          title: "Pasted CV",
          sourceFormat: "text",
          rawText: "hello",
          parsedContent: null,
          fileData: null,
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

  it("[EP mismatched data] fileMime set but fileData missing still yields file: null", () => {
    const manifest = buildExportManifest({
      user,
      documents: [
        {
          id: "d1",
          kind: "CV",
          title: "Broken",
          sourceFormat: "pdf",
          rawText: "x",
          parsedContent: null,
          fileData: null,
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
          parsedContent: null,
          fileData: null,
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
    expect(() => JSON.parse(JSON.stringify(manifest))).not.toThrow();
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
```

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `cd server && yarn test export-manifest`
Expected: FAIL — `Cannot find module './export-manifest'`

- [ ] **Step 3: Viết implementation**

Tạo `server/src/modules/me/export-manifest.ts`:

```ts
import type {
  AiCredential,
  Document,
  MatchResult,
  User
} from "@prisma/client";

/** Bumped whenever the exported shape changes, so an old export stays parseable. */
const SCHEMA_VERSION = 1;
/** 6 hex chars off the uuid — enough to separate two documents sharing a title. */
const ID_SUFFIX_LENGTH = 6;
/** Keeps the whole entry name inside the 255-char per-component filesystem limit. */
const MAX_SLUG_LENGTH = 60;
const COMBINING_MARKS = /\p{M}/gu;
const D_STROKE = /đ/g;
const NON_SLUG_CHARS = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;
// NUL only. Written as an explicit escape so it is never mistaken for a
// space when this file is edited — stripping spaces from rawText would
// silently corrupt every exported document.
const NULL_BYTES = /\u0000/g;

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function extensionFor(fileMime: string | null): string {
  if (fileMime === PDF_MIME) return "pdf";
  if (fileMime === DOCX_MIME) return "docx";
  return "bin";
}

/**
 * Builds the zip entry name for a document's original upload.
 *
 * The title is user-controlled, so this is a security boundary, not a
 * cosmetic helper: everything outside [a-z0-9-] is dropped, which removes
 * path separators and `..` traversal in one step. The extension comes from
 * `fileMime` rather than the title, so a document called `payload.exe`
 * cannot dictate what the extracted file is called.
 *
 * The id suffix is not decoration either — it keeps two documents that slug
 * to the same string from overwriting each other in the archive, and it
 * incidentally defuses Windows-reserved names (`CON` becomes `con-a1b2c3`).
 */
export function slugifyDocumentName(
  title: string,
  id: string,
  fileMime: string | null
): string {
  const folded = title
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(D_STROKE, "d");
  const slug =
    folded
      .replace(NON_SLUG_CHARS, "-")
      .replace(EDGE_DASHES, "")
      .slice(0, MAX_SLUG_LENGTH)
      .replace(EDGE_DASHES, "") || "document";
  const suffix = id.replace(/-/g, "").slice(0, ID_SUFFIX_LENGTH);
  return `${slug}-${suffix}.${extensionFor(fileMime)}`;
}

export interface ExportedDocument {
  id: string;
  kind: string;
  title: string;
  sourceFormat: string;
  isSaved: boolean;
  createdAt: string;
  rawText: string;
  /** Path inside the archive, or null for paste-text documents. */
  file: string | null;
}

export interface ExportedMatchResult {
  id: string;
  cvDocumentId: string;
  jdDocumentId: string;
  overallScore: number;
  semanticScore: number;
  keywordScore: number;
  report: unknown;
  createdAt: string;
}

export interface ExportedAiCredential {
  id: string;
  provider: string;
  label: string;
  keyLast4: string | null;
  chatModel: string | null;
  embedModel: string | null;
  lastTestStatus: string | null;
  lastTestedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface ExportManifest {
  schemaVersion: number;
  exportedAt: string;
  user: { id: string; role: string; createdAt: string };
  documents: Array<ExportedDocument>;
  matchResults: Array<ExportedMatchResult>;
  aiCredentials: Array<ExportedAiCredential>;
}

export interface ExportInput {
  user: Pick<User, "id" | "role" | "createdAt">;
  documents: Array<Document>;
  matchResults: Array<MatchResult>;
  aiCredentials: Array<AiCredential>;
  exportedAt: Date;
}

const iso = (value: Date | null): string | null =>
  value === null ? null : value.toISOString();

/**
 * Maps entities to the exported shape. This function is the single place the
 * export decides what leaves the system, which is why it is pure and covered
 * by its own tests: `AiCredential.encryptedKey` / `keyIv` / `keyTag` must
 * never appear in the output, and a field-by-field mapping (rather than a
 * spread) is what guarantees that a column added later is not leaked by
 * default.
 */
export function buildExportManifest(input: ExportInput): ExportManifest {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: input.exportedAt.toISOString(),
    user: {
      id: input.user.id,
      role: String(input.user.role),
      createdAt: input.user.createdAt.toISOString()
    },
    documents: input.documents.map((doc) => ({
      id: doc.id,
      kind: String(doc.kind),
      title: doc.title,
      sourceFormat: String(doc.sourceFormat),
      isSaved: doc.isSaved,
      createdAt: doc.createdAt.toISOString(),
      rawText: doc.rawText.replace(NULL_BYTES, ""),
      file: doc.fileData
        ? `documents/${slugifyDocumentName(doc.title, doc.id, doc.fileMime)}`
        : null
    })),
    matchResults: input.matchResults.map((match) => ({
      id: match.id,
      cvDocumentId: match.cvDocumentId,
      jdDocumentId: match.jdDocumentId,
      overallScore: match.overallScore,
      semanticScore: match.semanticScore,
      keywordScore: match.keywordScore,
      report: match.report,
      createdAt: match.createdAt.toISOString()
    })),
    aiCredentials: input.aiCredentials.map((cred) => ({
      id: cred.id,
      provider: String(cred.provider),
      label: cred.label,
      keyLast4: cred.keyLast4 ?? null,
      chatModel: cred.chatModel ?? null,
      embedModel: cred.embedModel ?? null,
      lastTestStatus:
        cred.lastTestStatus === null ? null : String(cred.lastTestStatus),
      lastTestedAt: iso(cred.lastTestedAt),
      lastUsedAt: iso(cred.lastUsedAt),
      createdAt: cred.createdAt.toISOString()
    }))
  };
}
```

> **Nếu `MatchResult` trên `main` có thêm cột** (`provider`, `chatModel`, `embedModel`, `runId`, `status`, `errorCode` — do `ai-credentials` và `multi-provider-compare` thêm): bổ sung chúng vào `ExportedMatchResult` và phần map. Đọc `prisma/schema.prisma` để lấy danh sách thật thay vì đoán. **Không** chuyển sang spread — mapping từng field là thứ đảm bảo cột nhạy cảm thêm sau này không bị rò mặc định.

- [ ] **Step 4: Chạy test để xác nhận nó pass**

Run: `cd server && yarn test export-manifest`
Expected: PASS — 13 test xanh

- [ ] **Step 5: Format, lint, commit**

```bash
cd server
npx prisma generate
yarn format
yarn lint
git add src/modules/me/export-manifest.ts src/modules/me/export-manifest.spec.ts
git commit -m "feat(me): pure export manifest builder with security invariants"
```

---

### Task 2: Module `me` — service, controller, wiring

**Files:**
- Create: `server/src/modules/me/me.service.ts`
- Create: `server/src/modules/me/me.controller.ts`
- Create: `server/src/modules/me/me.module.ts`
- Create: `server/src/modules/me/i18n-messages.ts`
- Create: `server/src/i18n/en/me.json`, `server/src/i18n/vi/me.json`
- Modify: `server/src/app.module.ts`
- Modify: `server/package.json` (thêm `archiver` + `@types/archiver`)

**Interfaces:**
- Consumes: `buildExportManifest`, `slugifyDocumentName` từ Task 1
- Produces: `MeService.buildExportArchive(): Promise<{ stream: Readable; filename: string }>` — Task 3 (e2e) gọi endpoint chứ không gọi trực tiếp

- [ ] **Step 1: Cài dependency**

```bash
cd server
yarn add archiver
yarn add -D @types/archiver
```

- [ ] **Step 2: Tạo message i18n**

`server/src/i18n/en/me.json`:

```json
{
  "errors": {
    "exportFailed": "Could not build your data export."
  }
}
```

`server/src/i18n/vi/me.json`:

```json
{
  "errors": {
    "exportFailed": "Không tạo được bản sao dữ liệu của bạn."
  }
}
```

`server/src/modules/me/i18n-messages.ts`:

```ts
import { I18nContext } from "nestjs-i18n";

/**
 * Translate a `me.*` i18n key for the current request language, falling back
 * to the given English string when no I18nContext is bound.
 */
export function tMe(key: string, fallback: string): string {
  return I18nContext.current()?.t(key as never) ?? fallback;
}
```

- [ ] **Step 3: Viết service**

`server/src/modules/me/me.service.ts`:

```ts
import { Injectable, InternalServerErrorException } from "@nestjs/common";
import archiver from "archiver";
import { PassThrough, type Readable } from "stream";
import { CurrentUserService } from "../../common/current-user/current-user.service";
import { PrismaService } from "../../prisma/prisma.service";
import { buildExportManifest, slugifyDocumentName } from "./export-manifest";
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
   * Metadata is read inside one transaction so `data.json` and the files
   * beside it describe the same instant — without it, a document uploaded
   * mid-stream could appear in one and not the other.
   */
  async buildExportArchive(): Promise<{
    stream: Readable;
    archive: archiver.Archiver;
    filename: string;
  }> {
    const userId = this.currentUser.getUserId();
    const exportedAt = new Date();

    const [user, documents, matchResults, aiCredentials] =
      await this.prisma.$transaction([
        this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
        this.prisma.document.findMany({
          where: { userId },
          orderBy: { createdAt: "asc" }
        }),
        this.prisma.matchResult.findMany({
          where: { userId },
          orderBy: { createdAt: "asc" }
        }),
        this.prisma.aiCredential.findMany({
          where: { userId },
          orderBy: { createdAt: "asc" }
        })
      ]);

    const manifest = buildExportManifest({
      user,
      documents,
      matchResults,
      aiCredentials,
      exportedAt
    });

    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = new PassThrough();

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

    for (const doc of documents) {
      if (!doc.fileData) continue;
      archive.append(Buffer.from(doc.fileData), {
        name: `documents/${slugifyDocumentName(doc.title, doc.id, doc.fileMime)}`
      });
    }

    void archive.finalize().catch((err: unknown) => {
      stream.destroy(err instanceof Error ? err : new Error(String(err)));
    });

    const day = exportedAt.toISOString().slice(0, 10);
    return { stream, archive, filename: `export-${day}.zip` };
  }
}
```

> Note cho người implement: `InternalServerErrorException` và `tMe` được import sẵn cho bước xử lý lỗi ở controller. Nếu sau khi viết xong mà file không dùng tới chúng, **xoá import thừa** — ESLint sẽ báo.

- [ ] **Step 4: Viết controller**

`server/src/modules/me/me.controller.ts`:

```ts
import { Controller, Get, Res, StreamableFile } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { MeService } from "./me.service";

@ApiTags("me")
@Controller("me")
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get("export")
  @ApiOkResponse({
    description:
      "A zip archive containing data.json plus the user's original uploads.",
    content: { "application/zip": {} }
  })
  async export(
    @Res({ passthrough: true }) res: import("express").Response
  ): Promise<StreamableFile> {
    const { stream, archive, filename } =
      await this.meService.buildExportArchive();
    // If the user cancels the download, stop building the archive instead of
    // finishing it into a socket nobody is reading.
    res.on("close", () => {
      if (!res.writableFinished) archive.abort();
    });
    // The filename is server-generated and contains only [a-z0-9-.], so it
    // cannot inject header content. Never build it from user data.
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return new StreamableFile(stream);
  }
}
```

- [ ] **Step 5: Wiring**

`server/src/modules/me/me.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { MeController } from "./me.controller";
import { MeService } from "./me.service";

@Module({
  controllers: [MeController],
  providers: [MeService]
})
export class MeModule {}
```

Trong `server/src/app.module.ts`: thêm `import { MeModule } from "./modules/me/me.module";` cùng nhóm import module khác, và thêm `MeModule` vào mảng `imports` ngay sau `MatchingModule`.

- [ ] **Step 6: Kiểm tra thủ công**

```bash
cd server
npx prisma generate
yarn build
yarn start:dev
```

Ở terminal khác: `curl -sD - -o /tmp/export.zip http://localhost:5200/api/v1/me/export | head -5`

Expected: `HTTP/1.1 200`, `Content-Type: application/zip`, `Content-Disposition: attachment; filename="export-<hôm-nay>.zip"`. Rồi `unzip -l /tmp/export.zip` phải liệt kê `data.json`.

- [ ] **Step 7: Format, lint, commit**

```bash
cd server
yarn format
yarn lint
yarn type-check
git add src/modules/me package.json yarn.lock src/app.module.ts src/i18n/en/me.json src/i18n/vi/me.json
git commit -m "feat(me): stream a zip export of the current user's data"
```

---

### Task 3: BE e2e — giải nén thật, kiểm isolation và toàn vẹn

**Files:**
- Create: `server/test/me.e2e-spec.ts`

**Interfaces:**
- Consumes: endpoint `GET /me/export` từ Task 2
- Produces: (không có ký hiệu code)

Đọc `server/test/documents.e2e-spec.ts` trước để theo đúng cách nó dựng app, seed DB và dọn dẹp — **theo pattern có sẵn**, đừng phát minh cách mới.

- [ ] **Step 1: Viết test**

Tạo `server/test/me.e2e-spec.ts` theo khung dưới. Phần `beforeAll`/`afterAll` copy pattern từ `documents.e2e-spec.ts` (dựng `Test.createTestingModule`, `ValidationPipe`, `PrismaService`, dọn bảng).

```ts
// Extract the archive in-memory so the assertions read the real bytes the
// endpoint produced, not a re-serialisation of them.
import AdmZip from "adm-zip";

// ... app bootstrap copied from documents.e2e-spec.ts ...

describe("GET /me/export (e2e)", () => {
  it("returns a zip containing data.json and one entry per uploaded file", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4 fake pdf bytes");
    await prisma.document.create({
      data: {
        userId: STUB_USER_ID,
        kind: "CV",
        title: "CV Nguyễn Văn A",
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

    const zip = new AdmZip(res.body as Buffer);
    const names = zip.getEntries().map((e) => e.entryName);
    expect(names).toContain("data.json");

    const fileEntry = names.find((n) => n.startsWith("documents/"));
    expect(fileEntry).toBeDefined();
    // Byte-identical, compared as bytes — not by length.
    expect(zip.getEntry(fileEntry!)!.getData().equals(pdfBytes)).toBe(true);
  });

  it("never leaks credential ciphertext into the archive", async () => {
    await prisma.aiCredential.create({
      data: {
        userId: STUB_USER_ID,
        provider: "openai",
        label: "Key cá nhân",
        encryptedKey: Buffer.from("SUPER_SECRET_CIPHERTEXT"),
        keyIv: Buffer.from("IV_BYTES"),
        keyTag: Buffer.from("TAG_BYTES"),
        keyLast4: "4f2a"
      }
    });

    const res = await request(app.getHttpServer())
      .get("/api/v1/me/export")
      .buffer()
      .parse(binaryParser)
      .expect(200);

    // Scan the WHOLE archive, not just data.json — a leak could land anywhere.
    const raw = (res.body as Buffer).toString("latin1");
    expect(raw).not.toContain("SUPER_SECRET_CIPHERTEXT");
    expect(raw).not.toContain("encryptedKey");

    const zip = new AdmZip(res.body as Buffer);
    const manifest = JSON.parse(
      zip.getEntry("data.json")!.getData().toString("utf8")
    ) as { aiCredentials: Array<{ keyLast4: string }> };
    expect(manifest.aiCredentials[0].keyLast4).toBe("4f2a");
  });

  it("excludes another user's documents", async () => {
    const other = await prisma.user.create({
      data: { role: "candidate" }
    });
    await prisma.document.create({
      data: {
        userId: other.id,
        kind: "CV",
        title: "OTHER USER SECRET CV",
        sourceFormat: "text",
        rawText: "OTHER_USER_MARKER",
        isSaved: true
      }
    });

    const res = await request(app.getHttpServer())
      .get("/api/v1/me/export")
      .buffer()
      .parse(binaryParser)
      .expect(200);

    expect((res.body as Buffer).toString("latin1")).not.toContain(
      "OTHER_USER_MARKER"
    );
  });

  it("returns a valid empty archive when the account has no data", async () => {
    // Table cleanup in beforeEach leaves the account empty.
    const res = await request(app.getHttpServer())
      .get("/api/v1/me/export")
      .buffer()
      .parse(binaryParser)
      .expect(200);

    const zip = new AdmZip(res.body as Buffer);
    const manifest = JSON.parse(
      zip.getEntry("data.json")!.getData().toString("utf8")
    ) as { documents: Array<unknown>; schemaVersion: number };
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.documents).toEqual([]);
    expect(zip.getEntries().map((e) => e.entryName)).toEqual(["data.json"]);
  });

  it("rejects a wrong method with 404", async () => {
    await request(app.getHttpServer()).post("/api/v1/me/export").expect(404);
  });

  it("ignores a Range header rather than serving a truncated archive", async () => {
    // The zip is a non-seekable stream. Serving a partial body with 200 would
    // hand the client a broken archive that looks like a complete download.
    const res = await request(app.getHttpServer())
      .get("/api/v1/me/export")
      .set("Range", "bytes=0-100")
      .buffer()
      .parse(binaryParser);

    expect([200, 416]).toContain(res.status);
    if (res.status === 200) {
      // Full body: it must still open as a zip.
      expect(() => new AdmZip(res.body as Buffer).getEntries()).not.toThrow();
    }
  });
});
```

`binaryParser` đã tồn tại ở `test/documents.e2e-spec.ts` — copy định nghĩa của nó sang file này (nó là hàm cục bộ, không export).

- [ ] **Step 2: Cài `adm-zip` cho test**

```bash
cd server
yarn add -D adm-zip @types/adm-zip
```

- [ ] **Step 3: Chạy e2e**

Run: `cd server && yarn test:e2e --testPathPatterns me`
Expected: 5 test xanh. Cần Postgres đang chạy (`DATABASE_URL` trong `.env`).

- [ ] **Step 4: Commit**

```bash
cd server
yarn format && yarn lint
git add test/me.e2e-spec.ts package.json yarn.lock
git commit -m "test(me): e2e for export contents, isolation and integrity"
```

---

### Task 4: FE — request layer + hằng số endpoint

**Files:**
- Modify: `client/src/constants/endpoints.ts`
- Create: `client/src/requests/myData.ts`

**Interfaces:**
- Consumes: endpoint `GET /me/export` từ Task 2
- Produces: `export async function downloadMyData(): Promise<void>` — Task 5 gọi

- [ ] **Step 1: Thêm endpoint**

Trong `client/src/constants/endpoints.ts`, thêm vào object `ENDPOINTS`:

```ts
  meExport: "/me/export",
```

- [ ] **Step 2: Viết request**

Tạo `client/src/requests/myData.ts`:

```ts
import { ENDPOINTS } from "#/constants";
import { apiFetchBinary } from "#/libs/api";

/** Filename the browser saves the archive as, when the server sends none. */
const FALLBACK_FILENAME = "export.zip";

/**
 * Downloads the current user's data archive and hands it to the browser.
 *
 * The bytes go through fetch rather than a plain anchor so the caller can
 * show a loading state and surface a real error — an anchor navigation
 * gives neither. The trade-off is that the archive is held in memory once;
 * acceptable because it is bounded by the user's own uploads.
 */
export async function downloadMyData(): Promise<void> {
  const buffer = await apiFetchBinary(ENDPOINTS.meExport);
  const blob = new Blob([buffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = FALLBACK_FILENAME;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Always release the object URL, even if the click throws — otherwise the
    // blob stays pinned in memory for the lifetime of the document.
    URL.revokeObjectURL(url);
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd client
yarn format && yarn lint
git add src/constants/endpoints.ts src/requests/myData.ts
git commit -m "feat(client): request layer for the data export download"
```

---

### Task 5: FE — trang `/my-data`, route, sidebar, i18n

**Files:**
- Create: `client/src/views/MyData/index.tsx`
- Create: `client/src/routes/_app/my-data.tsx`
- Modify: `client/src/views/AppShell/components/Sidebar/index.tsx`
- Modify: `client/src/locales/en/translation.json`, `client/src/locales/vi/translation.json`

**Interfaces:**
- Consumes: `downloadMyData()` từ Task 4
- Produces: route `/my-data`

Đọc `client/.claude/CLAUDE.md` + rule `views`, `jsx`, `locales` trước khi viết. Theo đúng cấu trúc của `client/src/views/AiCredentials/` — nó là view mới nhất và gần nhất về hình dạng.

- [ ] **Step 1: Thêm chuỗi i18n**

`client/src/locales/en/translation.json` — thêm `nav.myData` và khối `myData`:

```json
  "nav": { "myData": "My data" },
  "myData": {
    "title": "My data",
    "description": "Download a copy of everything this app stores about you.",
    "contents": {
      "heading": "The archive contains",
      "documents": "Your CV and job description files, exactly as you uploaded them, plus the text extracted from them",
      "matches": "Every match you have run, with its scores and full report",
      "credentials": "Your AI credential settings — provider, label and the last four characters only, never the key itself"
    },
    "download": "Download my data",
    "downloading": "Preparing your archive…",
    "error": "Could not prepare your archive. Please try again.",
    "privacyNote": "The archive contains personal data. Store it somewhere safe."
  }
```

`client/src/locales/vi/translation.json` — bản tiếng Việt tương ứng:

```json
  "nav": { "myData": "Dữ liệu của tôi" },
  "myData": {
    "title": "Dữ liệu của tôi",
    "description": "Tải về bản sao mọi thứ ứng dụng đang lưu về bạn.",
    "contents": {
      "heading": "Bản sao gồm có",
      "documents": "Các file CV và mô tả công việc đúng như bạn đã tải lên, kèm phần văn bản đã trích xuất",
      "matches": "Mọi lần chấm độ khớp, kèm điểm số và báo cáo đầy đủ",
      "credentials": "Cấu hình khoá AI — nhà cung cấp, nhãn và bốn ký tự cuối, không bao giờ có khoá thật"
    },
    "download": "Tải dữ liệu của tôi",
    "downloading": "Đang chuẩn bị bản sao…",
    "error": "Không chuẩn bị được bản sao. Vui lòng thử lại.",
    "privacyNote": "Bản sao chứa dữ liệu cá nhân. Hãy lưu ở nơi an toàn."
  }
```

**Giữ hai file đồng bộ khoá** — thiếu khoá ở một bên là lỗi i18n sẽ lộ ra ở test dòng 9 của Scenario Matrix.

- [ ] **Step 2: Viết view**

Tạo `client/src/views/MyData/index.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Typography } from "antd";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { downloadMyData } from "#/requests/myData";

type Status = "idle" | "loading" | "done" | "error";

/**
 * Lets the user download an archive of everything the app stores about them.
 *
 * Deliberately plain: one action, no table, no filters. The description
 * spells out what the archive contains so nobody has to unzip it to find out.
 */
const MyData = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>("idle");
  // The download resolves after an await, by which point the user may have
  // navigated away — writing state then would warn and leak.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleDownload = async () => {
    setStatus("loading");
    try {
      await downloadMyData();
      if (mounted.current) setStatus("done");
    } catch {
      // The thrown ApiError carries a server message, but it is not
      // translated — show our own copy instead of leaking English to a
      // Vietnamese user.
      if (mounted.current) setStatus("error");
    }
  };

  const items = [
    t("myData.contents.documents"),
    t("myData.contents.matches"),
    t("myData.contents.credentials")
  ];

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <Typography.Title level={2}>{t("myData.title")}</Typography.Title>
      <Typography.Paragraph type="secondary">
        {t("myData.description")}
      </Typography.Paragraph>

      <Card className="mb-6">
        <Typography.Text strong>
          {t("myData.contents.heading")}
        </Typography.Text>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-400">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>

      <Button
        type="primary"
        size="large"
        icon={<Download size={18} />}
        loading={status === "loading"}
        disabled={status === "loading"}
        aria-busy={status === "loading"}
        onClick={() => void handleDownload()}
      >
        {status === "loading" ? t("myData.downloading") : t("myData.download")}
      </Button>

      {/* One live region covers both outcomes — a screen reader user needs to
          hear that the download finished, not only that it started. */}
      <div aria-live="polite" className="mt-4">
        {status === "error" && (
          <Alert type="error" role="alert" message={t("myData.error")} />
        )}
        {status === "done" && (
          <Alert type="success" message={t("myData.done")} />
        )}
      </div>

      <Typography.Paragraph type="secondary" className="mt-6 text-sm">
        {t("myData.privacyNote")}
      </Typography.Paragraph>
    </div>
  );
};

export default MyData;
```

> Component này dùng thêm khoá `myData.done` — **nhớ thêm nó vào cả hai file locale** ở Step 1 (`"done": "Your archive has been downloaded."` / `"done": "Đã tải bản sao dữ liệu về máy."`). Thiếu ở một bên là lỗi i18n sẽ lộ ra ở dòng 9 của Scenario Matrix.
>
> Đọc `client/.claude/CLAUDE.md` + rule `views`, `jsx`, `locales` trước khi viết, và đối chiếu `client/src/views/AiCredentials/` — nó là view mới nhất, gần nhất về hình dạng. Nếu convention ở đó khác chỗ nào so với code trên (cách import antd, cách đặt class Tailwind), **theo convention của repo**, đừng theo code trong plan.

- [ ] **Step 3: Tạo route**

Tạo `client/src/routes/_app/my-data.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import MyData from "#/views/MyData";

export const Route = createFileRoute("/_app/my-data")({
  component: MyData
});
```

Rồi chạy `yarn generate-routes` để cập nhật `routeTree.gen.ts`.

- [ ] **Step 4: Thêm mục sidebar**

Trong `client/src/views/AppShell/components/Sidebar/index.tsx`, thêm vào cuối mảng `NAV_ITEMS`:

```ts
  { to: "/my-data", icon: Download, labelKey: "nav.myData" }
```

và thêm `Download` vào import từ `lucide-react`.

- [ ] **Step 5: Chạy check**

```bash
cd client
yarn generate-routes
yarn format && yarn lint && yarn type-check && yarn test && yarn build
```

Expected: tất cả xanh.

- [ ] **Step 6: Commit**

```bash
cd client
git add src/views/MyData src/routes src/views/AppShell src/locales
git commit -m "feat(client): my data page with export download"
```

---

### Task 6: E2E Playwright theo Scenario Matrix

**Files:**
- Create: `client/e2e/data-export/export.e2e.ts`

**Interfaces:**
- Consumes: route `/my-data` từ Task 5
- Produces: (không có ký hiệu code)

Đọc `client/e2e/home-dashboard-library/library.e2e.ts` trước để theo pattern seed DB và dựng context có sẵn.

- [ ] **Step 1: Viết test cho các dòng `A+B` và `A only` khả thi ở tầng browser**

Phủ các dòng sau của Scenario Matrix trong `design.md` §7:

| Dòng | Test |
|---|---|
| 1 | Bấm tải → Playwright bắt được sự kiện download, tên file khớp `export-\d{4}-\d{2}-\d{2}\.zip` |
| 8 | Trang hiện đủ 3 mục nội dung |
| 9 | Render đúng ở **cả `en` và `vi`** — assert bằng chuỗi lấy từ file locale, không hard-code |
| 10 | Mock route trả 500 → hiện `role="alert"`; nút bấm lại được |
| 11 | Bấm 2 lần liên tiếp → chỉ 1 request tới `/me/export` (đếm bằng `page.route`) |
| 12 | Nút tới được bằng `Tab`, kích hoạt bằng `Enter`; có accessible name |

Dòng 13 (rò rỉ) và 14 (toàn vẹn) **không** làm ở đây — chúng đã được BE e2e ở Task 3 phủ bằng cách soi bytes thật, chặt hơn nhiều so với qua browser. Ghi lý do này vào `e2e.md`.

- [ ] **Step 2: Chạy**

Run: `cd client && yarn test:e2e --grep data-export`
Expected: tất cả xanh. Cần server `:5200` và client `:5300` đang chạy.

- [ ] **Step 3: Viết `e2e.md`**

Tạo `docs/specs/data-export/e2e.md`: chép Scenario Matrix từ `design.md` §7, đánh dấu dòng nào đã có test, dòng nào cố ý bỏ và lý do (13/14 → BE e2e; 2/3/4/7 → N/A).

- [ ] **Step 4: Commit**

```bash
cd client && git add e2e/data-export && git commit -m "test(e2e): data export page scenarios"
cd ../docs && git add specs/data-export/e2e.md && git commit -m "docs(data-export): e2e scenario record"
```

---

### Task 7: Drift audit + green checks

**Files:**
- Modify: `.claude/techstack/backend.md`
- Modify: `server/.claude/CLAUDE.md`
- Modify: `client/.claude/CLAUDE.md`

- [ ] **Step 1: Cập nhật techstack**

Trong `.claude/techstack/backend.md`, thêm `archiver` (+ `adm-zip` ở devDependencies cho test) vào danh sách thư viện, kèm một dòng nói nó dùng để làm gì.

- [ ] **Step 2: Cập nhật convention doc BE**

Trong `server/.claude/CLAUDE.md`, mục **Architecture**, thêm `Me` vào danh sách feature module. Trong **Core Patterns**, thêm:

```markdown
- **Export dữ liệu**: `src/modules/me/export-manifest.ts` là nơi DUY NHẤT quyết định field nào rời khỏi hệ thống. Map từng field một, KHÔNG spread entity — cột nhạy cảm thêm sau này sẽ tự động không bị rò. `AiCredential.encryptedKey`/`keyIv`/`keyTag` không bao giờ được có mặt.
```

- [ ] **Step 3: Cập nhật convention doc FE**

Trong `client/.claude/CLAUDE.md`, thêm route `/my-data` vào chỗ liệt kê route.

- [ ] **Step 4: Green checks cả hai side**

```bash
cd server && npx prisma generate && yarn format && yarn lint && yarn type-check && yarn test && yarn build
cd ../client && yarn format && yarn lint && yarn type-check && yarn test && yarn build
```

Cả 11 lệnh phải thoát mã 0.

- [ ] **Step 5: Commit**

```bash
git -C .claude add techstack/backend.md && git -C .claude commit -m "docs(techstack): add archiver for data export"
cd server && git add .claude/CLAUDE.md && git commit -m "docs(server): document the me module and export invariant"
cd ../client && git add .claude/CLAUDE.md && git commit -m "docs(client): document the my-data route"
```

---

## Sau khi hoàn tất plan

1. **§4.5 Security review — BẮT BUỘC.** Feature này đóng gói toàn bộ PII của user rồi gửi ra ngoài. Soi: rò rỉ ciphertext credential, per-user isolation, zip-slip qua tên entry, header injection qua `Content-Disposition`, và hành vi khi stream lỗi sau khi header đã gửi. Lưu vào `docs/specs/data-export/security-report.md`.
2. **§4.3 E2E dual-gate** — gate A (`yarn test:e2e`) + gate B (MCP walk theo `e2e.md`).
3. **PR 3 repo**: `docs/`, `server/`, `client/` — cùng branch `feat/data-export`.

## Tiêu chí nghiệm thu

- [ ] `GET /me/export` trả zip mở được, chứa `data.json` + đúng 1 entry cho mỗi tài liệu có `fileData`
- [ ] Zip **không chứa** `encryptedKey` / `keyIv` / `keyTag` ở bất kỳ đâu — kiểm bằng quét chuỗi trên toàn bộ bytes
- [ ] Tài liệu của user khác **không** lọt vào zip
- [ ] File lấy ra byte-identical với bản đã upload
- [ ] Tài khoản rỗng vẫn nhận zip hợp lệ, không phải lỗi
- [ ] Tiêu đề `../../etc/passwd` cho ra entry nằm dưới `documents/`
- [ ] Trang `/my-data` render đúng ở cả `en` và `vi`, có loading + error state, bấm 2 lần chỉ gửi 1 request
