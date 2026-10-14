# match-cv-automation-testing

E2E Playwright cho **Match CV**: test UI trên trình duyệt thật và test API qua HTTP, chạy với môi trường dev/stg thật.
Quy ước đầy đủ (cấu trúc, phân lớp, tag, format, luật cứng): `CLAUDE.md`. Mỗi thư mục trong `src/` có `README.md` riêng.

## Bắt đầu

1. `pnpm install && pnpm exec playwright install chromium`
2. `cp .env.example .env`, điền tài khoản cố định
3. `pnpm test:unit && pnpm test:smoke`
4. Viết test cho một module: mở Claude Code trong thư mục này rồi gõ `/write-tests <module>`

## Điều kiện chạy (Match CV)

- **Cả hai server phải đang chạy**: server `:5200` (`cd ../server && pnpm start:dev`) và client `:5300`
  (`cd ../client && pnpm dev`). Suite không tự bật/tắt gì.
- `.env` có `E2E_DATABASE_URL` trỏ vào Postgres **dev**: project `session` seed user + phiên đăng nhập trực tiếp vào DB,
  và teardown **xóa toàn bộ** `Document` / `MatchRun` / `MatchResult` / `GuestUsage`. Không bao giờ trỏ vào DB có dữ liệu thật.
- `CREDENTIAL_ENCRYPTION_KEY` đặt trong `../server/.env` (base64 đúng 32 byte, `openssl rand -base64 32`). Thiếu thì
  `POST /api/v1/ai-credentials` trả 503 và mọi spec seed credential đều đỏ (ai-credentials, cover-letter-generator,
  cv-rewrite-assistant, cv-version-comparison, multi-provider-compare).
- App chạy ở cổng khác (git worktree) → `E2E_BASE_URL` / `E2E_API_BASE` trong `.env`; server phải cho phép origin đó qua
  `CLIENT_ORIGIN`.

**Project**: `app` (desktop 1280×720, gồm cả test API), `app-tablet` (820×1180), `app-mobile` (390×844),
`app-guest` / `app-guest-mobile` (chỉ `e2e/guest-mode/`, không cookie). `pnpm test` chạy mọi project `app*`.

**Máy ít RAM: chạy từng project một.** Chạy cả ba viewport một lượt từng làm Windows giết dev server và worker giữa
chừng; triệu chứng giống lỗi thật (zip tải về bị cụt ở `data-export`, `page.waitForEvent` timeout, `Tracing is already
stopping`). Đo 2026-09-07: chạy gộp báo 56 lỗi, chạy lại từng project thì xanh hết.

```bash
for p in app app-tablet app-mobile app-guest app-guest-mobile; do pnpm exec playwright test --project=$p; done
```

## Bố cục

```
src/docs/       requirements/<module>.md (REQ-*), decisions/<module>.md, traceability-matrix.md (sinh tự động)
src/test-cases/ <module>.md (TC-*)
src/defects/    <module>.md (BUG-*, đang mở / đã sửa)
src/config/ utils/ data/ api/ components/ pages/ fixtures/    code test, phân lớp theo CLAUDE.md
src/tests/      e2e/<module>/*.e2e.ts · api/<module>/*.api.ts · setup/*.setup.ts · seed.spec.ts
```

## Viết một test

```ts
import { test, expect } from "@/fixtures";

test("email chưa đăng ký hiện thông báo", { tag: ["@TC-SIGNIN-007"] }, async ({ signInPage }) => {
  await signInPage.goto();
  await signInPage.submitEmail("nobody@example.com");
  await expect(signInPage.notification.withText(/does not exist/)).toBeVisible();
});
```

Mỗi test gắn mã test case nó chứng minh; `pnpm coverage:check` kiểm REQ ↔ TC ↔ spec ↔ bug.
