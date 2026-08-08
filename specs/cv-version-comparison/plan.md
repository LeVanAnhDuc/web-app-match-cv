# Plan — `cv-version-comparison` (Roadmap #7, Goal 9)

> Input: `design.md` cùng thư mục. Viết bằng `superpowers:writing-plans`.
> Nhánh: `feat/cv-version-comparison` (worktree per-repo, tách từ `origin/main`).
> **Không có migration Prisma** — `Document.parentId` đã tồn tại từ Roadmap #6.
> Test-first ở mọi task có logic (`superpowers:test-driven-development`).

## Thứ tự & phụ thuộc

```
BE-1 gap-diff.ts (thuần)  ─┐
BE-2 lineage.ts  (thuần)  ─┼→ BE-4 ComparisonService ─→ BE-5 controller+module ─→ BE-6 BE e2e
BE-3 setParent + DTO      ─┘                                                    ↘
                                                                                 FE-1 types/requests/hooks
                                                                                 ↓
                                       FE-2 CvComparison view ─→ FE-3 entry points ─→ FE-4 FE unit
                                                                                     ↓
                                                                                   E2E-1
                                                                                     ↓
                                                            4.5 security → 4.6 drift → 4.7 green → 5 PR
```

---

## BE-1 — `gap-diff.ts` (hàm thuần) + spec

**File**: `server/src/modules/comparison/gap-diff.ts` · `gap-diff.spec.ts`

Viết **spec trước**. Export:

```ts
export const GAP_MATCH_THRESHOLD = 0.5;
export const MAX_GAPS_PER_SIDE = 50;
export interface GapPair { base: string; revision: string }
export interface GapDiff { closed: string[]; persisted: GapPair[]; introduced: string[] }
export function topicTokens(gap: string): Set<string>;
export function diffGaps(baseGaps: string[], revisionGaps: string[]): GapDiff;
```

- `topicTokens` = `tokenize(gap)` (import từ `../matching/tokenizer`) trừ `GAP_BOILERPLATE` (Set module-local, EN + VI đã gỡ dấu, có comment nêu **vì sao quy tắc ngược với `tokenizer.ts`** — design.md §3.3).
- `diffGaps`: cắt mỗi vế ở `MAX_GAPS_PER_SIDE`; similarity = overlap coefficient `|∩| / min(|A|,|B|)`; ghép **best-first toàn cục** (sort desc theo similarity, tie-break theo index base rồi index revision); fallback so chuỗi chuẩn hoá khi một vế có tập chủ đề rỗng; mỗi gap dùng tối đa 1 lần.

**Test (spec)** — mỗi case là một dòng của bảng design.md §3.6:
1. `["No CI/CD experience mentioned"]` × `["CI/CD exposure is still limited to a single tool"]` → 1 persisted, 0 closed, 0 introduced.
2. `["Missing AWS experience"]` × `["Missing Azure experience"]` → 1 closed + 1 introduced (**[EP]** — chứng minh boilerplate đã bị gỡ).
3. **[BVA]** ngưỡng: tập chủ đề `{a,b,c,d}` × `{a,b,e,f,g,h,i,j,k}` → overlap `2/4 = 0.5` → **ghép**; `{a,b,c,d,e}` × `{a,b,…}` với `|∩|=2`, `min=5` → `0.4` → **không ghép**.
4. Best-first: base `["React state management not shown"]` × revision `["React testing not covered","Redux state management missing"]` → persisted ghép với phần tử **thứ 2**, phần tử 1 là introduced.
5. Mỗi gap dùng 1 lần: 1 base × 2 revision cùng chủ đề → 1 persisted + 1 introduced.
6. Tiếng Việt: `["Thiếu kinh nghiệm Docker"]` × `["Chua co kinh nghiem Docker"]` → 1 persisted.
7. Alias: `["ReactJS not mentioned"]` × `["React.js exposure is thin"]` → 1 persisted.
8. Tập chủ đề rỗng: `["Missing relevant experience"]` × `["Missing relevant experience"]` → persisted; × `["Lacking required experience"]` → closed + introduced.
9. Rỗng: `[] × ["g"]` → 1 introduced; `["g"] × []` → 1 closed; `[] × []` → cả 3 rỗng.
10. `MAX_GAPS_PER_SIDE`: 60 phần tử → chỉ 50 được xét.

## BE-2 — `lineage.ts` (hàm thuần) + spec

**File**: `server/src/modules/comparison/lineage.ts` (+ test trong `lineage.spec.ts`)

```ts
export const MAX_LINEAGE_DEPTH = 20;
/** 1 = bản gốc. `parents` là map id → parentId đã nạp sẵn. */
export function resolveVersion(id: string, parents: Map<string, string | null>): number;
/** true khi `ancestorId` nằm trên chuỗi tổ tiên của `id` (kể cả chính nó). */
export function isAncestorOf(...): boolean;   // dùng cho chống vòng
```

**Test**: gốc → 1; chuỗi 3 đời → 3; parent không có trong map (chưa nạp) → dừng; vòng nhân tạo → dừng ở `MAX_LINEAGE_DEPTH`, không treo.

## BE-3 — `PATCH /documents/:id/parent`

**File**: `dto/set-document-parent.dto.ts` (MỚI) · `documents.service.ts` (+`setParent`) · `documents.controller.ts` · `dto/document-summary.dto.ts` (+`parentId`) · `i18n/{en,vi}/documents.json` (+4 key) · `documents.service.spec.ts` (MỚI)

- DTO: `@IsOptional() @IsUUID() @ValidateIf(o => o.parentId !== null) parentId: string | null` + `@ApiProperty({ nullable: true })`.
- `setParent(id, dto)`: 404 nếu doc không thuộc user; `null` → gỡ; self → 400 `lineageSelf`; parent không tồn tại/khác user → 400 `lineageParentNotFound`; `kind` khác → 400 `lineageKindMismatch`; vòng → 400 `lineageCycle` (nạp chuỗi tổ tiên bằng vòng lặp `findFirst`, cap `MAX_LINEAGE_DEPTH`).
- Controller: `@Patch(":id/parent")` + `ParseUUIDPipe` + `@ApiOkResponse({ type: DocumentDto })`.
- `DocumentSummaryDto.parentId` + `fromEntity`.

**Test** (`documents.service.spec.ts`): 7 case ở design.md §8.

## BE-4 — `ComparisonService` + DTO

**File**: `comparison.service.ts` · `comparison.service.spec.ts` · `dto/cv-comparison.dto.ts` · `dto/comparison-query.dto.ts` · `i18n-messages.ts` · `i18n/{en,vi}/comparison.json`

`compare(documentId, query)`:
1. `findFirst({ id, userId })` → 404 `comparison.errors.documentNotFound`.
2. `kind !== CV` → 400 `notCv`; `parentId === null` → 400 `noParent`.
3. Nạp parent (`findFirst({ id: parentId, userId })`); không thấy → 400 `noParent`.
4. `version` của cả hai qua `lineage.resolveVersion` (nạp chuỗi tổ tiên bằng vòng lặp có cap).
5. `matchResult.findMany({ where: { userId, cvDocumentId: { in: [base, revision] }, status: succeeded }, orderBy: { createdAt: "desc" }, include: { jdDocument: { select: { title: true } } } })` — **một** query cho cả hai vế.
6. `jdOptions` = gộp theo `jdDocumentId`, giữ thứ tự `createdAt` giảm dần, kèm `hasBase`/`hasRevision`.
7. Chọn `jdDocumentId`: query truyền → phải nằm trong `jdOptions`, không thì 400 `jdNotComparable`; không truyền → JD đầu tiên có đủ 2 bên, else JD đầu, else `null`.
8. `revisionResult` = row mới nhất của revision trên JD đó. `baseResult` = row mới nhất của base **cùng `chatModel`+`embedModel`** với revision, fallback row mới nhất.
9. Đủ 2 bên → `delta` (hiệu có dấu) + `gapDiff = diffGaps(base.gaps, revision.gaps)`; thiếu → cả hai `null`.
10. `sameChatModel` / `sameEmbedModel` — `true` khi thiếu một bên (không có gì để cảnh báo).

**Test**: 10 case ở design.md §8 (`comparison.service.spec.ts`), Prisma mock thuần object.

## BE-5 — Controller + module + đăng ký

**File**: `comparison.controller.ts` · `comparison.module.ts` · `app.module.ts`

`@ApiTags("comparisons") @Controller("comparisons")` · `@Get(":documentId")` + `ParseUUIDPipe` + `@Query() query: ComparisonQueryDto` + `@ApiOkResponse({ type: CvComparisonDto })`. Module **không** import `AiModule`.

## BE-6 — BE e2e

**File**: `server/test/comparison.e2e-spec.ts` · bổ sung `test/documents.e2e-spec.ts`

Seed 2 CV (v1 → v2) + 1 JD + 2 `MatchResult` → assert delta + gapDiff + `version`. `documentId` của user thứ hai → 404. `PATCH …/parent` tạo vòng → 400 và lineage giữ nguyên.

## FE-1 — types / constants / requests / hooks

**File**: `types/Comparison/index.ts` (MỚI) · `types/Documents/index.ts` (SỬA) · `constants/endpoints.ts` · `requests/comparison.ts` (MỚI) · `requests/documents.ts` · `hooks/useComparison.ts` (MỚI) · `hooks/useDocuments.ts` · `hooks/index.ts`

- `ENDPOINTS.comparison(id, jd?)` + `ENDPOINTS.documentParent(id)`.
- `comparisonQueryKey(documentId, jd)`; `fetchComparison`; `setDocumentParent`.
- `useComparison(documentId, jd)`; `useSetDocumentParent()` (invalidate `savedDocumentsQueryKey`).

## FE-2 — View `CvComparison`

**File**: `routes/_app/compare.$documentId.tsx` · `views/CvComparison/index.tsx` · `mains/ComparisonReport/index.tsx` · `components/ScoreDelta/index.tsx` · `components/GapDiffList/index.tsx` · `locales/{en,vi}/translation.json`

Route: `validateSearch` cho `{ jd?: string }`. Luồng đúng design.md §5.1 (9 bước). Sau khi thêm route → `yarn generate-routes`.

## FE-3 — Điểm vào

**File**: `views/DocumentLibrary/components/DocumentRow/` · `components/LineageModal/` (MỚI) · `mains/DocumentList/` · `views/Wizard/components/MatchResultCard/`

- Row: "Compare versions" (chỉ khi `parentId !== null`) + "Mark as version of…" (mọi hàng).
- `MatchResultCard`: nút compare chỉ khi `useDocument(result.cvDocumentId).data?.parentId` khác `null`, link kèm `?jd=<jdDocumentId>`.

## FE-4 — FE unit (Vitest)

6 file test theo design.md §8 phần "FE unit".

## E2E-1 — Playwright, gate A

**File**: `client/e2e/cv-version-comparison/{helpers,happy-path,validation-and-data,error-and-mutation}.e2e.ts`

Một test cho mỗi row ✅ của ma trận §7. Route interception toàn bộ (`**/api/v1/comparisons/*`, `**/api/v1/documents/*`). Chạy **cả suite desktop**; reconcile spec cũ nếu vỡ (ADD/UPDATE/REMOVE, không chỉ append). Ghi `e2e.md` kèm lý do **gate B không chạy**.

## 4.5 / 4.6 / 4.7 / 5

- **4.5** `/security-review` → `security-report.md`. Bề mặt cần rà: IDOR trên `:documentId` và trên `parentId` (body), vòng lineage, DoS qua `gap-diff` O(n·m), rò rỉ dữ liệu user khác qua `jdOptions`, XSS qua text gap.
- **4.6** drift audit: `docs/erd.md`, `docs/project-goals.md` (Roadmap #7, §6.6, §12, §13), `docs/unfinished-features.md`, `server/README.md`.
- **4.7** green checks **cả 2 repo**: `yarn format && yarn lint && yarn type-check && yarn test && yarn build`; server thêm `yarn test:e2e`.
- **5** PR per-repo (`docs`, `server`, `client`), base `main`, **không merge**.
