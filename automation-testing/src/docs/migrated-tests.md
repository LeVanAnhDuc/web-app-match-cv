# Test đã gom về `src/`

**Trả lời câu hỏi:** trước repo này Match CV test ở đâu, giờ nằm đâu, module nào chưa chuẩn hóa?

Gom ngày 2026-10-13 bằng `git mv` (lịch sử đi theo file). Chỉ test e2e và API; unit test (`client/src/**/*.test.tsx`,
`server/src/**/*.spec.ts`) giữ nguyên trong app. Ngày 2026-10-14 cả 13 module đã chuẩn hóa bằng `/write-tests`
(requirement chốt với user, page object, client theo resource, tag `@TC-…`); không còn `test.fixme`, không còn mục
`## Gom từ …`, không còn `helpers.ts` kiểu cũ.

## Từ đâu về đâu

| Từ | Về | Trạng thái |
|---|---|---|
| `client/e2e/<feature>/*.e2e.ts` + `helpers.ts` | `src/tests/e2e/<module>/` (viết lại theo chủ đề), locator → `src/pages/<module>/`, stub → `src/fixtures/modules/<module>.fixture.ts` | đã chuẩn hóa |
| `client/e2e/auth-state.ts`, `db-cleanup.ts` | `src/utils/` | đã chuẩn hóa |
| `client/e2e/global-setup.ts`, `global-teardown.ts` | `src/tests/setup/` (project `session`, không còn là `globalSetup`) | đã chuẩn hóa |
| `client/playwright.config.ts` (3 viewport + 2 guest, serial, 60s) | `playwright.config.ts` (`app`, `app-tablet`, `app-mobile`, `app-guest`, `app-guest-mobile`) | đã gộp, file cũ đã xóa |
| `server/test/*.e2e-spec.ts` (14 spec Jest + supertest in-process) | `src/tests/api/<module>/*.api.ts` qua HTTP | đã chuẩn hóa |
| `server/test/helpers/auth.ts` | `src/utils/sessions.ts` (+ `src/utils/db.ts`, `src/api/*.client.ts`) | đã chuẩn hóa |
| `server/test/helpers/{app,auth-flow-env,guest-quota-env}.ts`, `jest-e2e.json` | xóa (chỉ có nghĩa khi chạy in-process) | — |
| `server/test/fixtures/sample.{pdf,docx}` | `src/data/files/` | đã chuẩn hóa |
| `docs/specs/<feature>/e2e.md` (9 file) | `src/test-cases/<module>.md` (đổi sang `TC-…`) | đã chuẩn hóa |
| `docs/specs/ui-consistency-shell/e2e-bugs.md` | `src/defects/ui-consistency-shell.md` (hai vòng lỗi cũ là lỗi script, ghi ở decisions) | đã chuẩn hóa |

## 29 `test.fixme` lúc gom đã xử lý thế nào

Bản cũ thay dịch vụ bằng double qua DI. Theo quyết định của user (2026-10-14): UI stub AI bằng `page.route`; API kiểm
mọi nhánh trước khi gọi AI; vài test `@live-ai` gọi provider thật (chỉ chạy khi `LIVE_AI=1`); OIDC chạy với IdP giả
(`src/utils/fake-idp.ts`) và một instance server riêng. Hai test `infra/database.api.ts` (chỉ chạm DB qua `pg`) đã bỏ.
Chi tiết từng case ở `src/docs/decisions/<module>.md`.

## Hệ quả đã chấp nhận

- Gate "`pnpm test:e2e` khi đổi module graph `AppModule`" của server nay là: `pnpm start:dev` lên được + `pnpm exec
  playwright test --project=app src/tests/api` xanh (`server/.claude/CLAUDE.md`).
- Một số assert đếm cả bảng như bản cũ: ghi khác vào DB dev trong lúc chạy sẽ làm chúng lệch.

## Còn trỏ về nơi cũ

Chỉ tài liệu lịch sử, cố ý không sửa: `docs/specs/*/design.md`, `plan.md`, `security-report.md`, ADR,
`docs/04-state/backlog.md` #5.
