# CV↔JD Matching Wizard — Implementation Plan (Plan 0: Scaffold)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Scope note:** Đây là **Plan 0** — chỉ scaffold `server/` + `client/` thành skeleton chạy được. Plan 1 (Document upload/parse + save/reuse) và Plan 2 (Matching + report) viết ở phiên sau. Xem `design.md` §1 để biết chuỗi plan.

**Goal:** Dựng 2 repo skeleton — `server/` (NestJS + PostgreSQL/pgvector + Prisma) và `client/` (TanStack Start + Ant Design + Tailwind) — boot được, health-check xanh, push lên 2 GitHub repo private mới.

**Architecture:** Monorepo nhiều git repo độc lập. `server/` là REST API NestJS nói chuyện Postgres qua Prisma (pgvector cho vector sau này). `client/` là app TanStack Start (SSR + Vite) gọi API server. Chưa có feature logic — chỉ khung + config + smoke test.

**Tech Stack:** Node LTS, TypeScript, Yarn. BE: NestJS 11, Prisma 6, PostgreSQL 16 + pgvector, @nestjs/config, @nestjs/swagger, nestjs-i18n, helmet, @nestjs/throttler, Jest + supertest. FE: TanStack Start (React 19 + Vite), Ant Design 5 + @ant-design/cssinjs, Tailwind CSS, @tanstack/react-query, i18next + react-i18next, Vitest.

## Global Constraints

- **Package manager:** Yarn (đồng bộ hệ sinh thái store-app).
- **Ports:** server `:5200`, client `:5300`.
- **Database (REVISED 2026-07-16):** KHÔNG dùng Docker. Dùng **PostgreSQL local**, **tạm bỏ pgvector** (thêm khi cần embedding ở Plan 2). Vì máy hiện **chưa cài** Postgres → **Task 2 (Prisma/DB) DỜI sang đầu Plan 1**; Plan 0 scaffold server KHÔNG wiring DB (health + config/i18n/swagger/security, boot + test được không cần DB).
- **i18n locales:** `en` + `vi` (cả BE lẫn FE) — mọi user-facing string qua i18n.
- **Auth:** DEFER — KHÔNG scaffold auth. Mọi query dữ liệu (Plan 1+) key theo `userId` (SSO-ready). Plan 0 chưa có model nghiệp vụ.
- **Secrets:** `.env` KHÔNG commit; mỗi repo có `.env.example` (chỉ key + placeholder).
- **`.worktrees/` phải bị ignore** bởi `.gitignore` + eslint + tsconfig ở repo code (§6.6 root CLAUDE.md).
- **GitHub repos (private, owner `LeVanAnhDuc`):** server → `api-web-app-match-cv`; client → `client-web-app-match-cv`.
- **Bootstrap trên `main`:** repo mới → initial commit trên `main` (không thể branch từ origin/main khi repo chưa tồn tại). Worktree isolation áp từ Plan 1.

---

## PART A — `server/` (NestJS)

### Task 1: Bootstrap NestJS + health endpoint

**Files:**
- Create: `server/` (nest new output), `server/src/main.ts`, `server/src/app.module.ts`
- Create: `server/src/modules/health/health.module.ts`, `server/src/modules/health/health.controller.ts`
- Test: `server/test/health.e2e-spec.ts`

**Interfaces:**
- Produces: `GET /api/v1/health` → `200 { status: "ok" }`. Global prefix `api/v1`. App listen port từ `PORT` env (default 5200).

- [ ] **Step 1: Scaffold NestJS project**

Run trong `D:\Learn\web-app-match-cv`:
```bash
npx @nestjs/cli@latest new server --package-manager yarn --skip-git --language TypeScript
```
(`--skip-git`: ta init git thủ công ở Task 4 để control initial commit.)

- [ ] **Step 2: Write failing e2e test cho health**

`server/test/health.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('GET /api/v1/health → 200 ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 3: Run test → verify FAIL**

Run: `cd server && yarn test:e2e health`
Expected: FAIL (health route chưa tồn tại → 404).

- [ ] **Step 4: Implement health module**

`server/src/modules/health/health.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
```
`server/src/modules/health/health.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController] })
export class HealthModule {}
```
Trong `server/src/app.module.ts` thêm `HealthModule` vào `imports`. Xoá `AppController`/`AppService` mặc định nếu không dùng.

- [ ] **Step 5: Set global prefix + port trong `main.ts`**

`server/src/main.ts`:
```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  await app.listen(process.env.PORT ?? 5200);
}
bootstrap();
```

- [ ] **Step 6: Run test → verify PASS**

Run: `cd server && yarn test:e2e health`
Expected: PASS.

- [ ] **Step 7: Smoke boot**

Run: `cd server && yarn start:dev` → mở `http://localhost:5200/api/v1/health` → thấy `{"status":"ok"}`. Ctrl-C.

### Task 2: PostgreSQL + Prisma — ⏸️ DEFERRED sang Plan 1

> **DỜI (2026-07-16):** Bỏ Docker + tạm bỏ pgvector + Postgres local chưa cài → Task 2 KHÔNG chạy trong Plan 0. Khi cài PostgreSQL local xong, wiring Prisma (provider postgresql, **chưa** `extensions=[vector]`) ở đầu Plan 1; smoke test chỉ check connectivity (`SELECT 1`), bỏ assertion pgvector. Nội dung code Docker/pgvector bên dưới GIỮ làm tham chiếu cho khi bật lại (đổi image→local instance, bỏ block pgvector).

<details><summary>Nội dung Task 2 gốc (tham chiếu — không chạy ở Plan 0)</summary>

**Files:**
- Create: `server/docker-compose.yml`, `server/prisma/schema.prisma`, `server/prisma/migrations/**`
- Create: `server/src/prisma/prisma.module.ts`, `server/src/prisma/prisma.service.ts`
- Test: `server/test/prisma.e2e-spec.ts`

**Interfaces:**
- Produces: `PrismaService` (extends `PrismaClient`, `onModuleInit` connect) exported từ `PrismaModule` (global). DB có extension `vector` sẵn sàng cho Plan 1.

- [ ] **Step 1: Docker Compose Postgres + pgvector**

`server/docker-compose.yml`:
```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    environment:
      POSTGRES_USER: matchcv
      POSTGRES_PASSWORD: matchcv
      POSTGRES_DB: matchcv
    ports:
      - '5432:5432'
    volumes:
      - matchcv_pgdata:/var/lib/postgresql/data
volumes:
  matchcv_pgdata:
```
Run: `cd server && docker compose up -d` → `docker compose ps` thấy container `healthy/running`.

- [ ] **Step 2: Cài Prisma + init**

Run:
```bash
cd server && yarn add @prisma/client && yarn add -D prisma
npx prisma init --datasource-provider postgresql
```
Set `server/.env` → `DATABASE_URL="postgresql://matchcv:matchcv@localhost:5432/matchcv?schema=public"`.

- [ ] **Step 3: Bật pgvector extension trong schema**

`server/prisma/schema.prisma`:
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}
```

- [ ] **Step 4: Migration khởi tạo (tạo extension)**

Run: `cd server && npx prisma migrate dev --name init_pgvector`
Sau đó xác nhận file migration có `CREATE EXTENSION IF NOT EXISTS "vector"`. Nếu Prisma chưa emit, thêm tay vào migration rồi `npx prisma migrate dev`.
Expected: migration applied, `npx prisma generate` chạy.

- [ ] **Step 5: PrismaService + module**

`server/src/prisma/prisma.service.ts`:
```ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```
`server/src/prisma/prisma.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```
Thêm `PrismaModule` vào `app.module.ts` imports.

- [ ] **Step 6: Write test connectivity + pgvector**

`server/test/prisma.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';

describe('Prisma (e2e)', () => {
  let prisma: PrismaService;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [PrismaModule] }).compile();
    prisma = mod.get(PrismaService);
    await prisma.$connect();
  });
  afterAll(async () => { await prisma.$disconnect(); });

  it('connects to DB', async () => {
    const rows = await prisma.$queryRaw`SELECT 1 as ok`;
    expect(rows).toEqual([{ ok: 1 }]);
  });

  it('pgvector extension installed', async () => {
    const rows = await prisma.$queryRaw<{ extname: string }[]>`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
    expect(rows.length).toBe(1);
  });
});
```

- [ ] **Step 7: Run test → PASS**

Run: `cd server && yarn test:e2e prisma`
Expected: PASS (yêu cầu `docker compose up -d` đã chạy).

</details>

### Task 3: Config, validation, Swagger, i18n, security

**Files:**
- Create: `server/src/config/env.validation.ts`
- Modify: `server/src/main.ts`, `server/src/app.module.ts`
- Create: `server/src/i18n/en/common.json`, `server/src/i18n/vi/common.json`
- Create: `server/.env.example`
- Test: `server/test/app-config.e2e-spec.ts`

**Interfaces:**
- Produces: global `ValidationPipe` (whitelist + transform); Swagger UI tại `GET /api/v1/docs`; i18n resolver (query `?lang=` + header `Accept-Language`), fallback `en`; helmet + CORS (origin từ `CLIENT_ORIGIN`) + throttler.

- [ ] **Step 1: Cài deps**

Run:
```bash
cd server && yarn add @nestjs/config @nestjs/swagger class-validator class-transformer nestjs-i18n helmet @nestjs/throttler
```

- [ ] **Step 2: Env validation schema**

`server/src/config/env.validation.ts`:
```ts
import { plainToInstance } from 'class-transformer';
import { IsInt, IsString, IsUrl, validateSync } from 'class-validator';

class EnvVars {
  @IsInt() PORT: number = 5200;
  @IsString() DATABASE_URL!: string;
  @IsString() CLIENT_ORIGIN: string = 'http://localhost:5300';
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, { ...config, PORT: Number(config.PORT ?? 5200) }, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length) throw new Error(`Config validation error: ${errors.toString()}`);
  return validated;
}
```

- [ ] **Step 3: Wire ConfigModule + i18n vào `app.module.ts`**

Thêm vào `imports`:
```ts
ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
I18nModule.forRoot({
  fallbackLanguage: 'en',
  loaderOptions: { path: join(__dirname, '/i18n/'), watch: true },
  resolvers: [{ use: QueryResolver, options: ['lang'] }, AcceptLanguageResolver],
}),
```
(import `join` từ `path`; `I18nModule, QueryResolver, AcceptLanguageResolver` từ `nestjs-i18n`; `ThrottlerModule` từ `@nestjs/throttler`; đăng ký `APP_GUARD` = `ThrottlerGuard` trong providers.)
Đảm bảo `nest-cli.json` copy assets i18n: thêm `"compilerOptions": { "assets": [{ "include": "i18n/**/*", "watchAssets": true }] }`.

- [ ] **Step 4: i18n message files**

`server/src/i18n/en/common.json`: `{ "hello": "Hello" }`
`server/src/i18n/vi/common.json`: `{ "hello": "Xin chào" }`

- [ ] **Step 5: main.ts — ValidationPipe + helmet + CORS + Swagger**

Thêm vào `bootstrap()` sau `create`:
```ts
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// ...
app.use(helmet());
app.enableCors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5300', credentials: true });
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
const swagger = new DocumentBuilder().setTitle('match-cv API').setVersion('0.0.1').build();
SwaggerModule.setup('api/v1/docs', app, SwaggerModule.createDocument(app, swagger));
```

- [ ] **Step 6: `.env.example`**

`server/.env.example`:
```
PORT=5200
DATABASE_URL=postgresql://matchcv:matchcv@localhost:5432/matchcv?schema=public
CLIENT_ORIGIN=http://localhost:5300
# --- AI providers (Plan 2) ---
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
```

- [ ] **Step 7: Write + run smoke test cho i18n + docs**

`server/test/app-config.e2e-spec.ts` — boot app (như Task 1), assert:
```ts
it('Swagger docs served', async () => {
  const res = await request(app.getHttpServer()).get('/api/v1/docs').redirects(1);
  expect([200, 301]).toContain(res.status);
});
```
Run: `cd server && yarn test:e2e app-config` → PASS. Boot `yarn start:dev`, mở `/api/v1/docs` thấy Swagger UI.

### Task 4: Finalize server + GitHub push

**Files:**
- Create: `server/.gitignore` (bổ sung), `server/README.md`
- Modify: `server/eslint.config.mjs`, `server/tsconfig.json` (ignore `.worktrees`)

- [ ] **Step 1: `.gitignore` bổ sung**

Đảm bảo `server/.gitignore` có: `node_modules`, `dist`, `.env`, `.worktrees/`, `coverage`, `logs`.

- [ ] **Step 2: Ignore `.worktrees` cho eslint + tsconfig**

`server/eslint.config.mjs` → thêm `.worktrees` vào `ignores`. `server/tsconfig.json` → thêm `"exclude": ["node_modules", "dist", ".worktrees"]`.

- [ ] **Step 3: README ngắn**

`server/README.md`: mô tả setup (`yarn`, `docker compose up -d`, `npx prisma migrate dev`, `yarn start:dev`), port 5200, link Swagger `/api/v1/docs`.

- [ ] **Step 4: Verify toàn bộ check xanh**

Run: `cd server && yarn lint && yarn build && yarn test:e2e`
Expected: lint 0 error, build OK, tất cả e2e PASS.

- [ ] **Step 5: Git init + initial commit + push**

(GitHub repo `api-web-app-match-cv` đã được tạo sẵn — xem "Execution setup".)
```bash
cd server
git init -b main
git add -A
git commit -m "chore: scaffold NestJS server (health, prisma+pgvector, config/i18n/swagger)"
git remote add origin https://github.com/LeVanAnhDuc/api-web-app-match-cv.git
git push -u origin main
```
**Commit gate §7**: trình diff/summary cho user duyệt TRƯỚC khi commit.

---

## PART B — `client/` (TanStack Start)

### Task 5: Scaffold TanStack Start + home smoke

**Files:**
- Create: `client/` (CLI output), `client/src/routes/index.tsx`
- Test: `client/src/routes/__tests__/index.test.tsx`

**Interfaces:**
- Produces: app TanStack Start chạy `:5300`, route `/` render heading nhận diện được. Add-ons: Tailwind, TanStack Query, ESLint.

- [ ] **Step 1: Scaffold qua TanStack CLI**

Run trong `D:\Learn\web-app-match-cv`:
```bash
npx @tanstack/cli@latest create client --add-ons tailwind,tanstack-query,eslint
```
Chọn package manager = **yarn** khi được hỏi (hoặc thêm `--package-manager yarn` nếu CLI hỗ trợ). Nếu prompt add-ons khác, giữ mặc định + đảm bảo có tailwind + tanstack-query.
Xác minh: `cd client && yarn dev` boot được (đổi port sang 5300 ở step 2).

- [ ] **Step 2: Set port 5300**

Trong `client/vite.config.ts` thêm `server: { port: 5300 }` (và `preview: { port: 5300 }`). Boot `yarn dev` → `http://localhost:5300`.

- [ ] **Step 3: Cài Vitest + testing-library**

Run:
```bash
cd client && yarn add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```
Thêm `client/vitest.config.ts` (environment `jsdom`, globals true) + script `"test": "vitest run"` vào `package.json`. (Nếu CLI đã thêm vitest add-on, bỏ qua trùng.)

- [ ] **Step 4: Write failing test cho home**

`client/src/routes/__tests__/index.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HomeComponent } from '../index';

describe('Home', () => {
  it('renders app name', () => {
    render(<HomeComponent />);
    expect(screen.getByRole('heading', { name: /match cv/i })).toBeDefined();
  });
});
```

- [ ] **Step 5: Run → FAIL**

Run: `cd client && yarn test`
Expected: FAIL (`HomeComponent` chưa export).

- [ ] **Step 6: Implement home route**

`client/src/routes/index.tsx` — export component tách để test:
```tsx
import { createFileRoute } from '@tanstack/react-router';

export function HomeComponent() {
  return <h1>Match CV</h1>;
}

export const Route = createFileRoute('/')({ component: HomeComponent });
```

- [ ] **Step 7: Run → PASS + smoke**

Run: `cd client && yarn test` → PASS. `yarn dev` → `:5300` thấy "Match CV".

### Task 6: Ant Design + Tailwind integration (SSR-safe)

**Files:**
- Create: `client/src/providers/AntdProvider.tsx`
- Modify: server entry của TanStack Start (thường `client/src/server.ts` hoặc `client/src/ssr.tsx` — xác minh theo output CLI), `client/src/routes/__root.tsx`, `client/tailwind.config` / `client/src/styles.css`
- Test: `client/src/routes/__tests__/index.test.tsx` (mở rộng)

**Interfaces:**
- Consumes: home route (Task 5).
- Produces: antd `ConfigProvider` + `StyleProvider` (cssinjs) bọc app; render 1 antd `Button` không FOUC, không lỗi console. Tailwind + antd cùng tồn tại (tắt Tailwind preflight để không phá reset của antd).

- [ ] **Step 1: Cài antd + cssinjs**

Run: `cd client && yarn add antd @ant-design/cssinjs @ant-design/icons`

- [ ] **Step 2: Tránh xung đột reset — tắt Tailwind preflight**

Trong Tailwind config (v4: dùng `@import "tailwindcss"` + `@layer`; đảm bảo antd styles có độ ưu tiên đúng). Cách an toàn: bật `cssVar` cho antd `ConfigProvider theme={{ cssVar: true, hashed: false }}` và giữ Tailwind preflight nhưng import antd sau. Ghi rõ thứ tự import trong `styles.css`.

- [ ] **Step 3: AntdProvider**

`client/src/providers/AntdProvider.tsx`:
```tsx
import { StyleProvider } from '@ant-design/cssinjs';
import { ConfigProvider } from 'antd';
import type { PropsWithChildren } from 'react';

export function AntdProvider({ children }: PropsWithChildren) {
  return (
    <StyleProvider hashPriority="high">
      <ConfigProvider theme={{ cssVar: true }}>{children}</ConfigProvider>
    </StyleProvider>
  );
}
```

- [ ] **Step 4: Bọc app trong `__root.tsx`**

Wrap `<Outlet />` (và children) bằng `<AntdProvider>`.

- [ ] **Step 5: SSR style extraction**

Trong server entry của TanStack Start: tạo `createCache()` từ `@ant-design/cssinjs`, bọc render bằng `<StyleProvider cache={cache}>`, sau render gọi `extractStyle(cache)` và inject vào `<head>`. **Xác minh API server-entry theo output CLI hiện tại** (TanStack Start expose hook render HTML). Tham chiếu antd cssinjs SSR docs. Mục tiêu: view-source thấy `<style>` antd inline, không FOUC.

- [ ] **Step 6: Render antd Button ở home + mở rộng test**

`index.tsx` thêm `import { Button } from 'antd'` và render `<Button type="primary">Start</Button>`. Test thêm:
```tsx
it('renders antd primary button', () => {
  render(<HomeComponent />);
  expect(screen.getByRole('button', { name: /start/i })).toBeDefined();
});
```

- [ ] **Step 7: Run test → PASS + smoke SSR**

Run: `cd client && yarn test` → PASS. `yarn dev` → `:5300`: Button hiển thị đúng style antd; DevTools Console không lỗi; view-source có style antd (no FOUC).

### Task 7: TanStack Query provider + i18next + env

**Files:**
- Modify: `client/src/routes/__root.tsx` (Query provider — nếu add-on chưa wire)
- Create: `client/src/i18n/index.ts`, `client/src/i18n/en.json`, `client/src/i18n/vi.json`
- Create: `client/.env.example`
- Test: `client/src/i18n/__tests__/i18n.test.ts`

**Interfaces:**
- Produces: `QueryClient` provider bọc app; i18next init (`en` + `vi`, fallback `en`); `VITE_API_BASE_URL` env; hàm `t()` dùng được trong component.

- [ ] **Step 1: Đảm bảo QueryClientProvider**

Nếu add-on `tanstack-query` chưa bọc app, thêm `QueryClient` + `QueryClientProvider` trong `__root.tsx`. Xác minh bằng cách import `useQueryClient` không throw.

- [ ] **Step 2: Cài i18next**

Run: `cd client && yarn add i18next react-i18next`

- [ ] **Step 3: i18n resources + init**

`client/src/i18n/en.json`: `{ "appName": "Match CV", "start": "Start" }`
`client/src/i18n/vi.json`: `{ "appName": "Ghép CV", "start": "Bắt đầu" }`
`client/src/i18n/index.ts`:
```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import vi from './vi.json';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, vi: { translation: vi } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
export default i18n;
```
Import `./i18n` trong `__root.tsx` (init sớm).

- [ ] **Step 4: Write test i18n**

`client/src/i18n/__tests__/i18n.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import i18n from '../index';

describe('i18n', () => {
  it('en default', () => { expect(i18n.t('appName')).toBe('Match CV'); });
  it('switch to vi', async () => {
    await i18n.changeLanguage('vi');
    expect(i18n.t('appName')).toBe('Ghép CV');
    await i18n.changeLanguage('en');
  });
});
```

- [ ] **Step 5: Run → PASS**

Run: `cd client && yarn test` → PASS.

- [ ] **Step 6: `.env.example`**

`client/.env.example`:
```
VITE_API_BASE_URL=http://localhost:5200/api/v1
VITE_DEFAULT_LOCALE=en
```

### Task 8: Finalize client + GitHub push

**Files:**
- Create/Modify: `client/.gitignore`, `client/README.md`, eslint config, `tsconfig.json`

- [ ] **Step 1: `.gitignore` + ignore `.worktrees`**

`client/.gitignore` có: `node_modules`, `.output`, `.vinxi`/`.tanstack` build dirs, `.env`, `.worktrees/`, `coverage`. Thêm `.worktrees` vào eslint `ignores` + tsconfig `exclude`.

- [ ] **Step 2: README ngắn**

`client/README.md`: setup (`yarn`, `yarn dev`), port 5300, env cần (`VITE_API_BASE_URL`), lệnh test.

- [ ] **Step 3: Verify check xanh**

Run: `cd client && yarn lint && yarn build && yarn test`
Expected: lint 0 error, build OK, test PASS.

- [ ] **Step 4: Git init + commit + push**

(GitHub repo `client-web-app-match-cv` đã tạo sẵn.)
```bash
cd client
git init -b main
git add -A
git commit -m "chore: scaffold TanStack Start client (antd+tailwind, query, i18n)"
git remote add origin https://github.com/LeVanAnhDuc/client-web-app-match-cv.git
git push -u origin main
```
**Commit gate §7**: trình diff/summary cho user duyệt TRƯỚC khi commit.

---

## Execution setup (làm trước Task 1)

1. **Tạo 2 GitHub repo private** (owner `LeVanAnhDuc`) qua github MCP: `api-web-app-match-cv`, `client-web-app-match-cv` (autoInit=false — ta push scaffold của mình).
2. Cập nhật root `CLAUDE.md` (§1 layout, §3 techstack path, §4.2 skill BE/FE TBD→thực) + skill `commit`/`creating-github-pr` coupling tên repo — **thuộc §4.6 drift audit**, làm sau khi scaffold xong (Plan 0 wrap-up), không chặn Task 1.

## Post-Plan-0 (không thuộc plan này)

- Root `.mcp.json`: cân nhắc thêm postgres MCP (optional).
- Cập nhật `.claude/techstack/*` version thật sau scaffold (§4.6).
- Plan 1: Document model + upload/parse + save/reuse + wizard step 1–2 (kèm SuperDesign step 1.5 mock UI + user review BLOCKING).

## Self-Review

- **Spec coverage:** Plan 0 phủ prerequisite "scaffold server/+client/" của `design.md` §1. Feature logic (upload/parse/match) thuộc Plan 1–2 (ghi rõ). ✅
- **Placeholder scan:** Các bước có lệnh + code cụ thể. Điểm cần executor xác minh theo output CLI (server entry TanStack Start ở Task 6 step 5, add-on wiring Task 7 step 1) được ghi rõ là "xác minh theo output CLI" — không phải TODO ẩn, mà là điểm tích hợp phụ thuộc scaffold thực tế. ✅
- **Type consistency:** `HomeComponent` export nhất quán (Task 5 → Task 6). `PrismaService` nhất quán (Task 2). Global prefix `api/v1` + port 5200/5300 nhất quán. ✅
