# Test đã gom về `src/`

**Trả lời câu hỏi:** trước repo này Match CV test ở đâu, giờ nằm đâu, module nào chưa chuẩn hóa?

Gom ngày 2026-10-13 bằng `git mv` (lịch sử đi theo file). Chỉ test e2e và API; unit test (`client/src/**/*.test.tsx`,
`server/src/**/*.spec.ts`) giữ nguyên trong app. Chuẩn hóa = `/write-tests <module>` (page object, client theo resource,
tag `@TC-…`, đổi mục `## Gom từ …` sang TC/BUG, quyết định các `test.fixme`).

## Từ đâu về đâu

| Từ | Về | Trạng thái |
|---|---|---|
| `client/e2e/<feature>/*.e2e.ts` (10 feature, 177 test × 3 viewport + 5 guest × 2) | `src/tests/e2e/<feature>/` | chưa chuẩn hóa |
| `client/e2e/<feature>/helpers.ts` | `src/tests/e2e/<feature>/helpers.ts` (tạm, chờ tách ra `pages/` / `api/` / `utils/`) | chưa chuẩn hóa |
| `client/e2e/auth-state.ts`, `db-cleanup.ts` | `src/utils/` | đã đặt đúng chỗ |
| `client/e2e/global-setup.ts`, `global-teardown.ts` | `src/tests/setup/` (project `session`, không còn là `globalSetup`) | đã đặt đúng chỗ |
| `client/playwright.config.ts` (3 viewport + 2 guest, serial, 60s) | gộp vào `playwright.config.ts` (`app`, `app-tablet`, `app-mobile`, `app-guest`, `app-guest-mobile`) | đã gộp, file cũ đã xóa |
| `server/test/*.e2e-spec.ts` (14 spec, Jest + supertest in-process) | `src/tests/api/<module>/*.api.ts` — 181 test, 152 chạy thật, 29 `test.fixme` | chưa chuẩn hóa |
| `server/test/helpers/auth.ts` | `src/utils/sessions.ts` (+ `src/utils/db.ts`, `src/api/http.client.ts`, `src/fixtures/http.fixture.ts`) | đã đặt đúng chỗ |
| `server/test/helpers/{app,auth-flow-env,guest-quota-env}.ts`, `jest-e2e.json` | xóa (chỉ có nghĩa khi chạy in-process) | — |
| `server/test/fixtures/sample.{pdf,docx}` | `src/data/files/` | đã đặt đúng chỗ |
| `docs/specs/<feature>/e2e.md` (9 file) | `src/test-cases/<feature>.md`, mục `## Gom từ …` | chưa chuẩn hóa |
| `docs/specs/ui-consistency-shell/e2e-bugs.md` | `src/defects/ui-consistency-shell.md`, mục `## Gom từ …` | chưa chuẩn hóa |

## `test.fixme` cần quyết định (29)

Bản cũ thay dịch vụ bằng double qua DI (`overrideProvider`); qua HTTP sẽ gọi dịch vụ thật nên chưa chạy.

| Module | Số | Double cần |
|---|---|---|
| ai-credentials | 7 | `CredentialCryptoService`, `AiService.ping` |
| auth | 9 | `OidcClientService` (FakeOidc) + env của `auth-flow-env` |
| cover-letter-generator | 3 | `AiService.generateCoverLetter` |
| cv-rewrite-assistant | 1 | `AiService.generateCvRewrite` |
| guest-mode | 1 | AI hỏng + `GUEST_MATCH_LIMIT_PER_DAY=1` |
| cv-jd-matching-wizard | 2 | FakeAiService, UnconfiguredAiService |
| multi-provider-compare | 4 | FakeAiService (`failNext`) |
| infra | 2 | `PrismaService` (chỉ có in-process) |

## Hệ quả đã chấp nhận

- Gate "`pnpm test:e2e` khi đổi module graph `AppModule`" của server nay là: `pnpm start:dev` lên được + `pnpm exec
  playwright test --project=app src/tests/api` xanh (`server/.claude/CLAUDE.md`).
- Một số assert đếm cả bảng (`countRows`) như bản cũ: ghi khác vào DB dev trong lúc chạy sẽ làm chúng lệch.

## Còn trỏ về nơi cũ

Chỉ tài liệu lịch sử, cố ý không sửa: `docs/specs/*/design.md`, `plan.md`, `security-report.md`, ADR,
`docs/04-state/backlog.md` #5, và nội dung nguyên văn trong các mục `## Gom từ …`.
