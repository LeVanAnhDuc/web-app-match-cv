# E2E — `cover-letter-generator`

> Gate A của §4.3 (root `.claude/CLAUDE.md`). Test ở `client/e2e/cover-letter-generator/`.
> Matrix gốc: `design.md` §8.

## Cách chạy

Ports **riêng** để không đụng worktree khác đang chạy song song:

```bash
# server (từ server worktree, đã `yarn build`)
PORT=5208 CLIENT_ORIGIN=http://localhost:5308 node dist/src/main.js

# client (từ client worktree)
VITE_API_BASE_URL=http://localhost:5208/api/v1 yarn dev --port 5308

# suite
E2E_BASE_URL=http://localhost:5308 E2E_API_BASE=http://localhost:5208/api/v1 \
  yarn test:e2e --project=desktop
```

## Kết quả

| Lần chạy | Phạm vi | Kết quả |
|---|---|---|
| 2026-08-09 | `e2e/cover-letter-generator` (desktop) | **28/28 PASS** |
| 2026-08-09 | **toàn bộ** project `desktop` | **124/124 PASS** — không có hồi quy lên spec cũ |
| 2026-08-09 *(sau khi merge `cv-rewrite-assistant`)* | **toàn bộ** project `desktop` | **143/143 PASS** — 28 của feature này + 19 của 7a + 96 sẵn có. **Không phải reconcile spec nào**: hai feature đụng cùng một component (`MatchResultCard`) nhưng ở hai chỗ khác nhau, và việc gộp 2 nút vào cùng header không phá selector nào của 7a (test của họ tra theo tên nút, không theo vị trí) |

**Gate B (MCP walk) KHÔNG chạy ở lượt này** — cùng lý do đã ghi ở `specs/ai-credentials/e2e.md` và `specs/multi-provider-compare/e2e.md`: session này chạy tự động tới bước tạo PR, không có người lái browser để đối chiếu bằng chứng thị giác. §4.3 vì thế **chưa đóng trọn vẹn**; gate A xanh là bằng chứng duy nhất đang có.

## Ánh xạ scenario → test

| Row (design §8) | File | Test |
|---|---|---|
| 1 Happy path | `happy-path.e2e.ts` | `[1a]` nút → modal · `[1b]` sinh → ô sửa + 1 dòng lịch sử · `[1c]` **bản 2 không đè bản 1**, chuyển qua lại giữ đúng nội dung · `[1d]` copy + tải `.txt` · `[1e]` không có nút khi chưa có kết quả |
| 2 AuthN | — | **N/A** — chưa có auth (`project-goals.md` §3) |
| 3 AuthZ | *(BE)* `server/test/cover-letters.e2e-spec.ts` | `[authz]` match/letter của user khác → `[]` / 404, không bao giờ 403 |
| 4 Validation | `validation-and-boundary.e2e.ts` | `[EP]` content rỗng / chỉ khoảng trắng → Save disabled, **0 request**. **[DT] không chạy được ở FE** — xem ghi chú bên dưới |
| 5 Empty / null | `data-and-empty.e2e.ts` | empty state · `omittedRequirements` rỗng → khối **ẩn hẳn** · bản `failed` là trạng thái lỗi, **không** phải thư trắng |
| 6 Boundary | `validation-and-boundary.e2e.ts` | `[BVA]` content `0`/`1`/`20_000` (ô tự cap) · số bản `0`/`1`/`2` |
| 7 Filter / search | — | **N/A** — modal không có filter/sort; thứ tự cố định `createdAt desc` |
| 8 Data rendering | `data-and-empty.e2e.ts` | enum → nhãn người đọc · `content` **plain text** (`**bold**` nguyên văn, không có phần tử `<b>`) · `omittedRequirements` liệt kê đủ · **DOM không chứa key gốc** |
| 9 i18n | `i18n.e2e.ts` | `en` + `vi` đủ nhãn · `errorCode` dịch, không raw · **ngôn ngữ UI ≠ ngôn ngữ lá thư** |
| 10 Error / loading | `error-and-loading.e2e.ts` | provider lỗi → row `failed` + Try again · `GET` 500 → error UI · `PATCH` 500 **giữ nguyên text đang gõ** · `aria-busy` khi đang sinh |
| 11 Mutation safety | `mutation-and-a11y.e2e.ts` | `[ST]` sinh → sửa+lưu (`Edited`) → sinh mới (bản cũ còn nguyên) → xoá · **[ST invalid]** xoá bản đang mở → editor nhả ra, **không** PATCH lên id đã chết · double-click Generate → **đúng 1** POST |
| 12 Accessibility | `mutation-and-a11y.e2e.ts` | 3 nhóm tuỳ chọn có accessible name · ô soạn có label · `Esc` đóng modal, nút mở lại còn đó |

### Ghi chú — row 4 `[DT]` chuyển xuống BE

Hai cặp Decision Table của row 4 (*match `failed` + credential của người khác* và *match hợp lệ + credential của người khác*) **không dựng được từ trình duyệt**: nút vào chỉ tồn tại trên card `succeeded`, và không tạo được user thứ hai qua UI khi app chạy bằng mock user. Chúng được cover ở `server/test/cover-letters.e2e-spec.ts`:

- `[DT] failed match + someone else's credential` → **400 của match thắng**, không row nào được tạo (ngữ cảnh được kiểm tra trước khi phân giải credential);
- `[DT] valid match + someone else's credential` → **404**, không row nào được tạo.

Đây là chuyển tầng có chủ ý, không phải bỏ sót.

### Ghi chú — điểm vào sau khi 7a merge

Nút mở modal nằm ở **header của card kết quả**, cạnh nút "Improve CV" của Goal 7a — hai hành động anh em của cùng một report thì đứng cùng chỗ. Vì card này cũng là card render khi mở lại một match từ Home (7a đã sửa regression *"No run to show"*), **điểm vào từ match history giờ có sẵn**, không còn là thứ phải hoãn cùng trang `/history`.

## Bẫy đã gặp (ghi lại để lần sau khỏi mất thời gian)

1. **antd `Segmented` giấu radio thật** (`opacity: 0`) — `getByRole("radio")` thấy element nhưng `toBeVisible()`/`click()` fail. Phải click `.ant-segmented-item` theo text. Cùng bài học `switchToPasteTab` trong `cv-jd-matching-wizard/helpers.ts`.
2. **`name:` của Playwright là SUBSTRING, không exact** — nút xoá có `aria-label="Delete draft: Formal · Standard · English"` nên `getByRole("button", { name: "Formal · Standard · English" })` khớp **2** phần tử. Dùng `exact: true` (helper `draftRow` / `deleteDraftButton`).
3. **`getByLabel("Draft")` cũng dính nút xoá** vì "Delete **draft**: …" chứa "draft" (không phân biệt hoa thường) → luôn `{ exact: true }`.
4. **`getByText` mặc định cũng là substring không phân biệt hoa thường** — `"friendly · short · vi"` là substring của `"Friendly · Short · Vietnamese"`, nên assertion "không render enum thô" phải `{ exact: true }` mới có nghĩa.
5. **`Escape` phải bấm trên phần tử BÊN TRONG modal** để bubble tới wrapper antd nghe; `page.keyboard.press("Escape")` rơi vào document và modal không đóng.
6. **Route stub dùng GLOB** `**/api/v1/cover-letters**` — regex neo `$` trên path cố định không intercept được (bài học đã ghi từ trước).
7. **`CoverLetterModal` chỉ mount khi mở** — nếu mount sẵn ở trạng thái đóng, mỗi card kết quả sẽ tự bắn một query danh sách bản nháp, và unit test của `StepResult` vỡ vì thiếu `QueryClientProvider`.

## Dọn dẹp

`resetLetters()` xoá theo đúng thứ tự FK: `CoverLetter` → `MatchResult` → `MatchRun`; `cleanDocuments()` (dùng chung) dọn `Document`. DB dev dùng chung với session khác nên chỉ xoá các bảng feature này đụng tới.
