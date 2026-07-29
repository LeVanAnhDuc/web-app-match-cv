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
- `POST /api/v1/match` `{ cvDocumentId, jdDocumentId }` — hybrid match (keyword + OpenRouter embedding cosine in-app + OpenRouter report) → `MatchResult`. **503** nếu thiếu `OPENROUTER_API_KEY`.
- `GET /api/v1/match/:id` — lấy lại kết quả match (per-user).

## Env vars

Xem `.env.example`:

- `PORT` (default `5200`)
- `CLIENT_ORIGIN` (default `http://localhost:5300`) — CORS
- `DATABASE_URL` — **bắt buộc**, Postgres local (`postgresql://<user>:<pass>@localhost:5432/matchcv`)
- `OPENROUTER_API_KEY` — **bắt buộc cho `/match`** (OpenRouter, OpenAI-compatible; embedding + chat report). Thiếu → `/match` trả 503. Optional cho các endpoint khác.
- `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`), `OPENROUTER_CHAT_MODEL` (default `openai/gpt-4o-mini`), `OPENROUTER_EMBED_MODEL` (default `openai/text-embedding-3-small`) — optional.

## Scripts

- `yarn start:dev` — dev server (watch mode)
- `yarn build` — build production (`dist/`)
- `yarn lint` — ESLint
- `yarn test:e2e` — e2e tests (Jest + supertest)

> **Pre-commit hook** (husky + lint-staged, cài tự động khi `yarn` qua script `prepare`): mỗi `git commit` tự chạy `eslint --fix` + `prettier --write` trên **staged files**. Lỗi ESLint không auto-fix được sẽ chặn commit.

## i18n

`en` + `vi` qua `nestjs-i18n`, resolver theo query `?lang=` hoặc header `Accept-Language`, fallback `en`. Message files ở `src/i18n/<locale>/common.json`.
