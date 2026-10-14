# tests/

**Trả lời câu hỏi:** kịch bản kiểm thử và kỳ vọng.

```
tests/
├── seed.spec.ts                 seed cho agent planner/generator (playwright-test MCP)
├── e2e/<module>/<topic>.e2e.ts  qua trình duyệt: luồng người dùng, message, điều hướng, trạng thái nút
├── api/<module>/<topic>.api.ts  qua HTTP: tổ hợp input, biên, bảo mật, rate limit
└── setup/<name>.setup.ts        tạo dữ liệu một lần (pnpm provision), không chạy trong lượt test thường
```

**Đặt tên:** `<module>` viết thường (`sign-in`, `billing`), `<topic>` là **chủ đề** (`password-step`, `rate-limit`),
không phải tên ticket hay branch. `e2e/infra`, `api/infra`: smoke hạ tầng, không gắn test case.

## Quy tắc

- Import **chỉ** `test`, `expect` từ `@/fixtures`; type (`Page`…) từ `@playwright/test`.
- Tên test = tiêu đề TC trong `test-cases/<module>.md`. Tag qua `{ tag: ["@TC-<MODULE>-NNN", …] }`, không viết trong tên.
- Không locator thô cho phần đã có page object/component; không `request` trần (dùng fixture `api`).
- Không `waitForTimeout`. Chờ bằng `expect(...).toBeVisible()`, `waitForURL`, `waitForResponse`.
- Mỗi test độc lập: chạy riêng được bằng `pnpm exec playwright test -g "@TC-<MODULE>-NNN"`.
- App sai so với requirement → `test.fail()` kèm comment `// BUG: defects/<module>.md#bug-<module>-nn` ngay trên.
  **Không sửa kỳ vọng cho khớp bug.**
- Fixture chỉ một file dùng → `test.extend` cục bộ đầu file đó.
- Chờ lâu (rate limit, email) → `test.describe.configure({ timeout: … })` đầu file, ghi lý do.
