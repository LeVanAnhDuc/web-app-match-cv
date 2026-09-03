# Lessons — client

## React Query: `mutate` với callback options KHÔNG chạy (2026-08-08, multi-provider-compare)

- **Triệu chứng**: card kẹt vĩnh viễn ở skeleton. Request bay đi, network trả **201**, không có console error — nhưng cả `onSuccess` lẫn `onError` đều không chạy nên state không bao giờ đổi.
- **Nguyên nhân/quy tắc**: dạng `mutation.mutate(vars, { onSuccess, onError })` không đáng tin trong codebase này. Dạng `mutateAsync` + `try/catch` thì chạy đúng (đã dùng ở `StepReview`).
- **Áp dụng**: mọi mutation trong component dùng `await mutation.mutateAsync(...)` trong hàm async, bọc `try/catch/finally`, và tự giữ cờ `running` bằng `useState` thay vì dựa `isPending`. **Unit test mock mutation nên KHÔNG bắt được lỗi này** — chỉ E2E thật mới thấy.

## Playwright `page.route`: glob chạy, regex `$` trên path cố định thì không (2026-08-08)

- **Triệu chứng**: stub không intercept, request đi thẳng ra server thật → test timeout ở trạng thái loading.
- **Quy tắc**: path cố định dùng **glob** (`"**/api/v1/match"`). Regex chỉ dùng khi có segment thay đổi (`/\/api\/v1\/ai-credentials\/[^/]+\/test$/`) — và ở đó thì regex lại **bắt buộc**, vì glob có wildcard segment cũng không match ổn định. Sai kiểu nào cũng im lặng, không báo lỗi.

## `e2e/` bị loại khỏi `tsc --noEmit` (2026-08-08)

- `tsconfig.json` có `"exclude": [... "e2e", "playwright.config.ts"]`. Thêm field vào một DTO thì fixture trong `e2e/` (vd `STUB_MATCH_RESULT`) **không đỏ type-check** nhưng render ra `undefined` lúc chạy.
- **Áp dụng**: đổi type ở `src/types/**` → grep `e2e/` tìm fixture cùng shape và sửa tay.

## `routeTree.gen.ts` luôn "modified" và chặn `git pull` (2026-08-09)

- `core.autocrlf=true` + repo **không có `.gitattributes`** → checkout ra LF, Windows ghi lại CRLF, index lệch vĩnh viễn. `git checkout --` và `git stash` đều không dứt được.
- **Áp dụng**: `git diff --numstat` rỗng ⇒ không có thay đổi thật ⇒ `git add src/routeTree.gen.ts` để refresh index rồi pull. **Đừng commit.** Fix dứt điểm là thêm `.gitattributes` (`* text=auto eol=lf`) — chưa làm vì ảnh hưởng toàn repo.

## Vitest chạy file tuần tự — cố ý (2026-08-08)

- `fileParallelism: false` trong `vitest.config.ts`. Render antd qua jsdom là CPU-bound; chạy song song thì các file bỏ đói nhau và spec form-validation/router fail `waitFor` dù pass khi chạy riêng — kể cả spec không liên quan tới thay đổi đang làm. Đừng bật lại để cho nhanh.

## Suite E2E phình to → timeout, KHÔNG phải flaky (2026-08-09, cv-version-comparison)

- **Triệu chứng**: sau khi merge, các spec **cũ** fail ở lần chạy nguội, xanh khi chạy riêng và khi chạy lại lúc cache Vite đã ấm.
- **Cách phân biệt "máy chậm" với "code hỏng"**: chạy riêng suite đó, rồi chạy lại toàn bộ lúc ấm — nếu cả hai xanh mà không đổi dòng code nào thì là ngân sách thời gian, không phải lỗi.
- **Áp dụng**: nâng timeout **kèm comment lý do**, rồi **verify đúng điều kiện đã fail** (xoá cache Vite + restart dev server + chạy nguội lại). Không dán nhãn "flaky" rồi retry cho qua.
