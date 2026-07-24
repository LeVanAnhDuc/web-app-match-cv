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
- `POST /api/v1/match` `{ cvDocumentId, jdDocumentId }` — hybrid match (keyword + Gemini embedding cosine in-app + Gemini report) → `MatchResult`. **503** nếu thiếu `GEMINI_API_KEY`.
- `GET /api/v1/match/:id` — lấy lại kết quả match (per-user).

## Env vars

Xem `.env.example`:

- `PORT` (default `5200`)
- `CLIENT_ORIGIN` (default `http://localhost:5300`) — CORS
- `DATABASE_URL` — **bắt buộc**, Postgres local (`postgresql://<user>:<pass>@localhost:5432/matchcv`)
- `GEMINI_API_KEY` — **bắt buộc cho `/match`** (Google Gemini; embedding + report). Thiếu → `/match` trả 503. Optional cho các endpoint khác.
- `GEMINI_GEN_MODEL` (default `gemini-2.0-flash`), `GEMINI_EMBED_MODEL` (default `text-embedding-004`) — optional.

## Scripts

- `yarn start:dev` — dev server (watch mode)
- `yarn build` — build production (`dist/`)
- `yarn lint` — ESLint
- `yarn test:e2e` — e2e tests (Jest + supertest)

## i18n

`en` + `vi` qua `nestjs-i18n`, resolver theo query `?lang=` hoặc header `Accept-Language`, fallback `en`. Message files ở `src/i18n/<locale>/common.json`.
