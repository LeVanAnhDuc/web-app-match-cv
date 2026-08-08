# Plan — `cv-rewrite-assistant` (Roadmap #6, Goal 7a)

> Input: `specs/cv-rewrite-assistant/design.md`. Viết bằng `superpowers:writing-plans`.
> Worktree: `docs|server|client/.worktrees/cv-rewrite-assistant`, branch `feat/cv-rewrite-assistant` (tách từ `origin/main`).
> Quy ước tên task: **BE** (`server/`) · **FE** (`client/`) · **DOC** (`docs/`).
> TDD: mỗi task có test **viết trước**, đỏ → code → xanh.

## Trạng thái

- [x] T1 · BE · migration `add_document_parent` + `DocumentDto.parentId`
- [x] T2 · BE · `grounding.ts` (hàm thuần) + `grounding.spec.ts`
- [x] T3 · BE · `AiService.generateCvRewrite` + spec
- [x] T4 · BE · module `cv-rewrite` (DTO + service + controller + i18n) + spec
- [x] T5 · BE · e2e `test/cv-rewrite.e2e-spec.ts`
- [x] T6 · FE · types + endpoints + requests + hooks
- [x] T7 · FE · view `CvRewrite` + route + i18n `en`/`vi`
- [x] T8 · FE · điểm vào: nút trên `MatchResultCard` + đường `matchId` ở `StepResult`
- [x] T9 · FE · unit test (Vitest) cho T7 + T8
- [x] T10 · FE · E2E suite `client/e2e/cv-rewrite-assistant/` + reconcile spec cũ
- [x] T11 · DOC · erd / project-goals / unfinished-features / e2e.md / README

---

## T1 · BE · Lineage `Document.parentId`

**File**: `prisma/schema.prisma`, `prisma/migrations/*_add_document_parent/`, `src/modules/documents/dto/document.dto.ts`

1. Thêm vào model `Document`:
   ```prisma
   parentId String?
   parent   Document?  @relation("DocumentLineage", fields: [parentId], references: [id], onDelete: SetNull)
   children Document[] @relation("DocumentLineage")

   @@index([parentId])
   ```
2. `npx prisma migrate dev --name add_document_parent` → `npx prisma generate`.
3. `DocumentDto` + `parentId: string | null` (`@ApiProperty({ nullable: true })`) + map trong `fromEntity`.
4. `seed.ts` **không đổi** (mọi document cũ là bản gốc → `null`).

**Verify**: `yarn type-check`; migration SQL chứa `ON DELETE SET NULL`; `documents.e2e-spec.ts` cũ vẫn xanh với field mới trong response.

## T2 · BE · `grounding.ts` — hàm thuần (test trước)

**File**: `src/modules/cv-rewrite/grounding.ts` + `grounding.spec.ts`

Constants (rule `constants.md`, module-local, có comment lý do):
`MIN_ANCHOR_CHARS = 12` · `MAX_CHANGES = 25` · `MAX_REPLACEMENT_CHARS = 1_500` · `REPLACEMENT_GROWTH_FACTOR = 4`.

API:
- `findAnchor(cvText, original): { start, end } | null` — chuẩn hoá whitespace 2 phía + bảng ánh xạ chỉ số ngược; `null` khi không thấy **hoặc** thấy >1 lần.
- `groundChanges(cvText, raw): CvRewriteChange[]` — loại theo §3 tầng 2, giữ thứ tự theo `start`, cắt `MAX_CHANGES`.
- `applyChanges(cvText, accepted): string` — resolve neo, sort giảm dần `start`, splice; ném khi neo hỏng/chồng lấn.

**Test trước (`grounding.spec.ts`)** — mỗi dòng bảng verify của `design.md` §3:
neo bịa → loại · neo trùng 2 lần → loại · neo 11 ký tự → loại, 12 → nhận **[BVA]** · chồng lấn → giữ 1 · `replacement` 4× → nhận, 4×+1 → loại, 1500 → nhận, 1501 → loại **[BVA]** · `replacement` rỗng (xoá) → **hợp lệ** · khác whitespace/xuống dòng vẫn khớp · `applyChanges` giữ nguyên đoạn không duyệt · 26 thay đổi → còn 25.

## T3 · BE · `AiService.generateCvRewrite`

**File**: `src/modules/ai/ai.service.ts` + `ai.service.spec.ts`

```ts
export interface RawCvRewriteChange {
  sectionHint?: string; original?: string; replacement?: string;
  rationale?: string; addressesGap?: string;
}
async generateCvRewrite(
  cvText: string, jdText: string, gaps: string[], suggestions: string[], cfg: AiRuntimeConfig
): Promise<{ changes: RawCvRewriteChange[]; unaddressedGaps: string[] }>
```

- Cùng khuôn `generateReport`: `withTimeout` → `chat.completions.create({ response_format: { type: "json_object" } })` → `catch → asProviderError` (**không log body lỗi provider**).
- Prompt đúng `design.md` §4.5 (system cấm bịa; `original` phải sao chép nguyên văn; gap không đóng được → `unaddressedGaps`).
- JSON không parse được / thiếu `changes` → `aiFailedError(model_unavailable)`.

**Test**: mock SDK — trả JSON hợp lệ → parse đúng; JSON hỏng → `AiProviderError(model_unavailable)`; 401 → `invalid_key`; timeout → `unreachable`.

## T4 · BE · Module `cv-rewrite`

**File**: `src/modules/cv-rewrite/{cv-rewrite.controller,cv-rewrite.service,cv-rewrite.module,i18n-messages}.ts`, `dto/*`, `src/i18n/{en,vi}/cvRewrite.json`, `src/app.module.ts`

DTO:
- `GenerateCvRewriteDto` — `matchResultId @IsUUID()`, `credentialId? @IsOptional() @IsUUID()`.
- `AcceptCvRewriteDto` — `matchResultId @IsUUID()`, `title @IsString() @Length(1,200)`, `changes @IsArray() @ArrayMinSize(1) @ArrayMaxSize(25) @ValidateNested({each}) @Type(() => AcceptedChangeDto)`; `AcceptedChangeDto` = `original @IsString() @Length(1,5000)` + `replacement @IsString() @Length(0,1500)`.
- `CvRewriteChangeDto`, `CvRewriteProposalDto` (output, `@ApiProperty` + `fromEntity`-style factory).

Service:
- `generate(dto)` — `matchResult.findFirst({ id, userId })` → 404; `status=failed` → 400 `matchFailed`; nạp cv/jd document; `runtime = dto.credentialId ? credentials.getRuntimeConfig(...) : ai.systemRuntimeConfig()`; `ai.generateCvRewrite(capForMatch(cv), capForMatch(jd), report.gaps, report.suggestions, runtime)`; `groundChanges(cvDoc.rawText, raw.changes)`; trả proposal (+ `provider`/`chatModel` từ `runtime`). `credentialId` có → `credentials.markUsed(...)` **ngoài** đường ghi (giống `matching.service`).
- `accept(dto)` — ownership như trên; **kiểm lại grounding từ đầu** trên `cvDoc.rawText`; `applyChanges` → text mới; rỗng/trắng → 400 `emptyResult`; `document.create({ kind: CV, sourceFormat: text, isSaved: true, parentId: cvDoc.id, rawText, fileData: null, fileMime: null, title })` → `DocumentDto.fromEntity`.

Controller: `@ApiTags("cv-rewrite")` `@Controller("cv-rewrite")`; `POST /` `@Throttle({ default: { limit: 10, ttl: 60_000 } })` + `@ApiCreatedResponse({ type: CvRewriteProposalDto })`; `POST /accept` + `@ApiCreatedResponse({ type: DocumentDto })`. Handler 1 dòng delegate.

i18n `cvRewrite.errors`: `matchNotFound` · `matchFailed` · `changeNotGrounded` · `emptyResult` (en + vi đồng bộ).

**Test (`cv-rewrite.service.spec.ts`)**: bảng verify `design.md` §3 phần service — ownership 404 · match `failed` → 400 · accept với neo bịa → 400 **và** `document.create` không được gọi · document mới đúng `parentId`/`kind`/`sourceFormat`/`fileData=null` · **không** có `document.update` nào lên CV gốc · không `credentialId` → `systemRuntimeConfig`.

## T5 · BE · e2e

**File**: `test/cv-rewrite.e2e-spec.ts` (mock SDK `openai`, không network)

Case: generate → accept → `GET /documents/:id` có `parentId` đúng · CV gốc đọc lại **không đổi** · `matchResultId` của user khác → 404 (**cover row 3 của matrix**) · accept neo bịa → 400 + không document mới · match `status=failed` → 400.

## T6 · FE · Tầng dữ liệu

**File**: `src/types/CvRewrite/index.ts`, `src/types/Documents/index.ts`, `src/constants/endpoints.ts`, `src/requests/cvRewrite.ts`, `src/hooks/useCvRewrite.ts`, `src/hooks/index.ts`

- Types theo bảng hợp đồng `design.md` §6; `DocumentDto` + `parentId: string | null`.
- `ENDPOINTS.cvRewrite = "/cv-rewrite"`, `ENDPOINTS.cvRewriteAccept = "/cv-rewrite/accept"`.
- `requests/cvRewrite.ts` — `generateCvRewrite(input)`, `acceptCvRewrite(input)` qua `apiFetch` (không query key: đề xuất không cache, là mutation).
- `hooks/useCvRewrite.ts` — `useGenerateCvRewrite()`, `useAcceptCvRewrite()` (`onSuccess` → `invalidateQueries(savedDocumentsQueryKey("CV"))`). Export qua barrel.

## T7 · FE · View `CvRewrite`

**File**: `src/routes/_app/cv-rewrite.$matchResultId.tsx`, `src/views/CvRewrite/index.tsx`, `mains/RewriteReview/index.tsx`, `components/{ChangeCard,RewriteRunWith,SaveRewriteModal}/index.tsx`, `src/locales/{en,vi}/translation.json`

- Route mỏng: `createFileRoute("/_app/cv-rewrite/$matchResultId")({ component })` → `yarn generate-routes`.
- `index.tsx` = `PageContainer` + tiêu đề + `<RewriteReview matchResultId={...} />` (chỉ import từ `mains/`).
- `RewriteReview`: `useMatchResult` + `useDocument` → panel Run-with + privacy + **Generate** → skeleton (`aria-busy`) → danh sách `ChangeCard` (`aria-live="polite"`, **0 tick mặc định**) + Select all + `Alert` `unaddressedGaps` + `Collapse` Preview result + footer Save.
- `ChangeCard`: `role="group"` + accessible name; eyebrow `sectionHint`; `original` đỏ nhạt gạch ngang, `replacement` xanh nhạt; `rationale` `text-muted`; `addressesGap` → `Tag`; `Checkbox` antd có nhãn liên kết.
- `RewriteRunWith`: `Select` 1 lựa chọn (`useAiCredentials` + `useProviders` + `TestStatusTag`), mặc định = `matchResult.credentialId` nếu còn tồn tại, không thì "System key"; privacy note dùng lại key `credentials.runWith.privacy*`.
- `SaveRewriteModal`: antd `Form` 1 ô tên, mặc định `"<tên CV gốc> (improved)"`, `Length 1..200`, submit disable khi pending.
- i18n: namespace mới `rewrite.*` trong `translation.json` **cả `en` và `vi`** (nhãn trang, Generate, Select all, Original/Suggested, unaddressedGaps + câu "cần kinh nghiệm thật", empty state, Save, lỗi `matchFailed`/`changeNotGrounded`/`emptyResult`, nút `action.improveCv`).

## T8 · FE · Điểm vào + sửa đường mở lại kết quả

**File**: `src/views/Wizard/components/MatchResultCard/index.tsx`, `src/views/Wizard/mains/StepResult/index.tsx`

- `MatchResultCard`: `SectionCard extra` = `Button` "Improve my CV" (`Wand2`), chỉ khi `result.status === "succeeded"`; `useNavigate({ to: "/cv-rewrite/$matchResultId", params: { matchResultId: result.id } })`.
- `StepResult`: thêm nhánh `runId == null && matchId != null` → `useMatchResult(matchId)` → **một** card `autoRun=false` `expanded` với `cvDocumentId`/`jdDocumentId` **lấy từ result**. Guard rỗng đổi thành `!runId && !matchId`. Đường live + đường reload run **không đổi**.

## T9 · FE · Unit test (Vitest)

`ChangeCard` (tick/untick, xoá-đoạn hiển thị đúng) · `RewriteReview` (0 tick mặc định, Select all, Save disabled khi 0 tick, Generate lần 2 xoá tick cũ) · `StepResult` (đường `matchId`) · `MatchResultCard` (nút chỉ hiện khi `succeeded`).

## T10 · FE · E2E

**File**: `client/e2e/cv-rewrite-assistant/{helpers,happy-path,grounding-and-validation,data-empty-and-i18n,error-and-mutation}.e2e.ts`

- `helpers.ts`: `CV_REWRITE_ROUTE = "**/api/v1/cv-rewrite"` + `CV_REWRITE_ACCEPT_ROUTE = "**/api/v1/cv-rewrite/accept"` (**glob**, không regex `$` — bài học của `multi-provider-compare`); stub proposal có tham số; helper đi từ wizard tới step 4 (dùng lại `multi-provider-compare/helpers`).
- Một test cho mỗi row ✅ ở matrix (`design.md` §7): 1, 4, 5, 6, 8, 9, 10, 11, 12.
- **Reconcile**: chạy **cả suite desktop**, sửa mọi spec cũ bị lệch vì (a) nút mới trên `MatchResultCard`, (b) đường `matchId` mới ở `StepResult`. Add / update / remove — không chỉ append.
- Chạy: `E2E_BASE_URL=http://localhost:5306 E2E_API_BASE=http://localhost:5206/api/v1 yarn test:e2e --project=desktop` trên cặp server `:5206` / client `:5306`.

## T11 · DOC

- `specs/cv-rewrite-assistant/e2e.md` — matrix cuối + kết quả gate A + **ghi rõ gate B (MCP walk) chưa chạy**.
- `specs/cv-rewrite-assistant/security-report.md` — findings + verdict (§4.5).
- `erd.md` · `project-goals.md` · `unfinished-features.md` · `server/README.md` theo `design.md` §9.

## Gate trước PR

`4.5` security review → `4.6` drift audit → **`4.7`**: `server/` `yarn format && yarn lint && yarn type-check && yarn test && yarn build` + `yarn test:e2e`; `client/` `yarn format && yarn lint && yarn type-check && yarn test && yarn build` → `4.8` README → **step 5** PR mỗi repo, base `main`, **KHÔNG merge**.
