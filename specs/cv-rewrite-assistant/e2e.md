# E2E — `cv-rewrite-assistant`

> §4.3 của root `.claude/CLAUDE.md`. Kịch bản gốc: `design.md` §7.
> Test: `client/e2e/cv-rewrite-assistant/{helpers,happy-path,grounding-and-data,error-and-mutation}.e2e.ts`.

## Cách chạy

Cặp server/client riêng của worktree (DB riêng `matchcv_rewrite` — xem "Môi trường" bên dưới):

```bash
# server worktree
yarn build && node dist/src/main.js          # .env: PORT=5206, CLIENT_ORIGIN=http://localhost:5306

# client worktree
VITE_API_BASE_URL=http://localhost:5206/api/v1 yarn dev --port 5306
E2E_BASE_URL=http://localhost:5306 E2E_API_BASE=http://localhost:5206/api/v1 \
  yarn test:e2e --project=desktop
```

**Provider thật bị chặn hoàn toàn bằng route interception** — `POST /cv-rewrite` sinh một chat completion thật trên key thật, thứ một suite E2E không được phép tiêu.

## Kết quả

| Gate | Trạng thái | Bằng chứng |
|---|---|---|
| **A — suite committed** | ✅ **PASS** | `--project=desktop`: **115/115 passed** (19 test mới của feature này + 96 test cũ). Chạy lại lần 2 sau khi fix security: vẫn 115/115. |
| **B — MCP walk** | ⛔ **CHƯA CHẠY** | Cùng lý do đã ghi ở `specs/ai-credentials/e2e.md` và `specs/multi-provider-compare/e2e.md`. Nợ kỹ thuật đang tích lại qua 3 feature liên tiếp — nên xử lý một lần cho cả ba. |

Không có vòng lặp fail nào → **không có `e2e-bugs.md`**.

Kiểm thử khác cùng đợt: BE unit **130 passed**, BE e2e **100 passed** (9 suite), FE unit **131 passed** (22 file).

## Ánh xạ scenario → test

| Row (design.md §7) | Test | File |
|---|---|---|
| 1 happy (a) nút trên card kết quả | `[EP] the result card offers the rewrite assistant` | `happy-path` |
| 1 happy (d) từ match history | `[EP] reopening a match from history reaches the same entry point` | `happy-path` |
| 1 happy (b)(c) sinh → duyệt → lưu | `[EP] generate, approve some changes, save as a new CV` | `happy-path` |
| 1 happy — preview đúng tập đã tick | `[EP] the preview shows the result of exactly what is ticked` | `happy-path` |
| 4 validation / grounding | `[EP] a fabricated anchor never reaches the approval list` · `[DT] saving is blocked with nothing ticked, and no request is sent` | `grounding-and-data` |
| 5 empty / null | `[EP] an empty proposal says so instead of showing a blank list` · `[EP] a match with no gaps still opens, and says why` · `[EP] a removal is labelled as one, with no suggested-text block` | `grounding-and-data` |
| 6 boundary | `[BVA] a title over 200 characters is rejected client-side` | `grounding-and-data` |
| 8 data rendering | `[EP] CV text is rendered as text, never as markup` | `grounding-and-data` |
| 9 i18n (en + vi) | `[i18n] the whole flow renders in Vietnamese too` | `grounding-and-data` |
| 10 error / loading | `[EP] a dead provider is reported without losing the page` · `[EP] a match deleted in another tab is named, not swallowed` · `[EP] a missing match result shows an error, not a blank page` | `error-and-mutation` |
| 11 mutation safety (+ invalid transition) | `[ST] regenerating clears approvals made against the old proposal` · `[ST] a double-click on Save creates exactly one document` · `[DT] a rejected save keeps the approvals so no work is lost` | `error-and-mutation` |
| 12 accessibility | `[a11y] every control is reachable by role and name` | `happy-path` |
| 2 AuthN · 3 AuthZ · 7 filter/search | N/A — lý do ở `design.md` §7. AuthZ cover ở BE e2e `test/cv-rewrite.e2e-spec.ts` (`[authz] another user's match result → 404`) | — |

## Reconcile suite cũ

Feature này sửa 2 thứ user nhìn thấy được ngoài trang mới: **nút "Improve my CV"** trên `MatchResultCard`, và **đường mở lại một kết quả cũ** trong `StepResult` (`matchId` không kèm `runId`). Đã chạy **toàn bộ** suite desktop để kiểm: **không spec cũ nào cần sửa** — nút nằm ở vùng `extra` của `SectionCard` nên không đụng locator nào đang có, và đường `matchId` mới là **nhánh thêm**, hai đường live/reload của `multi-provider-compare` giữ nguyên hành vi (7 test của `partial-success` vẫn xanh, gồm cả case reload giữa chừng).

→ **ADD 19, UPDATE 0, REMOVE 0.** Có bổ sung 2 test vào FE unit `StepResult.test.tsx` cho nhánh `matchId` + điều kiện hiện nút.

## Môi trường — lưu ý cho lần chạy sau

DB dev dùng chung (`matchcv`) lúc đó đã mang migration của một feature song song (`add_cover_letter`) chưa có trong branch này, nên `prisma migrate dev` đòi reset — thứ sẽ xoá dữ liệu của session khác. Worktree này vì vậy trỏ vào **DB riêng `matchcv_rewrite`** (`server/.env` + `E2E_DATABASE_URL` trong `client/.env`; cả hai đều gitignore). Đây là cách nên dùng cho mọi worktree chạy song song, không phải giải pháp tình thế của riêng lần này.

`server/.env` của worktree cũng cần `CREDENTIAL_ENCRYPTION_KEY` — thiếu nó thì các test cũ có seed credential (`multi-provider-compare`) sẽ nhận 503.
