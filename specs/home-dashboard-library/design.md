# Home Dashboard + Document Library — Design

> Brainstorm 2026-07-30. Feature sau MVP wizard (Roadmap ngoài #1, phục vụ UX quản lý). Đối chiếu `project-goals.md` §4 Goals (#1 nạp & lưu tái dùng per-user, #3 báo cáo UX-first, #4 cô lập per-user) + §5 Non-Goals (không auth thật — vẫn stub user). Không vi phạm Non-Goals.

## 1. Mục tiêu & Scope

Thêm **app shell (sidebar trái)** + **trang Home = dashboard thống kê** + **thư viện quản lý CV/JD đã lưu** (preview file gốc, rename, download, delete), và **đổi step 3 Review** của wizard sang render file gốc thay vì text edit.

**Core UX intent**: Home chỉ là thống kê; **nút Match CV↔JD là điểm nổi bật nhất** vì đó là core feature. Quản lý CV/JD là 2 tab ở sidebar.

### In scope
- App shell: antd `Layout` (Sider + Content) qua pathless layout route, dùng chung cho mọi trang.
- Home `/`: hero CTA Match + 4 stat cards + lịch sử match gần đây (+ empty states).
- `/cv`, `/jd`: thư viện CV/JD đã lưu — list + preview (render file gốc) + rename + download + delete.
- Step 3 Review (wizard): render CV & JD dạng file gốc read-only (bỏ edit text + logic transient-doc).
- BE: lưu binary file gốc; endpoints stream/rename/delete + list match history.
- **Responsive / multi-device**: mọi màn (shell, Home, Library, preview modal, Review) hoạt động tốt trên mobile / tablet / desktop — Sider collapse thành drawer/icon ở màn nhỏ, stat cards + list + panes reflow theo breakpoint. (Dữ liệu per-user đã server-persisted nên cùng user trên nhiều thiết bị thấy cùng CV/JD/match — không cần state cục bộ.)

### Out of scope (YAGNI / roadmap)
- Auth/SSO thật (defer — vẫn stub current-user).
- Search/filter text trong thư viện; pagination thư viện (số doc MVP nhỏ).
- Sửa nội dung parse (đã bỏ khỏi Review theo quyết định — không có nơi khác edit text).
- Batch/analytics nâng cao (chỉ counts + avg/max đơn giản).

## 2. Kiến trúc tổng thể

Đi theo **Approach A** (đã chốt): lưu binary file gốc **trong Postgres (`bytea`)**, stream qua 1 endpoint per-user; render client-side (không iframe, không dịch vụ ngoài — CV/JD là PII).

```
client (TanStack Start)                     server (NestJS)                Postgres
  _app layout (Sider)                                                      
   ├─ / Home ──────── useSavedDocuments(CV/JD), useMatchHistory ──► GET /documents?kind&saved=true
   │                                                                 GET /match
   ├─ /cv, /jd Library ── preview/rename/download/delete ─────────► GET /documents/:id/file
   │                                                                 PATCH /documents/:id
   │                                                                 DELETE /documents/:id
   └─ /wizard step3 Review ── render CV+JD file gốc ──────────────► GET /documents/:id/file
                                                                     (Document.fileData bytea)
```

## 3. Backend

### 3.1 Schema (migration `add_document_file`)
`Document` thêm 2 cột nullable:
- `fileData Bytes?` — binary PDF/DOCX gốc; `null` với doc `sourceFormat = text` (paste).
- `fileMime String?` — `application/pdf` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.

`POST /documents`: khi có file upload → lưu `fileData` + `fileMime` **bất kể `save`** (để Review step render được cả doc mới upload chưa lưu, không chỉ doc đã save). Paste-text: 2 cột `null`. **`DocumentDto` / `DocumentSummaryDto` KHÔNG kèm `fileData`** (không expose binary trong JSON; chỉ qua endpoint stream).

### 3.2 Endpoints mới (đều per-user qua `CurrentUserService.getUserId()`)

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/documents/:id/file` | Load doc theo `id` **+ userId**; 404 nếu không thuộc user. Nếu `fileData == null` (text) → 404 `documents.errors.noOriginalFile`. Set `Content-Type = fileMime`. Query `?download=1` → `Content-Disposition: attachment; filename="<title>.<ext>"`; mặc định `inline`. Trả buffer. |
| `PATCH` | `/documents/:id` | Body `{ title }` (`@IsString @MaxLength(200)`, trim, non-empty). Load per-user (404). Update `title`. Trả `DocumentDto`. |
| `DELETE` | `/documents/:id` | Load per-user (404). **Nếu tồn tại `MatchResult` tham chiếu (`cvDocumentId == id \|\| jdDocumentId == id`) → 409** `documents.errors.inUseByMatch`. Else xóa → 204. (Giữ lịch sử match nguyên vẹn, không cascade.) |
| `GET` | `/match` | List `MatchResult` của user, newest-first. Trả `MatchSummaryDto[]`: `{ id, cvTitle, jdTitle, overallScore, createdAt }` (join lấy title CV/JD). |

Không có endpoint `/stats` riêng — Home tính counts/avg/max client-side từ `GET /documents?kind=CV&saved=true`, `?kind=JD`, `GET /match`.

### 3.3 API Contract (DTO) — CHỐT
- `MatchSummaryDto`: `{ id: string, cvTitle: string, jdTitle: string, overallScore: number, createdAt: string }`.
- `UpdateDocumentDto`: `{ title: string }`.
- `GET /documents/:id/file`: binary (không phải JSON).

## 4. Frontend

### 4.1 App shell + routing
Pathless layout route `_app` bọc `<Sider>` + `<Outlet>`. Routes con: `/`, `/cv`, `/jd`, `/wizard`.

Sidebar (collapsible, Lucide icons — theo `icon-map.md`):
| Icon | EN / VI | Route | Ghi chú |
|---|---|---|---|
| `layout-dashboard` | Home / Trang chủ | `/` | |
| `sparkles` | Match CV↔JD / Ghép CV↔JD | `/wizard` | **nổi bật** (accent primary) — core |
| `file-user` | Saved CVs / CV đã lưu | `/cv` | |
| `file-text` | Saved JDs / JD đã lưu | `/jd` | |

Header Content: tên trang + toggle EN/VI + user stub (placeholder). Active state theo route. Responsive: Sider collapse icon-only ở màn nhỏ. Bám token `frontend-reference.md` + `standards.md`.

### 4.2 Home `/` (chỉ thống kê + CTA)
1. **Hero CTA** (nổi bật nhất): card lớn primary → nút "Bắt đầu Match" → `/wizard`.
2. **4 stat cards** (antd `Statistic`): CV đã lưu · JD đã lưu · Lượt match · Điểm cao nhất (%) + dòng phụ "TB: X%". Tính client-side từ 3 query.
3. **Lịch sử match gần đây**: 5 dòng mới nhất (cvTitle, jdTitle, `%` tag màu theo band, ngày format theo locale). Click → mở lại kết quả (step 4 với `matchId`). "Xem tất cả" khi >5.
4. **Empty states**: chưa match → empty-state + nút "Match ngay"; stat = 0 vẫn hiện số 0.

### 4.3 Document Library `/cv` + `/jd`
Component chung `DocumentLibrary` prop `kind`.
- List (antd `List`/`Table` responsive): title · badge định dạng (pdf/docx/text label người-đọc) · ngày (locale) · actions Preview / Rename / Download / Delete.
- Data: `useSavedDocuments(kind)` (`GET /documents?kind&saved=true`).
- **Preview** (`Modal`/`Drawer` lớn) — render **client-side, không iframe**:
  - `pdf` → **`react-pdf`** (pdf.js, render canvas; `enableScripting` off — không chạy JS trong PDF). Fetch ArrayBuffer từ `GET /documents/:id/file` (same-origin, credentials) → `<Document file={{ data }}>`.
  - `docx` → **`docx-preview`** `renderAsync(blob, container)` (parse cục bộ qua jszip → DOM).
  - `text` → render `rawText` format sạch.
  - **SSR**: cả 2 lib chỉ chạy browser → **client-only component** (dynamic import / guard `typeof window`), không render server.
- **Rename**: modal nhỏ → `PATCH /documents/:id`; optimistic + invalidate query.
- **Download**: `GET /documents/:id/file?download=1`.
- **Delete**: `Popconfirm` → `DELETE`; 409 (in-use) → `message.error` i18n rõ.
- **Empty state**: chưa có CV/JD → icon `search-x` + copy + nút "Match ngay".

### 4.4 Review step (step 3 wizard) đổi render
- Bỏ 2 `TextArea` edit + logic tạo transient-doc-khi-sửa (đơn giản hóa `StepReview.tsx`).
- 2 pane read-only render file gốc (tái dùng đúng component preview §4.3: pdf→react-pdf, docx→docx-preview, text→formatted). Trái CV / phải JD; responsive stack dọc mobile.
- Back → step 2; Run match dùng thẳng `cvDocId`/`jdDocId` → `POST /match` → step 4.

## 5. Thư viện preview (quyết định + lý do bảo mật)

Không dùng `<iframe>`/`<object>` (blob same-origin → rủi ro XSS nếu content-type bị sniff sai; browser PDF viewer có thể chạy JS nhúng). Dùng 2 lib chuyên dụng chạy 100% client-side:
- **`react-pdf`** v10.x (pdf.js Mozilla) — render canvas, tắt script nhúng, không gọi mạng ngoài.
- **`docx-preview`** v0.4.x — parse docx cục bộ → DOM, không server, không dịch vụ ngoài.

Loại các "unified doc viewer" vì nhiều lib route DOCX qua MS Office Online / Google Docs iframe → gửi PII ra ngoài (trái §7 privacy).

## 6. Error handling
- Stream file: doc không thuộc user → 404; doc text (no file) → 404 message riêng → FE fallback render text.
- Delete referenced → 409 → toast i18n; doc vẫn còn trong list.
- Rename invalid (empty/over-200) → 400 (server) + validate client trước.
- Query stats/list 5xx / network → error UI + retry; loading → skeleton.
- react-pdf / docx-preview parse lỗi → error state trong modal (không crash trang).

## 7. Testing
- **BE (Jest e2e, DB live)**: file stream per-user (user khác → 404; text doc → 404); `?download=1` header đúng; PATCH rename per-user + validate; DELETE ok (204 + file mất) / referenced (409) / user khác (404); `GET /match` chỉ match của user, đúng thứ tự + title join.
- **FE (Vitest + testing-library)**: DocumentLibrary render list/empty/actions (mock query); preview chọn đúng renderer theo format (mock lib); rename optimistic; delete 409 hiển thị lỗi; Home stat cards + recent list + empty; StepReview render pane theo format + Run match gọi mutation.
- **E2E** (dual-gate §4.3): theo Scenario Matrix §8 → expand `e2e.md` ở writing-plans.

## 8. E2E Scenario Matrix

> Rubric breadth + depth (EP/BVA/DT/ST). `Gate`: `A+B` mặc định; `A only` cho scenario mutation-heavy (gate B chỉ verify read/render, tránh contamination). Auth deferred (stub 1 user) → row 2/3 N/A ở FE; per-user isolation verify ở BE test.

| # | Category | Scenario / kết quả | Gate |
|---|---|---|---|
| 1 | **Happy path** ✅ | Home load → 4 stat cards + recent list + hero CTA hiển thị. `/cv`,`/jd` → list saved đúng kind. Preview pdf→canvas / docx→DOM / text→formatted. Rename → title đổi. Download → file tải. Delete unreferenced → biến khỏi list. Review step render CV+JD file gốc → Run match → step 4. | A+B (mutation rows→A only) |
| 2 | **AuthN** | **N/A** — auth deferred, stub current-user, không có màn login; mọi route public cho 1 user. | — |
| 3 | **AuthZ** | **N/A ở FE** — 1 role/stub user, không có UI role-gated. Per-user data isolation (doc/match user khác không thấy) enforce + test ở **BE e2e** (không reachable qua FE 1 stub user). | — |
| 4 | **Validation / expected-error** ✅ | Rename title **[EP]** classes: valid · empty(→Save disabled) · whitespace-only(→reject) · =cũ(no-op ok) · over-200(reject). **[BVA]** length `199`(accept)·`200`(accept)·`201`(reject). **[DT]** Delete × ref-state: `unreferenced`→204 · `referenced by match`→409 giữ nguyên (assert message `inUseByMatch`). Preview id không thuộc user → 404 error UI. | A only (mutations); preview-404 A+B |
| 5 | **Empty / null** ✅ | User mới: home 4 stat = `0`, best/avg = `—`; recent match → empty-state + "Match ngay". `/cv`,`/jd` rỗng → empty-state icon `search-x`. Doc text preview (no file) → hiển thị rawText, không lỗi. | A+B |
| 6 | **Boundary / pagination** ✅ | Recent match giới hạn 5 + "Xem tất cả" **[BVA]** số match `0`(empty)·`5`(hiện 5, no "xem tất cả")·`6`(hiện 5 + "Xem tất cả"). Library pagination **N/A** (MVP ít doc — ghi follow-up khi lớn). | A+B |
| 7 | **Filter / search** | **N/A** — MVP không search/filter text trong thư viện; tách CV/JD bằng route (`/cv` vs `/jd`) là điều hướng, không phải filter. Follow-up khi cần. | — |
| 8 | **Data rendering** ✅ | Badge định dạng = label người-đọc (PDF/DOCX/Text) không raw enum. Ngày format theo locale (không ISO). Score `%` + tag màu theo band **[BVA]** biên `49`(đỏ)·`50`(vàng)·`74`(vàng)·`75`(xanh). Recent list hiện cvTitle/jdTitle (không id). | A+B |
| 9 | **i18n** ✅ | Render **en + vi** cho: Home (cards, hero, recent, empty), `/cv`,`/jd` (list, actions, empty), preview modal, Review step, message lỗi delete-409 + validation. Sidebar labels 2 locale. | A+B |
| 10 | **Error / loading** ✅ | API 5xx/network trên stats/list → error UI + retry; loading → skeleton. Stream file fail (500/network) → error trong modal. react-pdf/docx-preview parse lỗi → error state (không crash). Mutation (rename/delete) lỗi → toast. | A+B |
| 11 | **Mutation safety** ✅ | **[ST]** Delete: exists→deleted→list không còn (valid); delete stale/đã xóa → 404 xử lý (invalid transition); delete referenced → 409 doc còn nguyên (invalid transition rejected). Rename optimistic + revert khi lỗi. **Error-guessing**: double-click Delete/Rename → lần 2 no-op; back-button giữa preview → đóng sạch. `afterAll` revert doc seed. | **A only** |
| 12 | **Accessibility** ✅ | Sidebar nav role/label + keyboard order + active state. Preview `Modal`/`Drawer`: focus trap, Esc đóng, focus trả về trigger. Icon-only buttons có `aria-label`. Stat cards đọc được screen-reader. | A+B |
| F1 | **Preview renderer theo format** ✅ | **[DT]** format × renderer: `pdf`→react-pdf canvas · `docx`→docx-preview DOM · `text`→formatted text · `file missing`→text fallback. Assert đúng renderer + không gọi host ngoài (`browser_network_requests` sạch). | A+B |
| F2 | **Navigation / routing** ✅ | Sidebar links điều hướng đúng; active state; deep-link `/cv`,`/jd`,`/wizard`; click 1 dòng recent match → mở lại kết quả (matchId). | A+B |
| F3 | **Responsive / multi-device** ✅ | **[BVA]** render đúng ở 3 viewport: mobile `375px` (Sider→drawer/hamburger, stat cards 1 cột, Review panes stack dọc, list row không vỡ), tablet `768px` (2 cột), desktop `1280px` (Sider mở, 4 cột). Preview modal fit màn nhỏ. Không horizontal-scroll body. | A+B |

**Completeness critic**: chạy đầy đủ ở `writing-plans` (dispatch subagent adversarial theo skill) — giai đoạn brainstorm đã fold sẵn gotchas (double-submit, back-button mid-preview, text-no-file fallback, band boundaries).

## 9. Reuse check
- Tái dùng: `documents.module`/`service`/`controller` (thêm 3 endpoint), `CurrentUserService`, `DocumentDto`/`DocumentSummaryDto`, `useSavedDocuments` (FE), `matching` module (thêm `GET /match`), component preview dùng chung giữa Library + Review step.
- Sửa: `StepReview.tsx` (bỏ edit), `__root.tsx`/routing (thêm `_app` shell), `index.tsx` (Home).
- Thêm dep FE: `react-pdf`, `docx-preview`.

## 10. Chuỗi plan đề xuất
- **Plan A — BE**: schema + migration `add_document_file`; lưu binary ở create; endpoints file/PATCH/DELETE/`GET /match`; tests.
- **Plan B — FE shell + Home**: `_app` layout + sidebar; Home dashboard + queries; empty/error/loading.
- **Plan C — FE Library + preview**: `DocumentLibrary` + preview component (react-pdf/docx-preview) + rename/download/delete.
- **Plan D — Review step**: đổi StepReview sang render; reconcile E2E (matrix ↔ e2e.md ↔ test).

(Trước Plan A: **SuperDesign step 1.5** dựng mock HTML light+dark cho Home / Library / preview / Review — user duyệt BLOCKING.)
