# Home Dashboard + Document Library — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **FE structure note:** client đã migrate **layer-first** — design.md nhắc `features/` là khái niệm; path THẬT: `src/requests/` (API fn + query-key), `src/hooks/` (React Query), `src/views/<View>/` (index + mains/ + components/), `src/stores/slices/`, `src/types/<Domain>/`, `src/constants/`, `src/libs/api.ts`. Đọc `client/.claude/CLAUDE.md` + rules trước khi code FE. Đọc `server/.claude/CLAUDE.md` nếu có trước khi code BE.

**Goal:** Thêm app shell + sidebar, trang Home dashboard (thống kê + CTA match nổi bật), thư viện quản lý CV/JD đã lưu (preview file gốc bằng react-pdf/docx-preview, rename/download/delete), và đổi step 3 Review sang render file gốc read-only — responsive multi-device.

**Architecture:** BE lưu binary file gốc trong Postgres `bytea`, stream per-user qua 1 endpoint; FE render client-side bằng `react-pdf` (PDF) + `docx-preview` (DOCX), không iframe/không dịch vụ ngoài (PII). App shell qua pathless layout route dùng chung Home/Library/Wizard.

**Tech Stack:** BE NestJS 11 + Prisma 6 + Postgres. FE TanStack Start (React 19 + Vite) + Ant Design 5 + Tailwind 4 + TanStack Query 5 + Zustand + i18next; thêm `react-pdf` + `docx-preview`.

## Global Constraints

- **Per-user vô điều kiện**: mọi query Document/MatchResult filter theo `CurrentUserService.getUserId()` (BE). KHÔNG tin id từ client.
- **KHÔNG expose binary trong JSON**: `DocumentDto`/`DocumentSummaryDto` KHÔNG chứa `fileData`; binary chỉ qua `GET /documents/:id/file`.
- **i18n**: mọi string mới qua i18next 2 locale (`en` + `vi`) — 1 namespace `translation` (flat file `client/src/locales/{en,vi}/translation.json`); thêm nhánh `home.*`, `nav.*`, `library.*`, `preview.*`. BE message qua `tDoc`/`tMatch` (`server/src/i18n/{en,vi}/*.json`).
- **Responsive multi-device**: mọi màn chạy tốt mobile `375` / tablet `768` / desktop `1280`; Sider collapse drawer/icon ở màn nhỏ; không horizontal-scroll body. Tailwind `md:`/`lg:` inline (theo pattern hiện có).
- **Preview client-only**: `react-pdf` + `docx-preview` chỉ chạy browser → component preview phải guard SSR (dynamic import / `typeof window`).
- **Ports**: server `:5200`, client `:5300`. **Package manager**: yarn.
- **Commit review gate**: user opt-out ("merge luôn") → commit per-task tự động; merge gate opt-out (squash-merge + xóa branch + pull).
- **Green checks** trước PR: BE `yarn lint && yarn build && yarn test:e2e`; FE `yarn format && yarn lint && yarn type-check && yarn test && yarn build`.

---

## PART A — server (BE)

> Files gốc: `server/src/modules/documents/{documents.controller,documents.service}.ts`, `dto/*`, `parsing.ts`, `i18n-messages.ts`; `server/src/modules/matching/{matching.controller,matching.service}.ts`, `dto/*`; `server/prisma/schema.prisma`. Tests: `server/test/*.e2e-spec.ts` (Jest + supertest, DB live).

### Task A1: Schema `fileData`/`fileMime` + lưu binary khi upload

**Files:**
- Modify: `server/prisma/schema.prisma` (model `Document`)
- Create: `server/prisma/migrations/<ts>_add_document_file/migration.sql`
- Modify: `server/src/modules/documents/documents.service.ts` (`create`), `server/src/modules/documents/parsing.ts` (export mime helper nếu cần)
- Test: `server/test/documents.e2e-spec.ts` (extend)

**Interfaces:**
- Produces: `Document` có `fileData Bytes?`, `fileMime String?`. `DocumentsService.create` lưu `fileData=file.buffer`, `fileMime=file.mimetype` khi có file; null khi paste.

- [ ] **Step 1: Thêm cột schema**

Trong `schema.prisma` model `Document`, sau `parsedContent Json?`:
```prisma
  fileData      Bytes?
  fileMime      String?
```

- [ ] **Step 2: Migration**

Run: `cd server && npx prisma migrate dev --name add_document_file`
Expected: migration tạo cột `fileData bytea`, `fileMime text` nullable; `prisma generate` chạy.

- [ ] **Step 3: Test failing — create upload lưu fileMime**

Trong `documents.e2e-spec.ts` thêm: upload 1 PDF nhỏ (fixture buffer) với `save=false` → 201; sau đó query DB (`prisma.document.findUnique`) assert `fileMime === 'application/pdf'` và `fileData != null`. Paste text → `fileData == null`.
Run: `yarn test:e2e documents` → FAIL (service chưa lưu).

- [ ] **Step 4: Implement — lưu binary trong `create`**

Trong `documents.service.ts` `create`, block `if (file)` thêm capture mime; ở `prisma.document.create` data thêm:
```ts
        fileData: file ? file.buffer : null,
        fileMime: file ? file.mimetype : null,
```
(giữ nguyên phần parse rawText).

- [ ] **Step 5: Test PASS**

Run: `yarn test:e2e documents` → PASS.

- [ ] **Step 6: Commit** — `feat(documents): store original file binary (fileData/fileMime)`

### Task A2: `GET /documents/:id/file` — stream per-user

**Files:**
- Modify: `server/src/modules/documents/documents.controller.ts`, `documents.service.ts`, `i18n-messages.ts` keys, `server/src/i18n/{en,vi}/documents.json`
- Test: `server/test/documents.e2e-spec.ts`

**Interfaces:**
- Produces: `DocumentsService.getFile(id): Promise<{ buffer: Buffer; mime: string; filename: string }>` — per-user; throw `NotFoundException` nếu không thuộc user hoặc `fileData==null` (text). Controller trả `StreamableFile` với `Content-Type` + `Content-Disposition` (`inline` mặc định, `attachment` khi `?download=1`).

- [ ] **Step 1: Test failing**

`documents.e2e-spec.ts`: upload PDF (save=true, title 'CV1') → lấy id. `GET /documents/:id/file` → 200, header `content-type: application/pdf`, body bytes = fixture. `?download=1` → header `content-disposition` chứa `attachment`. Doc của user khác (tạo doc user2 trực tiếp qua prisma) → 404. Paste-text doc → 404 (`noOriginalFile`).
Run: `yarn test:e2e documents` → FAIL (route 404 tất cả).

- [ ] **Step 2: Service `getFile`**

`documents.service.ts`:
```ts
  async getFile(id: string): Promise<{ buffer: Buffer; mime: string; filename: string }> {
    const userId = this.currentUser.getUserId();
    const doc = await this.prisma.document.findFirst({ where: { id, userId } });
    if (!doc || !doc.fileData || !doc.fileMime) {
      throw new NotFoundException(
        tDoc("documents.errors.noOriginalFile", "No original file for this document.")
      );
    }
    const ext = doc.fileMime.includes("pdf") ? "pdf" : "docx";
    const safeTitle = doc.title.replace(/[^\w.-]+/g, "_").slice(0, 100) || "document";
    return { buffer: Buffer.from(doc.fileData), mime: doc.fileMime, filename: `${safeTitle}.${ext}` };
  }
```

- [ ] **Step 3: Controller endpoint**

`documents.controller.ts` thêm import `Res`, `StreamableFile`, `Query` (có sẵn), `Header`; thêm:
```ts
  @Get(":id/file")
  async file(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query("download") download: string | undefined,
    @Res({ passthrough: true }) res: import("express").Response
  ): Promise<StreamableFile> {
    const { buffer, mime, filename } = await this.documentsService.getFile(id);
    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      `${download === "1" ? "attachment" : "inline"}; filename="${filename}"`
    );
    return new StreamableFile(buffer);
  }
```
(`:id/file` phải khai báo TRƯỚC hoặc route riêng — NestJS phân biệt `:id` vs `:id/file` ổn; đảm bảo đặt cạnh `findOne`.)

- [ ] **Step 4: i18n key** — thêm `documents.errors.noOriginalFile` vào `server/src/i18n/en/documents.json` ("No original file for this document.") + `vi` ("Tài liệu này không có file gốc.").

- [ ] **Step 5: Test PASS** — `yarn test:e2e documents`.

- [ ] **Step 6: Commit** — `feat(documents): stream original file per-user (inline/download)`

### Task A3: `PATCH /documents/:id` — rename

**Files:** Modify `documents.controller.ts`, `documents.service.ts`; Create `dto/update-document.dto.ts`; i18n; Test extend.

**Interfaces:**
- Produces: `DocumentsService.rename(id, dto): Promise<DocumentDto>` per-user (404 nếu không thuộc user). `UpdateDocumentDto { title: string }` (`@IsString @MaxLength(200)`, trim non-empty).

- [ ] **Step 1: Test failing** — upload doc → `PATCH /documents/:id {title:'New'}` → 200, body `title==='New'`. title rỗng → 400. title 201 ký tự → 400. doc user khác → 404. FAIL trước.
- [ ] **Step 2: DTO** `dto/update-document.dto.ts`:
```ts
import { IsString, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";
export class UpdateDocumentDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString() @MinLength(1) @MaxLength(200)
  title!: string;
}
```
- [ ] **Step 3: Service `rename`**:
```ts
  async rename(id: string, dto: UpdateDocumentDto): Promise<DocumentDto> {
    const userId = this.currentUser.getUserId();
    const doc = await this.prisma.document.findFirst({ where: { id, userId } });
    if (!doc) throw new NotFoundException(tDoc("documents.errors.notFound", "Document not found."));
    const updated = await this.prisma.document.update({ where: { id }, data: { title: dto.title } });
    return DocumentDto.fromEntity(updated);
  }
```
- [ ] **Step 4: Controller** `@Patch(":id")` → `rename`. Import `Patch`.
- [ ] **Step 5: Test PASS.**
- [ ] **Step 6: Commit** — `feat(documents): rename document (PATCH)`

### Task A4: `DELETE /documents/:id` — 409 nếu còn trong match

**Files:** Modify controller/service; i18n (`inUseByMatch`); Test extend.

**Interfaces:**
- Produces: `DocumentsService.remove(id): Promise<void>` per-user (404); nếu tồn tại `MatchResult` ref (`cvDocumentId==id || jdDocumentId==id`) → `ConflictException` (409). Controller `@Delete(":id") @HttpCode(204)`.

- [ ] **Step 1: Test failing** — upload doc chưa match → `DELETE` → 204 + `findUnique` null. Doc đang dùng trong 1 match (tạo match qua prisma) → `DELETE` → 409 (`inUseByMatch`) + doc còn. Doc user khác → 404.
- [ ] **Step 2: Service `remove`**:
```ts
  async remove(id: string): Promise<void> {
    const userId = this.currentUser.getUserId();
    const doc = await this.prisma.document.findFirst({ where: { id, userId } });
    if (!doc) throw new NotFoundException(tDoc("documents.errors.notFound", "Document not found."));
    const refCount = await this.prisma.matchResult.count({
      where: { userId, OR: [{ cvDocumentId: id }, { jdDocumentId: id }] }
    });
    if (refCount > 0) throw new ConflictException(
      tDoc("documents.errors.inUseByMatch", "Cannot delete: used in a match history.")
    );
    await this.prisma.document.delete({ where: { id } });
  }
```
- [ ] **Step 3: Controller** `@Delete(":id") @HttpCode(HttpStatus.NO_CONTENT)`. Import `Delete, HttpCode, HttpStatus, ConflictException`.
- [ ] **Step 4: i18n** `documents.errors.inUseByMatch` (en/vi).
- [ ] **Step 5: Test PASS.**
- [ ] **Step 6: Commit** — `feat(documents): delete document, block when used by a match (409)`

### Task A5: `GET /match` — list history per-user

**Files:** Modify `matching.controller.ts`, `matching.service.ts`; Create `dto/match-summary.dto.ts`; Test `server/test/matching.e2e-spec.ts`.

**Interfaces:**
- Produces: `MatchingService.list(): Promise<MatchSummaryDto[]>` per-user, newest-first, join title CV/JD. `MatchSummaryDto { id, cvTitle, jdTitle, overallScore, createdAt }`.

- [ ] **Step 1: Test failing** — tạo 2 match qua flow (mock AiService) hoặc prisma trực tiếp với 2 doc. `GET /match` → 200, length 2, newest-first, mỗi item có `cvTitle/jdTitle` (không có report/scores chi tiết ngoài overallScore). Match user khác không lọt. FAIL trước.
- [ ] **Step 2: DTO** `dto/match-summary.dto.ts`:
```ts
import { ApiProperty } from "@nestjs/swagger";
export class MatchSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() cvTitle!: string;
  @ApiProperty() jdTitle!: string;
  @ApiProperty() overallScore!: number;
  @ApiProperty() createdAt!: string;
  static fromEntity(e: {
    id: string; overallScore: number; createdAt: Date;
    cvDocument: { title: string }; jdDocument: { title: string };
  }): MatchSummaryDto {
    const dto = new MatchSummaryDto();
    dto.id = e.id; dto.cvTitle = e.cvDocument.title; dto.jdTitle = e.jdDocument.title;
    dto.overallScore = e.overallScore; dto.createdAt = e.createdAt.toISOString();
    return dto;
  }
}
```
- [ ] **Step 3: Service `list`**:
```ts
  async list(): Promise<MatchSummaryDto[]> {
    const userId = this.currentUser.getUserId();
    const rows = await this.prisma.matchResult.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { cvDocument: { select: { title: true } }, jdDocument: { select: { title: true } } }
    });
    return rows.map((r) => MatchSummaryDto.fromEntity(r));
  }
```
- [ ] **Step 4: Controller** — thêm `@Get()` (list) TRƯỚC `@Get(":id")`:
```ts
  @Get()
  @ApiOkResponse({ type: [MatchSummaryDto] })
  async list(): Promise<MatchSummaryDto[]> { return this.matchingService.list(); }
```
- [ ] **Step 5: Test PASS.**
- [ ] **Step 6: Commit** — `feat(matching): list match history per-user (GET /match)`

### Task A6: BE green checks
- [ ] Run `cd server && yarn lint && yarn build && yarn test:e2e` → xanh hết. Fix nếu fail.

---

## PART B — client: app shell + Home dashboard

> Đọc `client/.claude/CLAUDE.md` + rules (`views`, `requests`, `hooks`, `imports`, `jsx`, `locales`). Component: arrow fn + `export default`, props inline, alias `#/`, `import type`.

### Task B1: Endpoints + requests + hooks + types (documents manage + match list)

**Files:**
- Modify: `client/src/constants/endpoints.ts`
- Modify: `client/src/requests/documents.ts`, `client/src/requests/match.ts`
- Modify: `client/src/hooks/useDocuments.ts`, `client/src/hooks/useMatch.ts`, `client/src/hooks/index.ts`
- Modify: `client/src/types/Matching/index.ts` (add `MatchSummaryDto`)
- Test: `client/src/hooks/__tests__/useDocuments.test.ts`, `useMatch.test.ts` (extend)

**Interfaces:**
- Produces (requests):
  - `documentFileUrl(id, download?)` → string (full URL cho `<a download>`/react-pdf).
  - `renameDocument(id, title): Promise<DocumentDto>` (PATCH).
  - `deleteDocument(id): Promise<void>` (DELETE, 204).
  - `fetchDocumentFile(id): Promise<ArrayBuffer>` (GET file → arrayBuffer, cho preview).
  - `fetchMatchHistory(): Promise<MatchSummaryDto[]>` + `matchHistoryQueryKey()`.
- Produces (hooks): `useRenameDocument()`, `useDeleteDocument()`, `useMatchHistory()`.

- [ ] **Step 1: endpoints** — `client/src/constants/endpoints.ts` thêm:
```ts
  documentFile: (id: string, download?: boolean) =>
    `/documents/${id}/file${download ? "?download=1" : ""}`,
  matchHistory: "/match",
```
- [ ] **Step 2: types** — `client/src/types/Matching/index.ts` thêm:
```ts
export interface MatchSummaryDto {
  id: string; cvTitle: string; jdTitle: string; overallScore: number; createdAt: string;
}
```
- [ ] **Step 3: requests test failing** — mock `apiFetch`; assert `renameDocument` gọi PATCH đúng path + JSON body; `deleteDocument` gọi DELETE; `fetchMatchHistory` GET `/match`. FAIL trước (chưa export).
- [ ] **Step 4: requests impl** — `client/src/requests/documents.ts` thêm (dùng `apiFetch`, `ENDPOINTS`, base URL cho file):
```ts
export function documentFileUrl(id: string, download = false): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:5200/api/v1";
  return `${base}${ENDPOINTS.documentFile(id, download)}`;
}
export function renameDocument(id: string, title: string): Promise<DocumentDto> {
  return apiFetch<DocumentDto>(ENDPOINTS.documentById(id), {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title })
  });
}
export function deleteDocument(id: string): Promise<void> {
  return apiFetch<void>(ENDPOINTS.documentById(id), { method: "DELETE" });
}
export async function fetchDocumentFile(id: string): Promise<ArrayBuffer> {
  const res = await fetch(documentFileUrl(id), { credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, `Failed to load file (${res.status})`);
  return res.arrayBuffer();
}
```
(import `ApiError` từ `#/libs/api`.) `match.ts` thêm:
```ts
export function matchHistoryQueryKey(): readonly ["match", "history"] { return ["match", "history"] as const; }
export function fetchMatchHistory(): Promise<Array<MatchSummaryDto>> {
  return apiFetch<Array<MatchSummaryDto>>(ENDPOINTS.matchHistory);
}
```
- [ ] **Step 5: hooks impl** — `useDocuments.ts` thêm `useRenameDocument` (mutation `renameDocument`, onSuccess invalidate `savedDocumentsQueryKey(kind)` — cần kind: invalidate cả CV+JD hoặc trả kind từ data → invalidate `["documents"]` prefix), `useDeleteDocument` (tương tự invalidate `["documents"]`). `useMatch.ts` thêm `useMatchHistory()` = `useQuery({ queryKey: matchHistoryQueryKey(), queryFn: fetchMatchHistory })`. Barrel `hooks/index.ts` export thêm.
- [ ] **Step 6: hooks test PASS** — `cd client && yarn test`.
- [ ] **Step 7: Commit** — `feat(client): requests+hooks for document manage & match history`

### Task B2: App shell + sidebar (pathless layout route, responsive)

**Files:**
- Create: `client/src/routes/_app.tsx` (pathless layout route), `client/src/views/AppShell/index.tsx` + `components/Sidebar/index.tsx`
- Modify: `client/src/routes/index.tsx`, `client/src/routes/wizard.tsx` → nằm dưới `_app` (đổi path thành `_app/`... theo TanStack file-based: dùng `_app.tsx` + `_app/index.tsx`, `_app/cv.tsx` ...). Regenerate routes.
- Modify: `client/src/locales/{en,vi}/translation.json` (thêm `nav.*`)
- Test: `client/src/views/AppShell/__tests__/Sidebar.test.tsx`

**Interfaces:**
- Produces: layout với `<Sidebar>` + `<Outlet>`; nav items Home `/`, Match `/wizard` (nổi bật), Saved CVs `/cv`, Saved JDs `/jd`. Responsive: `>=lg` Sider cố định `w-64`; `<lg` antd `Drawer` mở bằng hamburger trong header.

- [ ] **Step 1: routing** — Chuyển sang layout route. Tạo `routes/_app.tsx`:
```tsx
import { createFileRoute, Outlet } from "@tanstack/react-router";
import AppShell from "#/views/AppShell";
export const Route = createFileRoute("/_app")({ component: () => <AppShell><Outlet /></AppShell> });
```
Đổi `routes/index.tsx` → `routes/_app/index.tsx` (component Home); `routes/wizard.tsx` → `routes/_app/wizard.tsx`. Run `yarn generate-routes`. (Giữ `__root.tsx` nguyên.)
- [ ] **Step 2: Sidebar test failing** — render `<Sidebar />` trong router test → có 4 nav link (`Home`,`Match`,`Saved CVs`,`Saved JDs`) role `link` accessible names (i18n en). FAIL trước.
- [ ] **Step 3: nav i18n** — thêm `nav: { home, match, savedCvs, savedJds }` (en + vi) vào translation.json.
- [ ] **Step 4: Sidebar impl** — `views/AppShell/components/Sidebar/index.tsx`: `<nav>` với `<Link>` (TanStack) + Lucide icons (`LayoutDashboard`, `Sparkles`, `FileUser`? → dùng `FileText`/`User` sẵn có trong lucide-react; Match item accent `text-primary`/`bg-primary/10` khi active). `activeProps` để active state. Icon-only + tooltip khi collapsed.
- [ ] **Step 5: AppShell impl** — `views/AppShell/index.tsx`: layout `flex h-screen`; `>=lg` render `<aside class="hidden lg:flex w-64 ...">` Sidebar; `<lg` header có hamburger mở antd `Drawer` chứa Sidebar; `<main class="flex-1 min-h-0 overflow-y-auto">{children}</main>`. Header hiển thị tên trang + (placeholder) locale toggle.
- [ ] **Step 6: test PASS + smoke** — `yarn test`; `yarn dev` mở `/` thấy sidebar; resize < lg thấy hamburger + drawer.
- [ ] **Step 7: Commit** — `feat(client): app shell + responsive sidebar nav`

### Task B3: Home dashboard view

**Files:**
- Modify: `client/src/views/Home/index.tsx` (thay placeholder) + `components/{HeroCta,StatCards,RecentMatches}/index.tsx`
- Modify: `client/src/locales/{en,vi}/translation.json` (`home.*`)
- Test: `client/src/views/Home/__tests__/Home.test.tsx`

**Interfaces:**
- Consumes: `useSavedDocuments('CV'|'JD')`, `useMatchHistory()`.
- Produces: Home = HeroCta (nút → `/wizard`) + 4 StatCards (CV count, JD count, match count, highest% + avg) + RecentMatches (5 mới nhất, tag màu band, click → `/wizard` mở result).

- [ ] **Step 1: home i18n** — `home: { hero.{title,subtitle,cta}, stat.{savedCvs,savedJds,totalMatches,highest,avg}, recent.{title,viewAll,empty,emptyCta}, cols.{cv,jd,score,date} }` (en+vi).
- [ ] **Step 2: Home test failing** — mock `useSavedDocuments`/`useMatchHistory` (spy trên `#/hooks/*`); render Home → thấy heading hero + 4 statistic + recent list rows; khi history rỗng → empty-state + CTA. Score band: overall 80 → tag "success", 60 → "warning", 40 → "error" (assert class/text). FAIL trước.
- [ ] **Step 3: StatCards impl** — antd `Card` + `Statistic`; counts từ `useSavedDocuments('CV').data?.length ?? 0` v.v.; match count = `history.length`; highest = `Math.max(...scores)`, avg = `round(mean)`; guard rỗng → `0`/`—`.
- [ ] **Step 4: HeroCta impl** — Card accent primary + `<Link to="/wizard">` antd `Button size=large` icon `Sparkles`.
- [ ] **Step 5: RecentMatches impl** — antd `List`/`Table` 5 dòng đầu; helper `scoreBand(n)` → `success|warning|error` (`>=75|>=50|<50`) render `Tag`; ngày `new Intl.DateTimeFormat(i18n.language).format(new Date(createdAt))`; row click → `navigate({ to: "/wizard" })` sau khi set store `matchId` + `step=4` (dùng `useWizardStore.getState()`); "Xem tất cả" khi `length>5`.
- [ ] **Step 6: test PASS + smoke** — `yarn test`; `yarn dev` `/`.
- [ ] **Step 7: Commit** — `feat(client): home dashboard (hero CTA + stats + recent matches)`

---

## PART C — client: Document Library + preview

### Task C1: Deps + DocumentPreview component (client-only)

**Files:**
- Modify: `client/package.json` (add `react-pdf`, `docx-preview`)
- Create: `client/src/components/DocumentPreview/index.tsx` (shared, no business logic) + sub `PdfPreview`, `DocxPreview`, `TextPreview`
- Test: `client/src/components/DocumentPreview/__tests__/DocumentPreview.test.tsx`

**Interfaces:**
- Produces: `<DocumentPreview docId={string} sourceFormat={SourceFormat} rawText={string} />` — chọn renderer theo `sourceFormat`: `pdf`→PdfPreview (react-pdf, fetch arrayBuffer qua `fetchDocumentFile`), `docx`→DocxPreview (`docx-preview` renderAsync vào container ref), `text`→TextPreview (render `rawText` `<pre>` format). SSR-guard: các renderer dùng `useEffect` + dynamic `import()` (react-pdf/docx-preview) — không import top-level (tránh SSR crash).

- [ ] **Step 1: add deps** — `cd client && yarn add react-pdf docx-preview`. Cấu hình pdf.js worker cho react-pdf (import `pdfjs` từ `react-pdf`, set `pdfjs.GlobalWorkerOptions.workerSrc` dùng bundled worker URL `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` — trong `useEffect`/client-only).
- [ ] **Step 2: test failing** — render `<DocumentPreview sourceFormat="text" rawText="hello" docId="x" />` → thấy "hello". Mock `fetchDocumentFile`. Với `sourceFormat="pdf"` → render vùng `data-testid="pdf-preview"` (mock react-pdf `Document`/`Page` bằng `vi.mock`). FAIL trước.
- [ ] **Step 3: TextPreview impl** — `<pre className="whitespace-pre-wrap ...">{rawText}</pre>`.
- [ ] **Step 4: PdfPreview impl** — client-only: `useState<ArrayBuffer|null>`, `useEffect` gọi `fetchDocumentFile(docId)`; dynamic import react-pdf; render `<Document file={{ data }}><Page pageNumber /></Document>`; state loading + error. Guard `typeof window === "undefined"` → null.
- [ ] **Step 5: DocxPreview impl** — client-only: `useRef<HTMLDivElement>`, `useEffect`: `fetchDocumentFile(docId)` → `const { renderAsync } = await import("docx-preview")` → `renderAsync(new Blob([buf]), ref.current)`; loading + error state.
- [ ] **Step 6: test PASS + build** — `yarn test && yarn build` (build phải qua với SSR guard).
- [ ] **Step 7: Commit** — `feat(client): DocumentPreview (react-pdf/docx-preview/text, SSR-safe)`

### Task C2: DocumentLibrary view (`/cv`, `/jd`)

**Files:**
- Create: `client/src/views/DocumentLibrary/index.tsx` + `components/{DocumentRow,PreviewModal,RenameModal}/index.tsx`
- Create routes: `client/src/routes/_app/cv.tsx`, `client/src/routes/_app/jd.tsx`
- Modify: `client/src/locales/{en,vi}/translation.json` (`library.*`, `preview.*`)
- Test: `client/src/views/DocumentLibrary/__tests__/DocumentLibrary.test.tsx`

**Interfaces:**
- Consumes: `useSavedDocuments(kind)`, `useRenameDocument`, `useDeleteDocument`, `documentFileUrl`, `<DocumentPreview>`.
- Produces: `<DocumentLibrary kind="CV"|"JD" />`. Route `/cv` → `kind="CV"`, `/jd` → `kind="JD"`.

- [ ] **Step 1: library i18n** — `library: { title.{cv,jd}, subtitle, empty.{cv,jd}, emptyCta, action.{preview,rename,download,delete}, delete.{confirm,inUse,success}, rename.{title,label,confirm,success} }`, `preview: { close, download, loading, error }` (en+vi).
- [ ] **Step 2: routes** — `routes/_app/cv.tsx`:
```tsx
import { createFileRoute } from "@tanstack/react-router";
import DocumentLibrary from "#/views/DocumentLibrary";
export const Route = createFileRoute("/_app/cv")({ component: () => <DocumentLibrary kind="CV" /> });
```
tương tự `jd.tsx` (`kind="JD"`). `yarn generate-routes`.
- [ ] **Step 3: test failing** — mock `useSavedDocuments` trả 2 doc → render 2 row với title + badge format + 4 action button (aria-label). Empty → empty-state. Click Delete → Popconfirm → `useDeleteDocument.mutate`. Delete lỗi 409 → hiển thị message `library.delete.inUse` (mock mutation reject `ApiError(409)`). Rename mở modal → confirm gọi mutate. Preview mở modal chứa `<DocumentPreview>`. FAIL trước.
- [ ] **Step 4: DocumentRow impl** — list-row pattern (`flex items-center gap-4 px-4 py-3 rounded-xl border`, no wrap): icon tile + badge (`format.pdf|docx|text`), middle `min-w-0 flex-1` title truncate + meta ngày (Intl), right `shrink-0` antd icon `Button` (Eye/Pencil/Download/Trash2 lucide) aria-label. Download = `<a href={documentFileUrl(id,true)}>`.
- [ ] **Step 5: PreviewModal impl** — antd `Modal`/`Drawer` (Drawer full trên mobile, Modal `width` lớn desktop) chứa `<DocumentPreview>`; header title + close; footer Download. a11y: focus trap của antd, Esc đóng.
- [ ] **Step 6: RenameModal impl** — antd `Modal` + `Input` (default title); confirm → `useRenameDocument.mutate({id,title})`; success message; optimistic optional.
- [ ] **Step 7: DocumentLibrary impl** — header title theo kind + subtitle count; `useSavedDocuments(kind)`; loading skeleton; error UI; empty-state (Lucide `SearchX` + CTA → `/wizard`); map rows; quản state modal preview/rename.
- [ ] **Step 8: test PASS + smoke** — `yarn test`; `yarn dev` `/cv`,`/jd`.
- [ ] **Step 9: Commit** — `feat(client): saved CV/JD library with preview/rename/download/delete`

---

## PART D — client: Review step render + reconcile E2E

### Task D1: StepReview → render file gốc read-only

**Files:**
- Rewrite: `client/src/views/Wizard/mains/StepReview/index.tsx`
- Test: update `client/src/views/Wizard/mains/StepReview/__tests__/*` (nếu có) hoặc `wizard` test

**Interfaces:**
- Consumes: `useDocument(jdDocId)`, `useDocument(cvDocId)`, `<DocumentPreview>`, `useRunMatch`, `useWizardStore`.
- Produces: StepReview = 2 pane read-only (`<DocumentPreview>` theo `sourceFormat` mỗi doc) + Back (`goBack`) + Run match (dùng thẳng `cvDocId`/`jdDocId` → `runMatch` → `setMatchId` → `goNext`). **Bỏ** `Input.TextArea` edit + `resolveDocId`/transient-doc logic + `useCreateDocument` import.

- [ ] **Step 1: test failing/updating** — StepReview test: mock `useDocument` trả doc (sourceFormat pdf) → render 2 `<DocumentPreview>` (mock component) không có textarea; Run match → `useRunMatch.mutateAsync({cvDocumentId:cvDocId, jdDocumentId:jdDocId})` (KHÔNG tạo transient doc) → setMatchId → goNext. missingDocs guard giữ. Cập nhật/loại ca "edit text → transient doc".
- [ ] **Step 2: rewrite StepReview** — layout `grid gap-6 lg:grid-cols-2` (mobile stack): mỗi pane Card header (title + badge format) + `<DocumentPreview docId sourceFormat rawText>`; action bar Back + primary "Run match" (Sparkles); loading khi `useDocument` fetch; `isSubmitting` khi match; error `err.matchFailed`/`err.matchUnavailable` (503).
- [ ] **Step 3: test PASS + build** — `yarn test && yarn build`.
- [ ] **Step 4: Commit** — `refactor(wizard): step 3 review renders original file (remove text edit)`

### Task D2: Reconcile E2E artifacts + expand `e2e.md`

**Files:** Create `docs/specs/home-dashboard-library/e2e.md`; add Playwright tests `client/e2e/home-dashboard-library/*.e2e.ts`; reconcile wizard e2e (bỏ ca edit-text review, thêm ca render).

- [ ] **Step 1: e2e.md** — expand từng scenario Scenario Matrix (design §8) thành case cụ thể (1 test/scenario applicable); đánh dấu `A only` cho mutation (delete/rename); ghi follow-up (pagination library) là gap có chủ đích.
- [ ] **Step 2: Playwright tests** — theo `e2e-scenario-coverage` + `standard` FE: home (stats/empty/recent/CTA), library (list/empty/preview/rename/download/delete + delete-409), review render, responsive 375/768/1280, i18n en+vi. Wizard review cũ: bỏ ca edit-text, thêm ca render.
- [ ] **Step 3: (gate riêng)** dual-gate §4.3 — cần server:5200 + client:5300 chạy → xem "E2E gate" bên dưới.
- [ ] **Step 4: Commit** — `test(home-dashboard-library): e2e scenarios (home/library/review/responsive/i18n)`

### Task D3: FE green checks
- [ ] `cd client && yarn format && yarn lint && yarn type-check && yarn test && yarn build` → xanh hết.

---

## E2E gate (dual-gate §4.3) — cần dev server

> Sau PART A–D code xong + unit/component xanh: chạy dual-gate. **Cần server :5200 + client :5300 chạy** → agent TỰ CHECK 1 lần; chưa chạy → hỏi user (self-run/user-run). Gate A `yarn test:e2e` (client) trên app thật; Gate B MCP walk Scenario Matrix (Playwright `browser_*`) auth context riêng. Mutation-heavy = gate B chỉ verify read/render. Fail ≥1 gate → systematic-debugging → `e2e-bugs.md` → fix → rerun (max 3 vòng).

## Post-code (trước PR)
- **§4.5 Security review** (BẮT BUỘC — feature đụng file upload/stream + input user): `/security-review` diff mỗi repo → `docs/specs/home-dashboard-library/security-report.md` (verdict). BLOCK → fix.
- **§4.6 CLAUDE.md drift audit**: server (endpoints mới) → `server/.claude/CLAUDE.md` nếu có; client (view/route/deps mới) → `client/.claude/CLAUDE.md`; docs. `.claude/techstack/frontend.md` thêm `react-pdf`/`docx-preview`.
- **§4.8 README sync**: `client/README.md` (route mới), `server/README.md` (endpoint mới) nếu cần.
- **§5 PR per-repo** (docs/server/client), squash-merge + xóa branch + pull (user opt "merge luôn").

## Self-Review

- **Spec coverage:** BE schema+stream+rename+delete+match-list (A1–A5) ↔ design §3; app shell+sidebar (B2) ↔ §4.1; Home dashboard (B3) ↔ §4.2; Library+preview (C1–C2) ↔ §4.3+§5; Review render (D1) ↔ §4.4; responsive (B2/C2/D1 + E2E F3) ↔ §1 multi-device; E2E (D2) ↔ §8 matrix. ✅
- **Type consistency:** `MatchSummaryDto` khớp BE (A5) ↔ FE type (B1). `DocumentPreview` props (docId/sourceFormat/rawText) dùng nhất quán C1→C2→D1. `documentFileUrl`/`fetchDocumentFile`/`renameDocument`/`deleteDocument` khớp requests→hooks→views. Endpoints `documentFile`/`matchHistory` khớp constants↔requests. ✅
- **Placeholder scan:** mọi task có path + code + test cụ thể; E2E/security/drift ghi rõ là gate riêng (không phải TODO ẩn). Pagination library = follow-up có chủ đích (không silent). ✅
