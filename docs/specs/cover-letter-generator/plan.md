# Plan — `cover-letter-generator` (Roadmap #8, Goal 7b)

> Từ `specs/cover-letter-generator/design.md`. Branch `feat/cover-letter-generator` trên cả 3 repo (`docs`, `server`, `client`).
> **Chạy song song với `feat/cv-rewrite-assistant`** — mọi task dưới đây **chỉ THÊM**, không refactor `AiService`, không đụng `Document`.
> Ports riêng để không đụng agent kia: server **5208**, client **5308**.

## Task 0 — [SETUP] worktree + môi trường ✅

- 3 worktree tách từ `origin/main` mới nhất, cùng tên branch.
- `.env` copy sang worktree (`Copy-Item`, không `cp`).
- `yarn install` cả `server/` + `client/`.

---

## Task 1 — [BE] Schema `CoverLetter` + migration

**File**: `prisma/schema.prisma`, `prisma/migrations/<ts>_add_cover_letter/`

1. Thêm 4 enum: `CoverLetterTone`, `CoverLetterLength`, `CoverLetterLanguage`, `CoverLetterStatus`.
2. Thêm model `CoverLetter` đúng shape design §5.1 (`String[]` cho `omittedRequirements`, `@@index([userId, matchResultId])`).
3. Relation ngược: `User.coverLetters`, `MatchResult.coverLetters`, `AiCredential.coverLetters`. **Không đụng `Document`.**
4. `npx prisma migrate dev --name add_cover_letter` + `npx prisma generate`.
5. `seed.ts` **không đổi** (xác nhận, không sửa).

**Verify**: migration chỉ chứa `CREATE TYPE` × 4 + `CREATE TABLE "CoverLetter"` + FK + index. **Không có `ALTER TABLE "Document"`** — grep để chắc.

---

## Task 2 — [BE] `AiService.generateCoverLetter()` (THÊM, không refactor)

**File**: `src/modules/ai/ai.service.ts`

- Thêm interface `CoverLetterDraft { body: string; omittedRequirements: string[] }`.
- Thêm method `generateCoverLetter(prompt: { system: string; user: string }, cfg: AiRuntimeConfig): Promise<CoverLetterDraft>` — dùng lại `withTimeout` / `asProviderError` / `aiFailedError` / `toStringArray` đang có; `response_format: { type: "json_object" }`.
- JSON hỏng → `aiFailedError(model_unavailable)` (đúng như `generateReport`). `body` không phải string → coi như hỏng.
- **KHÔNG** đổi chữ ký/vị trí của bất kỳ hàm nào đã có.

**Test** (`ai.service.spec.ts`, thêm describe mới): parse OK; `omittedRequirements` không phải mảng → `[]`; JSON hỏng → `model_unavailable`; 401 → `invalid_key`; content rỗng → `unreachable`.

---

## Task 3 — [BE] `prompt.ts` — grounding (ADR #13)

**File**: `src/modules/cover-letters/prompt.ts` + `prompt.spec.ts`

- `buildCoverLetterPrompt(input): { system, user }` — pure, không DI.
- Hằng có tên: `MAX_LETTER_SOURCE_CHARS = 20_000`, `WORD_TARGET = { short: "150-200", standard: "300-350" }`, nhãn `MUST NOT CLAIM`.
- system: JSON-only + nguyên tắc grounding (mọi khẳng định truy được về CV; JD chỉ nói nhà tuyển dụng cần gì).
- user: tone/length/language → `MATCHED STRENGTHS` → `MUST NOT CLAIM` (= `gaps`) → JD → CV → JSON shape.

**Test — đây là chỗ ADR #13 thành test đỏ khi ai đó gỡ ràng buộc ra**:
- mọi phần tử `gaps` xuất hiện sau nhãn `MUST NOT CLAIM`;
- mọi phần tử `strengths` xuất hiện;
- chuỗi chỉ thị grounding có mặt trong `system`;
- `language: "vi"` → chỉ thị tiếng Việt xuất hiện;
- `short` vs `standard` cho khoảng từ khác nhau;
- `cvText` dài 25_000 → prompt chứa đúng 20_000 ký tự đầu;
- `gaps` rỗng → không sinh section cấm rỗng vô nghĩa.

---

## Task 4 — [BE] DTO + i18n

**File**: `src/modules/cover-letters/dto/*`, `i18n-messages.ts`, `src/i18n/{en,vi}/coverLetters.json`

- `CreateCoverLetterDto` — `matchResultId @IsUUID()`, `tone/length/language @IsEnum`, `credentialId @IsOptional() @IsUUID()`.
- `UpdateCoverLetterDto` — `content @IsString() @Length(1, 20000)`.
- `ListCoverLettersQueryDto` — `matchResultId @IsUUID()` (bắt buộc).
- `CoverLetterDto` — `@ApiProperty` đủ field + `static fromEntity`. **Không** field credential nào ngoài `credentialId`.
- `tLetter(key, fallback)`; JSON `en` + `vi` đồng bộ: `errors.{matchNotFound,matchNotSucceeded,notFound,letterFailed}`.

---

## Task 5 — [BE] `CoverLettersService` + controller + module

**File**: `src/modules/cover-letters/*`, `src/app.module.ts`

- Service theo design §5.4: `generate` / `list` / `update` / `remove`, mọi query scope `userId`.
- Controller mỏng: `POST /` (+ `@Throttle({ default: { limit: 10, ttl: 60_000 } })`), `GET /`, `PATCH /:id`, `DELETE /:id` (`@HttpCode(204)`), `ParseUUIDPipe` cho `:id`, `@Api*Response`.
- `CoverLettersModule` import `AiModule`, `AiCredentialsModule`, `PrismaModule`, `CurrentUserModule`; đăng ký ở `AppModule` **sau** `AiCredentialsModule`.

**Test** (`cover-letters.service.spec.ts`): theo design §9 — ownership 404; match `failed` → 400; provider lỗi → row `failed` + `errorCode`, **không ném**; system vs user credential; `markUsed` chỉ khi có `credentialId`; PATCH set `edited`; PATCH lên `failed` → 400; DTO không rò credential.

---

## Task 6 — [BE] e2e spec

**File**: `test/cover-letters.e2e-spec.ts`

- Mock `openai` SDK (theo pattern `ai-credentials.e2e-spec.ts`).
- Vòng đời đầy đủ: seed document + match → generate → list → patch → delete.
- `matchResultId` của user khác → 404; `GET` với `matchResultId` người khác → `[]`; `id` của user khác → 404 (PATCH + DELETE).
- Match `failed` → 400.
- Assert `JSON.stringify(body)` **không chứa** key gốc.

---

## Task 7 — [FE] types + constants + requests + hooks

**File**: `src/types/CoverLetters/index.ts`, `src/constants/endpoints.ts`, `src/requests/coverLetters.ts`, `src/hooks/useCoverLetters.ts`, `src/hooks/index.ts`

- Types đúng bảng contract design §6; `errorCode` tái dùng `MatchErrorCode` từ `#/types/Matching`.
- `ENDPOINTS.coverLetters`, `ENDPOINTS.coverLettersByMatch(id)`, `ENDPOINTS.coverLetterById(id)`.
- `requests/coverLetters.ts`: `coverLettersQueryKey(matchResultId)` + 4 pure fn qua `apiFetch`.
- `hooks/useCoverLetters.ts`: `useCoverLetters(matchResultId)`, `useGenerateCoverLetter()`, `useUpdateCoverLetter()`, `useDeleteCoverLetter()` — invalidate query key sau mutation.

---

## Task 8 — [FE] `CoverLetterModal` + nút vào ở `MatchResultCard`

**File**: `src/views/Wizard/components/CoverLetterModal/index.tsx`, `.../MatchResultCard/index.tsx`, `src/locales/{en,vi}/translation.json`

- Modal 3 vùng theo design §6. `Segmented` cho tone/length/language; `Select` credential mặc định `result.credentialId`; thông báo quyền riêng tư nêu tên provider.
- Vùng nháp: `Input.TextArea` + Copy / Tải .txt / Lưu / Sinh lại; khối `omittedRequirements` (ẩn khi rỗng).
- Danh sách bản đã sinh: click nạp, xoá từng bản, bản `failed` hiện `errorCode` đã dịch.
- `mutateAsync` + `try/catch` (**không** callback trong `mutate`).
- Nút ở `MatchResultCard` chỉ khi `result.status === "succeeded"`.
- i18n `coverLetter.*` đủ `en` + `vi`, kể cả 5 `errorCode` (dùng lại `result.error.*`).
- A11y: focus đầu modal, `Esc` đóng, `aria-busy` khi sinh, `aria-live="polite"`, label liên kết.

**Test (Vitest)**: theo design §9 FE unit.

---

## Task 9 — [E2E] Playwright — expand Scenario Matrix

**File**: `client/e2e/cover-letter-generator/{helpers,happy-path,validation-and-boundary,data-and-empty,error-and-loading,mutation-and-a11y,i18n}.e2e.ts`

Một test cho mỗi row ✅ của design §8:

| Row | Test |
|---|---|
| 1 | `happy-path` — nút → modal → generate → 1 dòng lịch sử → generate bản 2 → 2 dòng, chuyển qua lại giữ nội dung → copy |
| 4 | `validation-and-boundary` — `[EP]` content rỗng/whitespace/quá dài chặn client; `[DT]` match failed + credential người khác → 400 của match thắng, không row nào tạo |
| 5 | `data-and-empty` — empty state; `omittedRequirements` rỗng → khối ẩn; bản failed không vẽ thành thư trắng |
| 6 | `validation-and-boundary` — `[BVA]` content `0/1/20_000/20_001`; số bản `0/1/2` |
| 8 | `data-and-empty` — nhãn người đọc, plain text (`**bold**` nguyên văn), không rò key |
| 9 | `i18n` — en + vi mọi nhãn; **ngôn ngữ UI ≠ ngôn ngữ lá thư** |
| 10 | `error-and-loading` — `failed` + `no_quota`; `GET` 500; `PATCH` 500 giữ text; loading |
| 11 | `mutation-and-a11y` — `[ST]` sinh → sửa+lưu → sinh mới → xoá; invalid transition xoá bản đang mở; double-submit → 1 POST; cleanup `afterAll` |
| 12 | `mutation-and-a11y` — focus, Esc, tab order, `aria-busy` |

**Gate A** — chạy **toàn bộ** project `desktop`:
```
server: PORT=5208 CLIENT_ORIGIN=http://localhost:5308 node dist/src/main.js
client: VITE_API_BASE_URL=http://localhost:5208/api/v1 yarn dev --port 5308
test:   E2E_BASE_URL=http://localhost:5308 E2E_API_BASE=http://localhost:5208/api/v1 yarn test:e2e --project=desktop
```
Reconcile bất kỳ spec cũ nào bị vỡ. **Gate B (MCP walk) không chạy** — ghi lý do vào `e2e.md`.

Cleanup tôn trọng thứ tự FK: `CoverLetter` → `MatchResult` → `MatchRun` → `Document`.

---

## Task 10 — [DOCS] 4.5 / 4.6 / 4.7 / 4.8

- `security-report.md` — `/security-review` trên diff, findings + verdict.
- Drift audit: `docs/erd.md` (+ `CoverLetter`), `docs/project-goals.md` (§6.4, §12 xoá open question, Roadmap #8), `server/README.md` (4 endpoint + hợp đồng D4). `server/.claude/CLAUDE.md` + `client/.claude/CLAUDE.md` — kiểm tra có drift không (module list / commands).
- Green checks **cả 2 repo**: `yarn format && yarn lint && yarn type-check && yarn test && yarn build`, thêm `yarn test:e2e` (Jest e2e) ở server.
- `e2e.md` — matrix cuối + ghi rõ gate B chưa chạy.

---

## Task 11 — [PR] 3 PR, base `main`, **KHÔNG merge**

`docs` / `server` / `client` — mỗi repo 1 PR qua GitHub MCP. Parent session serialise merge.
