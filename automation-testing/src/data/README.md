# data/

**Trả lời câu hỏi:** test dùng **giá trị** gì?

| File | Nội dung |
|---|---|
| `copy.ts` | Text UI và message server, **đọc lúc chạy từ file locale thật của app** (không chép tay) |
| `test-data/shared.ts` | Dùng ở nhiều module: `randomEmail()`, `uniqueSuffix()`, `FILES.pdf` / `FILES.docx` |
| `test-data/<module>.ts` | Giá trị riêng một module (input mẫu, body stub AI) — xem `test-data/README.md` |
| `test-data.ts` | Chỉ re-export `test-data/shared.ts` (import cũ) |
| `files/` | File mẫu để upload: `sample.pdf`, `sample.docx` |

## `copy.ts`

| Hàm | Nguồn | Ví dụ |
|---|---|---|
| `t(key, lng = "en", vars?)` | `../client/src/locales/<lng>/translation.json` | `t("nav.home")`, `t("auth.quota.left", "vi", { left: 2, limit: 3 })` |
| `serverMessage(key, lng = "en", vars?)` | `../server/src/i18n/<lng>/<file>.json`, key = `<file>.<path>` | `serverMessage("documents.errors.notFound", "vi")` |
| `tAll(key, vars?)` | như `t`, trả `{ en, vi }` | |

- Key được type từ file **en** (`CopyKey`, `ServerKey`): gõ sai hoặc key bị xóa khỏi app là lỗi `pnpm typecheck`.
- `t` theo i18next: nội suy `{{var}}`, số nhiều `_one` / `_other` chọn bằng `vars.count` (key truyền là phần gốc,
  vd `t("rewrite.changes.selectedCount", "en", { count: 3 })`); thiếu ở `vi` thì rơi về `en` như `fallbackLng` của app.
- `serverMessage` theo nestjs-i18n: nội suy `{var}`; server chọn ngôn ngữ theo `?lang=` rồi `Accept-Language`
  (`api.lang("vi")`).
- Key không có ở đâu cả → ném lỗi (lỗi của test, không phải bug app).

## Quy tắc

- Spec không viết chuỗi assert trực tiếp: lấy từ `t` / `serverMessage`. UI đổi chữ → test tự theo.
- Chuỗi không nằm trong file locale (vd text cứng trong code app) → hằng số trong `test-data/<module>.ts`, comment
  đường dẫn file nguồn ngay trên.
- Chỉ giá trị: không đọc `.env`, không gọi mạng, không biết ENV (cần thì → `config/`). Đọc file locale/mẫu là được.
- Dữ liệu sinh ngẫu nhiên phải duy nhất mỗi lần gọi để test không đụng nhau.

**Import được:** `utils/`, type `#/types/*`. Không import gì khác trong `src/`.
