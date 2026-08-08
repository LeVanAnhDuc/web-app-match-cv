# E2E — `cv-version-comparison`

> §4.3 của root `.claude/CLAUDE.md`. Kịch bản gốc: `design.md` §7.
> Test: `client/e2e/cv-version-comparison/{helpers,happy-path,validation-and-data,error-and-mutation}.e2e.ts`.

## Cách chạy

Cặp server/client riêng của worktree (DB riêng `matchcv_compare` — xem "Môi trường"):

```bash
# server worktree
yarn build
PORT=5216 CLIENT_ORIGIN=http://localhost:5316 node dist/src/main.js

# client worktree
VITE_API_BASE_URL=http://localhost:5216/api/v1 yarn dev --port 5316
E2E_BASE_URL=http://localhost:5316 E2E_API_BASE=http://localhost:5216/api/v1 \
  yarn test:e2e --project=desktop
```

> **Kiểm cổng TRƯỚC khi chạy.** Lần chạy đầu dùng `:5210` và im lặng bắn vào server của một session song song (`feat/data-export`) đang giữ cổng đó — suite chạy 40 phút rồi fail hàng loạt ở những spec chẳng liên quan gì tới feature này. Không có gì trong output nói ra điều đó; triệu chứng duy nhất là `503` khi seed credential. Cách xác minh mất 2 giây:
>
> ```bash
> curl -s http://localhost:<PORT>/api/v1/docs-json | grep -o '/api/v1/comparisons[^"]*'
> ```
>
> Không thấy route của branch mình → đó là server của người khác, đổi cổng.

Toàn bộ scenario của feature này chạy bằng **route interception** (`**/api/v1/comparisons/*`, `**/api/v1/documents/*/parent`, `**/api/v1/documents?*`). Không phải vì tiết kiệm call AI — `GET /comparisons/:id` **không gọi AI** — mà vì hai lý do: (1) dựng đủ tổ hợp `delta = null` / `gapDiff` rỗng / khác model bằng dữ liệu thật sẽ cần seed hàng chục `MatchResult`; (2) một test khẳng định **không có request `POST /match*` nào bay ra** khi duyệt trang so sánh, và khẳng định đó chỉ có nghĩa khi mọi thứ khác cũng im lặng.

## Kết quả

| Gate | Trạng thái | Bằng chứng |
|---|---|---|
| **A — suite committed** | ✅ **PASS** | `--project=desktop`: **176/176 passed**, 8.2 phút. Chạy lại **sau khi merge `origin/main`** (Roadmap #8 cover letter + Roadmap #5 data export): 27 test của feature này + 149 test cũ. Xác nhận trên **cả cache Vite nguội lẫn ấm** — xem "Vòng fail → fix" vòng 4. |
| **B — MCP walk** | ⛔ **CHƯA CHẠY** | Cùng lý do đã ghi ở `specs/ai-credentials/e2e.md`, `specs/multi-provider-compare/e2e.md` và `specs/cv-rewrite-assistant/e2e.md`. Nợ kỹ thuật nay đã tích qua **4 feature liên tiếp** — nên xử lý một lần cho cả bốn thay vì lặp lại ghi chú này ở feature thứ năm. |

Kiểm thử khác cùng đợt (**sau merge**): BE unit **222 passed** (15 suite), BE e2e **137 passed** (12 suite), FE unit **163 passed** (25 file).

### Vòng fail → fix (4 vòng, không cần `e2e-bugs.md` — chỉ 1 vòng có bug thật, 1 vòng là hạ tầng)

| Vòng | Fail | Nguyên nhân | Xử lý |
|---|---|---|---|
| 1 | 6/142 — **toàn bộ đều là test MỚI**, 0 spec cũ | (a) `aria-busy` truyền vào `SectionCard` bị **nuốt** — component khai prop tường minh, không spread phần còn lại lên root; (b) click `combobox` của antd bị nhãn selection chặn hit-target; (c) `getByText("0", { exact: true })` không khớp vì số delta nằm chung node với chữ sr-only | (a) bọc skeleton trong `<div aria-busy>`; (b) helper `openSelect` click vào `.ant-select` bao ngoài (giữ nguyên mọi actionability check); (c) tách số ra `data-testid="delta-value"` |
| 2 | 3/142 | (a) assert `calls()[0]` trước khi query kịp bay; (b) hai `click()` tuần tự trên nút Save — cái thứ hai chờ một nút đã bị cái thứ nhất disable rồi gỡ khỏi DOM → timeout | (a) đổi thứ tự: assert cái render được trước; (b) dùng `dblclick()` |
| 3 | 1/142 | **Bug thật, không phải test hỏng**: `dblclick` tạo **2** `PATCH /documents/:id/parent`. `okButtonProps.disabled` dựa vào `mutation.isPending`, mà hai lần bấm nằm trong cùng một tick — React chưa kịp re-render với nút đã disable | Chốt bằng `useRef` trong `DocumentList.handleLineage` (đồng bộ, không phụ thuộc nhịp render) — cùng pattern `firedRef` của `MatchResultCard`. **Đây là giá trị mà row 11 của ma trận sinh ra để bắt.** |
| 4 *(sau merge `origin/main`)* | 6/176 — **toàn bộ là spec CŨ** của `cv-jd-matching-wizard`, không phải của feature này | **Không phải regression ngữ nghĩa.** Cả 6 chết ở `switchToPasteTab` (helper của wizard) — nó click ô Segmented "Paste text" rồi chờ textarea, có sẵn vòng retry 15s kèm comment tự nhận là để chịu cửa sổ SSR→hydration. Suite đã phình từ 142 → **176** test chạy tuần tự trên **Vite dev**, và lần visit `/wizard` đầu tiên của một run còn phải **compile chunk của route đó**. Bằng chứng phân định: chạy riêng `--grep cv-jd-matching-wizard` → **30/30 xanh**; chạy lại full suite khi module graph đã ấm → **176/176 xanh**, đúng 6 test đó không đổi một dòng code nào | **Không** dán nhãn "flaky" rồi bỏ qua — một timeout chỉ fail lúc máy nguội là đang báo cáo về cái máy, không phải về code. Nâng `timeout` của `playwright.config.ts` 30s → **60s** + nâng budget retry của helper 15s → 30s, kèm comment nêu rõ lý do. Verify bằng cách **xoá cache Vite + restart dev server** rồi chạy lại full suite: **176/176** |

**Không vòng nào fail vì một thay đổi ngữ nghĩa của spec cũ** → không có regression, và vì thế cũng không có `e2e-bugs.md` (file đó dành cho vòng lặp fail của dual-gate; ở đây gate B không chạy nên chỉ ghi lại ở bảng trên).

## Ánh xạ scenario → test

| Row (design.md §7) | Test | File |
|---|---|---|
| 1 happy (a) điểm vào từ Library | `[EP] the library offers the comparison from a CV that has a previous version` | `happy-path` |
| 1 happy (b) delta | `[EP] the delta leads, with both scores and a signed change` | `happy-path` |
| 1 happy (c) 3 nhóm gap, `persisted` có cả 2 câu | `[EP] every gap is shown verbatim, in the right bucket` | `happy-path` |
| 1 happy (d) điểm vào từ step 4 | cover ở FE unit `StepResult.test.tsx` — `offers the version comparison only when the CV came from an earlier one` (E2E của wizard cần một run thật; điều kiện hiện nút là `parentId`, đã assert ở tầng unit cho **cả hai** nhánh) | — |
| 4 validation — `:documentId` phân lớp | `[EP] a CV with no declared previous version is named, not blanked` · `[EP] an unknown CV says so instead of failing generically` | `validation-and-data` |
| 4 validation — `?jd=` phân lớp | `[EP] a stale pinned job description is reported as such` | `validation-and-data` |
| 4 validation — `[DT]` lineage modal | `[DT] the dialog cannot be submitted without changing anything` (+ tổ hợp self / khác kind / vòng cover ở BE e2e `test/comparison.e2e-spec.ts` và unit `documents.service.spec.ts` — chúng là quyết định của server, FE chỉ hiển thị lại) | `error-and-mutation` |
| 5 empty / null | `[EP] a version that was never matched gets a call to action, not zeroes` · `[EP] neither version matched at all → an empty state with a way forward` · `[EP] empty gap buckets are labelled rather than left blank` | `validation-and-data` |
| 6 boundary `[BVA]` | `[BVA] a zero delta is not dressed up as an improvement` · `[BVA] a three-generation chain reads as 2 → 3, not 1 → 2` (ngưỡng ghép gap `0.49`/`0.5` là unit test `gap-diff.spec.ts`) | `validation-and-data` |
| 7 filter / URL | `[EP] the chosen job description lives in the URL and survives a reload` · `[EP] a pinned job description is preselected when the link is opened cold` | `happy-path` |
| 8 data rendering | `[EP] gap text is rendered as text, never as markup` · `[EP] the persisting bucket renders two sentences, not [object Object]` · `[EP] a cross-model comparison is flagged instead of quietly shown` | `validation-and-data` |
| 9 i18n (en + vi) | `[i18n] the whole page renders in Vietnamese too` · `[i18n] the Vietnamese empty and error states are translated too` | `validation-and-data` |
| 10 error / loading | `[EP] a broken request shows an error, not a blank page` · `[EP] the page shows a busy state while the comparison loads` · `[ST] a rejected link keeps the dialog open and says why` | `error-and-mutation` |
| 11 mutation safety `[ST]` | `[ST] browsing a comparison never fires a match` · `[ST] a lineage link is declared, then cleared` · `[ST] a double click on Save produces exactly one write` | `error-and-mutation` |
| 12 accessibility | `[a11y] every control and every gap bucket is reachable by role and name` | `happy-path` |
| 2 AuthN · 3 AuthZ | N/A — lý do ở `design.md` §7. AuthZ cover ở BE e2e `test/comparison.e2e-spec.ts` (`[authz] another user's CV → 404`) | — |

## Reconcile suite cũ

Feature này đổi 3 thứ user nhìn thấy được ngoài trang mới:

1. **`DocumentRow`** — thêm 2 icon action ("Compare versions", "Mark as a new version of…").
2. **`MatchResultCard`** — thêm nút "Compare versions" **chỉ khi CV của kết quả có `parentId`**.
3. **`DocumentSummaryDto`** — thêm trường `parentId`.

Điểm (2) được cố ý thiết kế để **không** đụng spec cũ: mọi stub hiện có đặt `parentId: null`, nên nút không tồn tại trong DOM của chúng. Điểm (1) thì có ảnh hưởng ở tầng **FE unit** — `DocumentLibrary.test.tsx` đang đếm "the four actions" nên phải **UPDATE** (đổi tên test + thêm assert cho action mới), và `StepResult.test.tsx` phải **UPDATE** để mock `#/hooks/useDocuments` (card giờ đọc CV để biết nó có cha không). Điểm (3) buộc **UPDATE** fixture ở 4 file test có `DocumentSummaryDto`.

→ **E2E: ADD 27, UPDATE 0, REMOVE 0** *(cộng 2 file hạ tầng: `playwright.config.ts` + `cv-jd-matching-wizard/helpers.ts`, xem vòng 4 ở trên — không phải test case, là ngân sách thời gian)*. **FE unit: ADD 12, UPDATE 8, REMOVE 0.**

Điểm (2) được thiết kế đúng như dự đoán và **vẫn đúng sau khi merge Roadmap #8**: suite `cover-letter-generator` tạo tài liệu qua API thật (nên `parentId` là `null` từ DB) và **không fixture nào của nó nhắc tới `parentId`** — nút "Compare versions" đơn giản không tồn tại trong DOM của chúng. Đã kiểm lại bằng `grep -rn parentId e2e/cover-letter-generator e2e/data-export` → không có kết quả.

### Merge với `origin/main` (Roadmap #8 + #5)

Nhánh này merge (không rebase — force-push bị chặn ở môi trường này) và giải tay 7 xung đột, tất cả đều **thuần cộng thêm**:

| Repo | File | Giải thế nào |
|---|---|---|
| server | `app.module.ts` | Ba nhánh cùng thêm module vào một khối `imports`. Giữ cả ba |
| client | `constants/endpoints.ts` | Mỗi nhánh thêm key riêng. Giữ cả hai |
| client | `locales/{en,vi}/translation.json` | Gộp theo từng key bằng script, **không** sửa tay: đối chiếu 3 chiều với merge-base để chắc rằng không key nào bị đổi ở cả hai phía, rồi verify lại **0 key mất từ mỗi bên** và **en/vi cùng đúng 300 key**. Cũng kiểm ngược: **0 key mà `main` đã đổi bị nhánh này vô tình trả về giá trị cũ** |
| client | `Wizard/components/MatchResultCard` | Ba action cùng đòi chỗ trong header card — xem dưới |
| docs | `erd.md` | Giữ mệnh đề `CoverLetter` của #8 trên 2 bullet lineage/credential, gắn lại 2 bullet Goal 9. Mục "Generated content" mà #8 gộp lại **không đụng tới** |
| docs | `project-goals.md` | Hàng roadmap #7 và #8 mỗi nhánh tự đánh ✅. Giữ cả hai |

**`MatchResultCard` — nhóm 3 action, có thứ tự chủ ý.** Giữ `<Space wrap>` của #8 và xếp: hai action Goal 7 (**sinh ra** thứ mới từ report — Improve CV, Cover letter) đứng trước và luôn hiện; **Compare versions** (Goal 9 — **nhìn lại** xem CV có khá lên không) đứng cuối vì nó **có điều kiện** (`parentId != null`). Đặt cái có-điều-kiện ở cuối để lúc nó vắng mặt không đẩy hai cái luôn-hiện dịch chỗ. Đây là kết quả cân nhắc, không phải thứ tự do merge sinh ra.

## Môi trường — lưu ý cho lần chạy sau

- DB dev dùng chung (`matchcv`) đang bị nhiều session sửa migration song song, nên worktree này trỏ vào **DB riêng `matchcv_compare`** (`server/.env` + `E2E_DATABASE_URL` trong `client/.env`; cả hai đều gitignore). Sau khi merge `origin/main` phải chạy lại `npx prisma migrate deploy` — Roadmap #8 mang theo 2 migration (`add_cover_letter`, `add_timeout_test_status`). Bản thân feature này **không thêm migration nào**.
- `server/.env` của worktree cũng cần `CREDENTIAL_ENCRYPTION_KEY` — thiếu nó thì các test cũ có seed credential (`multi-provider-compare`) nhận 503.
- **`VITE_API_BASE_URL` KHÔNG được đặt trong `client/.env`** của worktree: `src/requests/__tests__/documents.test.ts` assert đúng URL mặc định `:5200`, và Vitest cũng nạp `.env`. Cổng của worktree truyền trên dòng lệnh khi chạy `yarn dev`.
