# server — web-app-match-cv API (NestJS)

REST API cho `web-app-match-cv`, dựng bằng NestJS 11 + Prisma 6 + PostgreSQL. **Plan 1** — có Documents module (upload/parse CV·JD + save/reuse per-user). pgvector/embedding để Plan 2.

> **DB**: PostgreSQL **cài local** (KHÔNG Docker). pgvector chưa bật.

## Setup

```bash
yarn
cp .env.example .env            # chỉnh DATABASE_URL theo Postgres local của bạn
createdb matchcv                # hoặc: psql -c "CREATE DATABASE matchcv"
npx prisma migrate dev          # tạo bảng User/Document
npx prisma db seed              # seed stub current-user (auth defer)
yarn start:dev
```

App chạy ở `http://localhost:5200` (đổi qua env `PORT`).

- Health: `GET /api/v1/health` → `{ "status": "ok" }`
- Swagger UI: `http://localhost:5200/api/v1/docs`

## Endpoints

- `POST /api/v1/documents` — nạp CV/JD: multipart `file` (PDF/DOCX ≤10MB) **hoặc** JSON `{ sourceText }`; `kind` (CV|JD), `save`, `title?`. Parse → `rawText`.
- `GET /api/v1/documents?kind=CV|JD&saved=true` — list tài liệu đã lưu (per-user).
- `GET /api/v1/documents/:id` — 1 document (per-user), kèm `rawText` (dùng cho review).
- `POST /api/v1/match` `{ cvDocumentId, jdDocumentId, credentialId? }` — hybrid match (keyword + embedding cosine in-app + chat report) → `MatchResult`. `credentialId` là một `AiCredential` của user; bỏ trống → chạy bằng key hệ thống và **503** nếu thiếu `OPENROUTER_API_KEY`. `runId` (tuỳ chọn) gom kết quả này vào một run — phải là run của bạn và đúng cặp document đó. Kết quả snapshot lại `provider`/`chatModel`/`embedModel` đã dùng.

  > **Provider lỗi KHÔNG còn trả 503.** Nó trả **201** với `status: "failed"` + `errorCode` thuộc tập đóng (`invalid_key` | `no_quota` | `model_unavailable` | `timeout` | `unreachable`). Lý do: khi chạy nhiều provider song song, một cái chết không được làm hỏng cả request, và card của nó vẫn cần thứ gì đó để hiển thị sau khi reload. **503 chỉ còn cho lỗi cấu hình** (thiếu key hệ thống, thiếu khoá mã hoá).

- `POST /api/v1/match/runs` `{ cvDocumentId, jdDocumentId }` — mở một **run**, trả `runId` ngay trước khi gọi AI. Client sau đó bắn một `POST /match` cho mỗi provider, dùng chung `runId`.
- `GET /api/v1/match/runs/:id` — run + toàn bộ result đã có. **Ít result hơn số provider đã chọn là hợp lệ** (các provider còn lại chưa xong).
- `GET /api/v1/match` — lịch sử match của user (mới nhất trước).
- `GET /api/v1/match/:id` — lấy lại kết quả match (per-user).

### AI credentials (BYO key)

- `GET /api/v1/ai-credentials/providers` — whitelist provider + model mặc định của từng provider.
- `GET /api/v1/ai-credentials` — credential của user. Response **không bao giờ** chứa key; chỉ `keyLast4`.
- `POST /api/v1/ai-credentials` `{ provider, label, apiKey, chatModel?, embedModel? }` — key được mã hoá AES-256-GCM trước khi lưu. Label trùng → **409**.
- `PATCH /api/v1/ai-credentials/:id` `{ label?, apiKey?, chatModel?, embedModel? }` — bỏ `apiKey` để giữ key hiện tại; gửi model rỗng để xoá override. Đổi key/model → trạng thái test bị reset.
- `DELETE /api/v1/ai-credentials/:id` — kết quả match cũ **không** bị xoá (FK `ON DELETE SET NULL` + snapshot provider/model).
- `POST /api/v1/ai-credentials/:id/test` — ping **cả** chat và embeddings bằng key đã lưu, trả trạng thái từng cái. Rate-limit 10 req/phút.

Mọi endpoint `/ai-credentials` trả **503** nếu thiếu `CREDENTIAL_ENCRYPTION_KEY`.

### Cover letters

Sinh thư ứng tuyển từ **một `MatchResult` đã thành công** — report của lần chấm đó vừa là chất liệu (`strengths`) vừa là **danh sách cấm** (`gaps`, xem ghi chú grounding bên dưới).

- `POST /api/v1/cover-letters` `{ matchResultId, tone, length, language, credentialId? }` — `tone` = `formal|friendly`, `length` = `short|standard`, `language` = `en|vi` (**ngôn ngữ của lá thư**, không phải của giao diện). Bỏ `credentialId` → chạy bằng key hệ thống. Rate-limit **10 req/phút** (mỗi call gửi cả CV lẫn JD tới provider). Match không thuộc bạn → **404**; match `status=failed` → **400** (không có report thì không có gì để viết).
- `GET /api/v1/cover-letters?matchResultId=<uuid>` — các bản đã sinh của match đó, mới nhất trước. `matchResultId` **bắt buộc**; id của người khác trả **mảng rỗng**, không phải 403.
- `PATCH /api/v1/cover-letters/:id` `{ content }` — lưu bản user sửa tay, đánh dấu `edited: true`. Đổi tone/length/language nghĩa là **sinh lại**, không sửa được qua đây. Bản `failed` → **400**.
- `DELETE /api/v1/cover-letters/:id` — **204**.

  > **Provider lỗi trả 201, không 503** — giống hợp đồng của `POST /match`: row được lưu với `status: "failed"` + `errorCode` thuộc tập đóng, để UI hiện được lỗi và reload vẫn thấy. 503 chỉ còn cho lỗi cấu hình.
  >
  > **Mỗi lần sinh được LƯU**, kể cả lần lỗi — đó là cách so được nhiều bản (tone/length/language khác nhau) mà không phải trả tiền lại. User xoá bản không dùng bằng `DELETE`.
  >
  > **Grounding (ADR #13)**: prompt nhận `report.gaps` dưới nhãn `MUST NOT CLAIM` và bắt model trả `omittedRequirements` — những yêu cầu của JD mà CV không chống lưng được. Response mang danh sách đó để UI nói thẳng lá thư **không** khẳng định điều gì.

### CV rewrite (Goal 7a)

- `POST /api/v1/cv-rewrite` `{ matchResultId, credentialId? }` — từ một `MatchResult` **đã thành công** của bạn, sinh danh sách **thay đổi đề xuất** cho CV. Trả `CvRewriteProposalDto` = `changes[]` + `unaddressedGaps[]` + provider/model đã dùng. Rate-limit **10 req/phút** (mỗi lần gọi tốn 1 chat completion trên key của bạn và là một lần CV rời hệ thống). Match `status=failed` → **400**; match không thuộc bạn → **404**; provider chết → **503**.

  > **Đề xuất KHÔNG được lưu.** Không có bảng nào cho nó — reload trang là mất, phải sinh lại. Đúng ADR #13: output chỉ thành dữ liệu thật khi user duyệt.

- `POST /api/v1/cv-rewrite/accept` `{ matchResultId, title, changes: [{ original, replacement }] }` — lưu tập thay đổi user đã duyệt thành một **`Document` mới** (`kind=CV`, `sourceFormat=text`, `isSaved=true`, `parentId` = CV gốc). **CV gốc không bao giờ bị ghi đè** (ADR #13). Rate-limit **20 req/phút**.

  > **Server không tin payload này.** Mỗi `original` phải xuất hiện **nguyên văn và duy nhất** trong `rawText` của CV đọc từ DB (so khớp bỏ qua khác biệt khoảng trắng), không được chồng lấn nhau, và `replacement` không được dài quá 4× đoạn nó thay (trần tuyệt đối 1500 ký tự). Sai bất kỳ điều nào → **400** và **không** tạo document nào. Đây là cách ADR #13 ("chỉ diễn đạt lại nội dung đã có, không bịa") được **thi hành**, không chỉ được dặn trong prompt.

`Document` giờ có `parentId` (self-FK, `ON DELETE SET NULL`): xoá CV gốc **không** xoá bản viết lại, chỉ mất liên kết (ADR #15).

### CV version comparison (Goal 9)

- `PATCH /api/v1/documents/:id/parent` `{ parentId: string | null }` — khai báo tài liệu này là **phiên bản mới của** `parentId` (hoặc gửi `null` để gỡ liên kết). CV rewrite tự gán; endpoint này là cách một bản sửa tay có được cùng liên kết đó. Từ chối: trỏ vào chính nó, tài liệu khác `kind`, tài liệu không thuộc bạn, và **mọi liên kết tạo thành vòng** — tất cả **400**; `:id` không thuộc bạn → **404**.
- `GET /api/v1/comparisons/:documentId?jdDocumentId=` — `:documentId` là **bản mới**; bản cũ luôn là `parentId` của nó. Trả delta `overall`/`semantic`/`keyword` (có dấu) + `gapDiff` (`closed` / `persisted` / `introduced`) + danh sách JD so được. Bỏ `jdDocumentId` → server chọn JD mà **cả hai** bản đều đã match; JD không nằm trong danh sách đó → **400** (không im lặng đổi sang JD khác). CV chưa khai `parentId` → **400**; JD → **400**; không thuộc bạn → **404**.

  > **Endpoint này KHÔNG gọi AI.** `ComparisonModule` thậm chí không import `AiModule`. Mở màn so sánh không bao giờ tốn một call nào và không bao giờ gửi CV ra ngoài lần nữa; bản chưa từng match được trả về với `delta: null` (không phải `0`) để FE mời user chạy match qua wizard.

  > **Ghép gap là ước lượng.** Hai bản báo cáo do LLM viết lại mỗi lần, nên `gapDiff` so theo **độ trùng token chủ đề** (dùng chung `matching/tokenizer.ts`, ngưỡng overlap 0.5) chứ không so từng chữ. Nó gộp nhầm 2 gap cùng chủ đề khác chi tiết, và tách nhầm 1 gap diễn đạt bằng từ vựng hoàn toàn khác — cả hai giới hạn được ghi ở `docs/specs/cv-version-comparison/design.md` §3.4, và API luôn trả **nguyên văn** cả hai câu để UI hiển thị.

## Env vars

Xem `.env.example`:

- `PORT` (default `5200`)
- `CLIENT_ORIGIN` (default `http://localhost:5300`) — CORS
- `DATABASE_URL` — **bắt buộc**, Postgres local (`postgresql://<user>:<pass>@localhost:5432/matchcv`)
- `OPENROUTER_API_KEY` — **bắt buộc cho `/match`** (OpenRouter, OpenAI-compatible; embedding + chat report). Thiếu → `/match` trả 503. Optional cho các endpoint khác.
- `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`), `OPENROUTER_CHAT_MODEL` (default `openai/gpt-4o-mini`), `OPENROUTER_EMBED_MODEL` (default `openai/text-embedding-3-small`) — optional.
- `CREDENTIAL_ENCRYPTION_KEY` — **bắt buộc cho `/ai-credentials`**; base64 của **đúng 32 byte**. Sinh bằng `openssl rand -base64 32`. Thiếu hoặc sai độ dài → mọi endpoint credential trả 503; các endpoint khác vẫn chạy. **Đổi hoặc mất khoá này làm mọi credential đã lưu không giải mã được** — không có đường khôi phục, user phải nhập lại key.

## Scripts

- `yarn start:dev` — dev server (watch mode)
- `yarn build` — build production (`dist/`)
- `yarn type-check` — `tsc --noEmit`
- `yarn lint` — ESLint (check-only, không sửa file)
- `yarn lint:fix` — ESLint + auto-fix
- `yarn format` / `yarn format:check` — Prettier write / check
- `yarn test:e2e` — e2e tests (Jest + supertest)
- `yarn seed:mock` — **dev only**: chèn 6 document mock (3 CV + 3 JD, tiếng Việt + tiếng Anh) thuộc stub user, `isSaved = true` nên hiện luôn ở `/cv` và `/jd`. Idempotent — chạy lại **ghi đè** mock về nội dung gốc (kể cả khi đã rename trên UI), không nhân bản.
- `yarn seed:mock:clean` — xoá 6 document đó, kèm `MatchResult`/`MatchRun` sinh ra từ chúng (`CoverLetter` tự cascade). Chỉ xoá theo danh sách UUID hằng số nên **không chạm dữ liệu thật**.

> Mock document dùng dial UUID cố định (`10000000-0000-4000-8000-…` cho CV, `20000000-0000-4000-8000-…` cho JD) thay vì cột `isMock`; `clean` xoá theo dial nên đổi số fixture không làm sót row cũ. `4`/`8` là nibble version/variant **bắt buộc** — id không hợp UUIDv4 vẫn seed được nhưng mọi endpoint ghi sẽ trả 400. Chi tiết + ma trận điểm của bộ fixture: `docs/specs/seed-mock-documents/design.md`.

> **Chạy `npx prisma generate` trước khi lint** (nhất là ở worktree mới). ESLint dùng typed rules (`recommendedTypeChecked`); thiếu Prisma Client thì các model delegate suy ra `any` → vừa sinh cả trăm lỗi `no-unsafe-*` giả, vừa khiến `no-unnecessary-type-assertion` **tự xoá** type assertion hợp lệ khi `--fix`.

> **Pre-commit hook** (husky + lint-staged, cài tự động khi `yarn` qua script `prepare`): mỗi `git commit` tự chạy `eslint --fix` + `prettier --write` trên **staged files**. Lỗi ESLint không auto-fix được sẽ chặn commit.

## i18n

`en` + `vi` qua `nestjs-i18n`, resolver theo query `?lang=` hoặc header `Accept-Language`, fallback `en`. Message files ở `src/i18n/<locale>/common.json`.
