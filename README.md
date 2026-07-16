# server — web-app-match-cv API (NestJS)

REST API cho `web-app-match-cv`, dựng bằng NestJS 11. **Plan 0 scaffold** — chỉ khung + health-check + config/i18n/swagger; chưa có feature logic.

> **DB deferred**: chưa scaffold Postgres/Prisma/pgvector ở bước này (không có Docker/Postgres local sẵn). Sẽ thêm ở plan sau.

## Setup

```bash
yarn
cp .env.example .env   # chỉnh nếu cần
yarn start:dev
```

App chạy ở `http://localhost:5200` (đổi qua env `PORT`).

- Health check: `GET http://localhost:5200/api/v1/health` → `{ "status": "ok" }`
- Swagger UI: `http://localhost:5200/api/v1/docs`

## Env vars

Xem `.env.example`:

- `PORT` (default `5200`)
- `CLIENT_ORIGIN` (default `http://localhost:5300`) — dùng cho CORS
- `DATABASE_URL`, `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY` — placeholder cho plan sau (deferred)

## Scripts

- `yarn start:dev` — dev server (watch mode)
- `yarn build` — build production (`dist/`)
- `yarn lint` — ESLint
- `yarn test:e2e` — e2e tests (Jest + supertest)

## i18n

`en` + `vi` qua `nestjs-i18n`, resolver theo query `?lang=` hoặc header `Accept-Language`, fallback `en`. Message files ở `src/i18n/<locale>/common.json`.
