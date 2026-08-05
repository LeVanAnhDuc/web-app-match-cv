---
name: config
paths:
  - "src/config/**"
---

Config layer định nghĩa + validate biến môi trường. Single source cho env schema; module/service KHÔNG đọc `process.env` trực tiếp.

## `validateEnv` (`src/config/env.validation.ts`)

- Khai class `EnvVars` với field = env key, decorate bằng **class-validator** (`@IsInt`, `@IsString`, `@IsOptional`). Có default gán inline khi hợp lý (`PORT = 5200`, `CLIENT_ORIGIN`). Key bắt buộc dùng `!` (vd `DATABASE_URL!`); key optional dùng `@IsOptional()` + `?` (vd nhóm `OPENROUTER_*` — required tại thời điểm dùng, optional lúc boot).
- Export hàm `validateEnv(config: Record<string, unknown>)`:
  - `plainToInstance(EnvVars, config, { enableImplicitConversion: true })` (coerce string→number/bool), coerce thủ công chỗ cần (`PORT: Number(...)`).
  - `validateSync(validated, { skipMissingProperties: false })`.
  - `errors.length` → `throw new Error(...)` để app **fail-fast lúc boot**.
  - return instance đã validate.

## Wiring (`app.module.ts`)

```ts
ConfigModule.forRoot({ isGlobal: true, validate: validateEnv });
```

`isGlobal: true` → `ConfigService` dùng được ở mọi module không cần import lại.

## Quy tắc

- **KHÔNG đọc `process.env` trực tiếp trong module/service** — truy cập env đã validate qua `ConfigService.get(...)`. (Ngoại lệ hiện có: `main.ts` bootstrap trước khi DI container sẵn sàng — đọc `process.env.PORT` / `process.env.CLIENT_ORIGIN` ở đó chấp nhận được; code trong DI thì không.)
- Thêm env mới → thêm field vào `EnvVars` với validator phù hợp (+ default/`@IsOptional` nếu cần) **và** thêm key + placeholder vào `.env.example` (không commit secret).
- Đổi/xoá env → cập nhật `EnvVars` + `.env.example` đồng bộ.
