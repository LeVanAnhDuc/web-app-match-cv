# E2E — `multi-provider-compare`

> Gate A chạy 2026-08-08: **96/96 pass** (`--project=desktop`) — 18 test mới + 78 test có sẵn.
> Suite ở `client/e2e/multi-provider-compare/`. Kịch bản gốc: `design.md` §5.

## Cách chạy

```bash
# server (từ server/.worktrees/multi-provider-compare, sau yarn build)
PORT=5204 CLIENT_ORIGIN=http://localhost:5304 node dist/src/main.js

# client
VITE_API_BASE_URL=http://localhost:5204/api/v1 yarn dev --port 5304

E2E_BASE_URL=http://localhost:5304 E2E_API_BASE=http://localhost:5204/api/v1 \
  yarn test:e2e --project=desktop
```

## Nguyên tắc

- **Không gọi provider thật.** `stubMatches(page, script)` trả lời `POST /match` theo **kịch bản có thứ tự**, nên một test đặt được lỗi vào đúng vị trí mong muốn — điều kiện cần để kiểm tra partial success.
- **Glob cho path cố định** (`**/api/v1/match`), regex chỉ khi có segment thay đổi. Bài học từ suite `ai-credentials` là dạng nào cũng có chỗ hỏng: ở đây regex `\/api\/v1\/match$` **không** intercept, glob thì có.
- `resetRunsAndCredentials()` xoá `MatchResult` → `MatchRun` → `AiCredential`, đúng thứ tự FK.

## Ánh xạ Matrix → test

| Row | Category | File · test | Gate | Kết quả |
|---|---|---|---|---|
| 1a | Happy — N=1 | `happy-path` · *[BVA 1] a single provider still looks like a normal result* | A+B | ✅ |
| 1b | Happy — N=2 | `happy-path` · *[BVA 2] two providers give two cards, each naming its own model* | A+B | ✅ |
| 1c | Happy — progressive reveal | `happy-path` · *a fast provider renders while a slow one is still a skeleton* | A only | ✅ |
| 2 | AuthN | — | — | **N/A** — chưa có auth (`project-goals.md` §3). |
| 3 | AuthZ | `server/test/match-runs.e2e-spec.ts` › *[DT] a runId that is not yours → 404* | — | **N/A ở FE** — chỉ một mock user tồn tại; cover ở BE e2e. |
| 4 | Validation `[EP]` `[DT]` | `selection-and-a11y` · *[BVA 0] unticking everything…*; `partial-success` · *[DT] a rejected match request surfaces on its own card only* | A only | ✅ |
| 5 | Empty / null | `partial-success` · *[EP] a failed card is never drawn as a 0% score*, *a run whose results are gone…* | A+B | ✅ |
| 6 | Boundary `[BVA]` | `selection-and-a11y` · *0 providers*; `happy-path` · *1 provider*, *2 providers* | A only | ✅ |
| 7 | Filter / search | — | — | **N/A** — step 4 không filter/sort; thứ tự card = thứ tự chọn, cố định. |
| 8 | Data rendering | `happy-path` · *each naming its own model* (đọc từ result row, không từ danh sách credential) | A+B | ✅ |
| 9 | i18n | `selection-and-a11y` · 2 test (`en` + `vi`), phủ cả 5 thông điệp `errorCode` và thông báo quyền riêng tư nhiều provider | A+B | ✅ |
| 10 | Error / loading | `partial-success` · *one dead provider leaves the others intact*, *failing to open the run keeps the user on step 3* | A+B | ✅ |
| 11 | Mutation safety `[ST]` | `partial-success` · *Try again re-runs only the card that failed*, *reloading mid-run reads the run instead of firing again* | A only | ✅ |
| 12 | Accessibility | `selection-and-a11y` · *named group of keyboard checkboxes*, *results region announces politely* | A+B | ✅ |

**`[ST]` invalid transition** (bắt buộc): reload giữa lúc chạy → đếm `POST /match` sau reload phải bằng **0**. Bắn lại sẽ âm thầm nhân đôi chi phí AI.

## Ba lỗi thật suite này bắt được

1. **Card kẹt vĩnh viễn ở skeleton.** `runMatch.mutate(vars, { onSuccess, onError })` gửi request, nhận 201, nhưng **không callback nào chạy** nên state không bao giờ đổi. Chuyển sang `mutateAsync` + try/catch — dạng đã chạy đúng ở `StepReview`. Nếu chỉ có unit test (mutate được mock) thì lỗi này lọt hoàn toàn.
2. **Không bỏ chọn hết được.** Effect của `RunWithSelector` tự khôi phục mặc định mỗi khi selection rỗng, mâu thuẫn với chính trạng thái "chọn ít nhất một key" của step. Giờ seed **đúng một lần**; sau đó effect chỉ loại id đã biến mất.
3. **`db-cleanup` vỡ toàn bộ e2e cũ.** `MatchRun` cũng trỏ `Document` với `RESTRICT`, nên xoá document trước khi xoá run là FK violation → `globalSetup` chết → cả suite chết.

## Reconcile suite cũ (không phải append)

Behavior đổi nên 3 artifact của feature trước phải sửa theo, không được để nguyên:

- `ai-credentials/happy-path` + `data-and-empty` — step 3 `Select` → checkbox group; thông báo quyền riêng tư đổi câu; attribution ở step 4 chuyển vào **tiêu đề từng card**.
- `ai-credentials/error-and-loading` — credential vừa bị xoá **không còn** chặn wizard ở step 3; nó fail trên **card của chính nó** ở step 4, kèm nút Try again. Đó chính là ý nghĩa của partial success.
- `cv-jd-matching-wizard/responsive` — step 4 từ "một card có sticky footer" thành "danh sách card cuộn được + footer bên dưới"; "reachable" giờ nghĩa là cuộn tới được, vì ghim footer phía trên N card tốn nhiều chỗ hơn là được.
- `cv-jd-matching-wizard/helpers` — `STUB_MATCH_RESULT` thêm `runId`/`status`/`errorCode`.

## Gate B (MCP walk) — chưa chạy

Phiên này chạy dưới chỉ thị **không dùng Agent tool**, nên gate B **chưa thực hiện**. §4.3 đòi cả hai gate xanh, nên đây là **khoảng trống có chủ ý**, ghi lại để không đọc thành "đã cover". Các row `A+B` đều đã được gate A assert qua accessibility tree (`getByRole`/`getByLabel`) và ở cả 2 locale; phần gate B thêm được là console error, network fail và cảm nhận thị giác.
