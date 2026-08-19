# Design — `multi-provider-compare` (Roadmap #9, Goal 6b)

> Brainstorm 2026-08-08. Nửa còn lại của Goal 6; nửa đầu (`ai-credentials`, Roadmap #4) **đã merge**.
> Tiền đề đã có sẵn: `PROVIDERS` là dữ liệu, `AiRuntimeConfig` dựng per-request, `MatchResult` đã snapshot `provider`/`chatModel`/`embedModel`. Xem `specs/ai-credentials/design.md` §10.

## 1. Vấn đề & phạm vi

Hôm nay một lần bấm "Run match" chạy **đúng một** provider. User có 3 credential thì không có cách nào biết OpenRouter chấm khác Gemini ra sao — mà đó chính là lý do họ cắm nhiều key.

Feature này cho chọn **nhiều** credential ở step 3, chạy song song, và hiện kết quả **ngay khi từng cái xong**.

### Trong phạm vi

- Bảng `MatchRun` + `MatchResult.runId` / `status` / `errorCode` (3 cột 📝 còn lại của ERD).
- `POST /match/runs` tạo run; `POST /match` nhận `runId`.
- **Thất bại của provider được lưu thành row**, không còn ném 503 (xem D3 — đây là **đổi hợp đồng API**).
- `GET /match/runs/:id` đọc lại một run + toàn bộ result của nó.
- Step 3: chọn **nhiều** credential (checkbox list) thay cho một dropdown.
- Step 4: N card, progressive reveal, partial success.

### Ngoài phạm vi (cố ý)

| Hoãn | Lý do |
|---|---|
| Queue / stream / polling | ADR #11 chốt: N request độc lập từ FE. Không có gì cần điều phối phía server. |
| So sánh **giữa các card** (bảng delta, "provider nào chấm cao nhất") | Đọc N card cạnh nhau đã đủ trả lời câu hỏi. Bảng so sánh là feature riêng nếu thực sự thiếu. |
| Chạy lại **một** card lỗi mà không chạy lại cả run | Thêm trạng thái mà giá trị thấp: bấm Back → Run match lại là đủ. |
| Batch ranking nhiều CV | Roadmap #11, cần pgvector. |
| Nhật ký tiết lộ dữ liệu | Goal 10 / Roadmap #5, cố ý **độc lập** với feature này (ADR #16). |

## 2. Quyết định thiết kế

| # | Quyết định | Lý do |
|---|---|---|
| D1 | **Không cap số provider mỗi lần chạy** | Đây là open question §12. User chọn tường minh từng cái; một con số chặn tuỳ tiện là giới hạn giả. Thay vào đó nút CTA **nói rõ số lượng** ("Run match · 3 providers") và thông báo quyền riêng tư **liệt kê đủ tên** provider sẽ nhận CV/JD. Cost 3N call là điều user phải **thấy**, không phải điều hệ thống quyết hộ. |
| D2 | **Luôn tạo `MatchRun`, kể cả N=1** | Giữ đúng một hình dạng dữ liệu. Nếu N=1 không có run thì step 4 phải xử lý 2 nguồn (`matchId` rời và `runId`), và `unfinished-features` #4 (so sánh 2 lần match) sau này lại phải vá. |
| D3 | **Provider lỗi → lưu row `status=failed` + `errorCode`, HTTP 201** — không còn 503 | Với N provider, một cái chết **không được** làm hỏng cả request. Card lỗi cần một thứ để hiển thị, và refresh giữa chừng phải thấy được cái nào đã fail. **Đây là đổi hợp đồng**: `POST /match` trước đây ném 503 khi provider lỗi. 503 **vẫn giữ** cho lỗi *cấu hình* (thiếu key hệ thống, thiếu khoá mã hoá) — đó là lỗi của hệ thống, không phải kết quả của một lần chạy. |
| D4 | Step 3 dùng **checkbox list**, không phải `Select mode="multiple"` | Mỗi dòng cần badge provider + label + `••••1234` + chấm trạng thái test. Nhồi ngần đó vào tag của multi-select thì chật và mất trạng thái. Checkbox list cũng khớp mô hình "mỗi lựa chọn → một card" ở step 4. |
| D5 | Step 4 = N card, **report gập lại khi N>1** | Ba báo cáo dài mở hết thì phải cuộn qua cả trang mới so được điểm. Điểm + breakdown luôn hiện; `strengths`/`gaps`/`suggestions` nằm trong `Collapse`, mở sẵn khi N=1 để **N=1 trông đúng như hôm nay**. |
| D6 | Mỗi card **tự bắn request của nó** khi mount | Progressive reveal có sẵn, không cần điều phối: card nào resolve trước thì render trước. Không polling, đúng ADR #11. |
| D7 | Reload giữa lúc chạy → step 4 **chỉ đọc `GET /match/runs/:id`**, không bắn lại | Store zustand là in-memory nên reload mất `pendingCredentialIds`; không có nó thì không có gì để bắn. Run sẽ có ít result hơn số provider đã chọn — `erd.md` đã ghi đó là **hành vi đúng**, và nó tránh việc reload nhân đôi chi phí AI. |

## 3. Backend

### 3.1 Schema — migration `add_match_run`

```prisma
enum MatchStatus {
  succeeded
  failed
}

model MatchRun {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cvDocumentId String
  cvDocument   Document @relation("MatchRunCvDocument", fields: [cvDocumentId], references: [id])
  jdDocumentId String
  jdDocument   Document @relation("MatchRunJdDocument", fields: [jdDocumentId], references: [id])
  createdAt    DateTime @default(now())

  results MatchResult[]

  @@index([userId])
}
```

`MatchResult` thêm:

```prisma
  runId     String?
  run       MatchRun?    @relation(fields: [runId], references: [id], onDelete: Cascade)
  status    MatchStatus  @default(succeeded)
  errorCode String?
```

- `runId` **nullable**: mọi row tạo trước feature này không thuộc run nào. `ON DELETE CASCADE` — xoá run thì kết quả của nó đi theo (khác `credentialId` là `SET NULL`, vì credential là thứ *bên ngoài* kết quả còn run là thứ *chứa* nó).
- `status` có `@default(succeeded)` để backfill row cũ; **giữ default** (khác migration trước) vì `succeeded` là trạng thái đúng cho mọi row đã tồn tại và cho đường ghi thành công.
- `errorCode` — chỉ `invalid_key` | `no_quota` | `model_unavailable` | `timeout` | `unreachable`. **Không bao giờ chứa message thô của provider** (rủi ro rò rỉ key, đúng bất biến §5.3 của `ai-credentials`).

### 3.2 API

| Verb | Path | Body | Trả về |
|---|---|---|---|
| `POST` | `/match/runs` | `{ cvDocumentId, jdDocumentId }` | `201 MatchRunDto` |
| `GET` | `/match/runs/:id` | — | `MatchRunDetailDto` = run + `results: MatchResultDto[]` |
| `POST` | `/match` | **+ `runId?`** | `201 MatchResultDto` (kèm `status`, `errorCode`) |

**Thứ tự khai báo route**: `GET /match/runs/:id` phải đứng **trước** `GET /match/:id`, nếu không `runs` bị nuốt thành `:id` và `ParseUUIDPipe` trả 400 — đúng bài học của `GET /ai-credentials/providers`.

`MatchResultDto` thêm `runId: string | null`, `status: MatchStatus`, `errorCode: string | null`.

### 3.3 Luồng `createMatch` sau khi đổi

```ts
// ownership + kind check giữ nguyên, vẫn ném 400/404 như cũ
// runId (nếu có) phải thuộc user và trỏ đúng cặp document — nếu không, 400.

const runtime = dto.credentialId
  ? await this.credentials.getRuntimeConfig(dto.credentialId)   // 404 nếu không thuộc user
  : this.ai.systemRuntimeConfig();                              // 503 nếu chưa cấu hình

try {
  const result = await this.run(cvDoc.rawText, jdDoc.rawText, runtime);
  created = await this.prisma.matchResult.create({ data: { ...result, status: "succeeded", ... } });
} catch (error) {
  // Provider hỏng KHÔNG phải lỗi của request. Ghi lại để card có thứ để hiện
  // và để reload thấy được cái nào fail.
  created = await this.prisma.matchResult.create({
    data: { status: "failed", errorCode: classify(error),
            overallScore: 0, semanticScore: 0, keywordScore: 0,
            report: { strengths: [], gaps: [], suggestions: [] }, ... }
  });
}
```

`classify(error)` dùng lại `mapProviderError` đã có ở `ai.service.ts`, cộng nhánh `timeout`. Muốn vậy `AiService.embed`/`generateReport` phải **ném lỗi phân biệt được** thay vì nuốt thành 503 chung. Cách ít xâm lấn nhất: thêm `AiProviderError` (class nội bộ, mang `AiTestStatus`) — `embed`/`generateReport` ném nó; `MatchingService` bắt và map; nếu không ai bắt thì filter toàn cục vẫn cho ra 503 như cũ nên **đường single-provider cũ không đổi hành vi với lỗi cấu hình**.

## 4. Frontend

```
src/views/Wizard/components/RunWithSelector/     SỬA → multi-select (checkbox list)
src/views/Wizard/mains/StepResult/               SỬA → N card
src/views/Wizard/components/MatchResultCard/     MỚI — 1 kết quả: skeleton | result | error
src/requests/match.ts                            + createMatchRun, fetchMatchRun
src/hooks/useMatch.ts                            + useCreateMatchRun, useMatchRun
src/stores/slices/wizard.ts                      credentialId → credentialIds[]; + runId, pendingCredentialIds
src/types/Matching/index.ts                      + MatchRunDto, MatchStatus, runId/status/errorCode
```

**Step 3** — khối "Run with" thành danh sách checkbox: mỗi credential một dòng (badge provider · label · `••••1234` · chip trạng thái), cộng dòng "System key". Ít nhất một dòng phải được chọn — bỏ hết thì nút Run match disabled. Mặc định chọn credential `lastUsedAt` mới nhất, hoặc "System key" khi chưa có credential nào. CTA hiện số lượng; thông báo quyền riêng tư liệt kê **đủ tên** provider sẽ nhận tài liệu.

**Step 4** — `Run match` gọi `POST /match/runs` trước, lưu `runId` + `pendingCredentialIds` vào store rồi sang step 4 **ngay**. Mỗi `MatchResultCard` nhận một `credentialId | null`, tự bắn `POST /match { runId, credentialId }` khi mount, và tự render skeleton → kết quả hoặc lỗi. Card lỗi hiện `errorCode` dịch sang câu người đọc được, kèm nút "Try again" chạy lại **card đó**. Không có `pendingCredentialIds` (reload) → step 4 đọc `GET /match/runs/:id` và render những gì đã có.

## 5. E2E Scenario Matrix

| # | Category | Trạng thái | Scenario + giá trị dẫn xuất | Gate |
|---|---|---|---|---|
| 1 | Happy path | ✅ | (a) chọn 1 credential → step 4 hiện đúng 1 card, report mở sẵn, giống hành vi hôm nay. (b) chọn 2 credential + system key → 3 card, mỗi card đúng tên provider của nó. (c) card xong trước hiện kết quả trong khi card khác còn skeleton. | (a)(b) A+B · (c) A only |
| 2 | AuthN | N/A | Chưa có auth (`project-goals.md` §3). Thành ✅ ở Roadmap #10. | — |
| 3 | AuthZ | N/A ở FE | `runId` của user khác → 400/404; chỉ BE e2e dựng được user thứ hai. | — |
| 4 | Validation | ✅ | **[EP]** số lựa chọn: `0` (nút disabled, không request nào) · `1` · `n>1`. **[DT]** `runId hợp lệ + credentialId của người khác` → 404 và **không** tạo result; `runId của người khác + credentialId hợp lệ` → 400; `runId trỏ cặp document khác` → 400. | A only |
| 5 | Empty / null | ✅ | Run chưa có result nào (reload ngay sau khi tạo) → step 4 hiện trạng thái rỗng có nghĩa, không phải màn trắng. Card lỗi: `overallScore` 0 **không** được vẽ như "0% match" mà là trạng thái lỗi. | A+B |
| 6 | Boundary | ✅ | **[BVA]** số provider `0` (chặn) · `1` (biên dưới hợp lệ, report mở sẵn) · `2` (biên bật chế độ gập) · `3` (= toàn bộ whitelist). Không phân trang → phần pagination **N/A**. | A only |
| 7 | Filter / search | N/A | Step 4 không có filter/sort; thứ tự card = thứ tự user chọn, cố định. | — |
| 8 | Data rendering | ✅ | Mỗi card nêu **provider + model của chính nó** (đọc từ result row, không từ danh sách credential). `errorCode` enum → câu người đọc được, không phải `no_quota`. Điểm hiện `%`. **Assert DOM không chứa key gốc.** | A+B |
| 9 | i18n | ✅ | `en` + `vi` cho: nhãn checkbox list, CTA có số đếm, thông báo quyền riêng tư nhiều provider, tiêu đề card, **cả 5 thông điệp `errorCode`**, nút Try again, trạng thái rỗng. | A+B |
| 10 | Error / loading | ✅ | Partial success: 1 trong 3 card lỗi → 2 card kia **giữ nguyên kết quả**. `POST /match/runs` lỗi → ở lại step 3 kèm alert, không sang step 4 rỗng. Skeleton hiện khi card đang chạy. `GET /match/runs/:id` 500 → error UI. | A+B (route interception) |
| 11 | Mutation safety | ✅ | **[ST]** `tạo run` → `card đang chạy` → `xong/lỗi` → `Try again trên card lỗi` → card đó chạy lại, **các card khác không bị bắn lại**. **Invalid transition (bắt buộc)**: reload giữa lúc chạy → **không** bắn lại request nào, chỉ đọc run (assert số POST `/match` = 0 sau reload). Bấm Run match 2 lần nhanh → chỉ 1 run được tạo. | A only |
| 12 | Accessibility | ✅ | Checkbox list là `role="group"` có accessible name; mỗi checkbox chọn được bằng bàn phím và có nhãn liên kết. Card đang chạy có `aria-busy`. Vùng kết quả `aria-live="polite"` để screen reader biết card vừa xong. Thứ tự tab: danh sách → Run match. | A+B |

**Error-guessing pass** (inline): thêm vào matrix — reload giữa chừng (row 11), bấm Run match hai lần (row 11), card lỗi vẽ nhầm thành 0% (row 5), và thứ tự card phải ổn định để so sánh (row 7).

## 6. Kiểm thử

**BE unit** — `matching.service.spec`: provider lỗi → tạo row `failed` + `errorCode` đúng, **không** ném; `runId` không thuộc user → 400; `runId` trỏ cặp document khác → 400; N result cùng `runId` phân biệt bằng `provider`.
**BE e2e** — `test/match-runs.e2e-spec.ts`: tạo run → chạy 2 provider → `GET /match/runs/:id` trả đúng 2 result; ownership 404/400; run của user khác không đọc được; row cũ (`runId = null`) vẫn đọc được qua `GET /match/:id`.
**FE unit** — `RunWithSelector` (chọn/bỏ chọn, chặn rỗng, mặc định), `MatchResultCard` (3 trạng thái), `StepResult` (N card, chế độ gập theo N).
**FE E2E** — một test cho mỗi row ✅ ở §5, tại `client/e2e/multi-provider-compare/`. Provider thật chặn bằng route interception.

## 7. Thay đổi ngoài code

- `docs/erd.md` — `MatchRun` + 3 cột bỏ dấu 📝.
- `docs/project-goals.md` — §12 xoá open question "cap số provider" (đã chốt D1); Roadmap #9 đổi trạng thái; Goal 6 thành ✅ trọn vẹn.
- `server/README.md` — 2 endpoint mới + **đổi hợp đồng D3** (provider lỗi không còn 503).
- `docs/unfinished-features.md` — #4 ("so sánh 2 lần match") giờ có `MatchRun` làm nền, ghi chú lại.
