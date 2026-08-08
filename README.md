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

> **Chạy `npx prisma generate` trước khi lint** (nhất là ở worktree mới). ESLint dùng typed rules (`recommendedTypeChecked`); thiếu Prisma Client thì các model delegate suy ra `any` → vừa sinh cả trăm lỗi `no-unsafe-*` giả, vừa khiến `no-unnecessary-type-assertion` **tự xoá** type assertion hợp lệ khi `--fix`.

> **Pre-commit hook** (husky + lint-staged, cài tự động khi `yarn` qua script `prepare`): mỗi `git commit` tự chạy `eslint --fix` + `prettier --write` trên **staged files**. Lỗi ESLint không auto-fix được sẽ chặn commit.

## i18n

`en` + `vi` qua `nestjs-i18n`, resolver theo query `?lang=` hoặc header `Accept-Language`, fallback `en`. Message files ở `src/i18n/<locale>/common.json`.
