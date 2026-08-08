# Security review — `cv-version-comparison` (Roadmap #7, Goal 9)

> §4.5 của root `.claude/CLAUDE.md`. Chạy 2026-08-09 bằng **security-audit subagent** (slash `/security-review` chấm diff của cwd, còn thay đổi của feature này nằm trong 2 worktree riêng), rà theo `server/.claude/skills/standard-security` + `standard-restful-api` + `standard-prisma` + rule `services` (mọi query phải scope `userId`), và `client/.claude/skills/standard-security`.

**Bề mặt tấn công mới**: `GET /comparisons/:documentId?jdDocumentId=` · `PATCH /documents/:id/parent` · `DocumentSummaryDto.parentId` · trang FE `/compare/$documentId` (render gap do LLM viết) · `LineageModal`.

## Verdict

| Lần | Verdict | Ghi chú |
|---|---|---|
| 1 (rà đầu) | ⚠️ **CONDITIONAL** | 1 MEDIUM (M1) là điều kiện chặn |
| 2 (sau fix) | ✅ **PASS** | M1 đã fix + có regression test; L3/L4/L5 fix kèm; L1/L2 chấp nhận có lý do |

## Findings

### 🔴 CRITICAL / 🟠 HIGH — không có

Rà từng lời gọi Prisma mới: `comparison.service.ts` (4 chỗ) và `documents.service.ts` (3 chỗ) đều scope `userId` lấy từ `CurrentUserService`. Không có `$queryRaw`, không có secret/ciphertext/`rawText`/`fileData` trong response mới, không có `dangerouslySetInnerHTML` ở FE.

### 🟡 M1 — Cửa chặn vòng lineage **bypass được** với chuỗi dài hơn 20 · **ĐÃ FIX**

`documents.service.ts` — `loadAncestors()` dừng sau `MAX_LINEAGE_DEPTH = 20` row, và `wouldCreateCycle()` đi tối đa 20 bước. **Chuỗi bị cắt trông y hệt chuỗi kết thúc ở gốc**: id chưa nạp thì `parents.get(...)` trả `undefined ?? null` → vòng lặp thoát → `return false`. Khai thác: dựng D1←D2←…←D22 (22 POST + 21 PATCH, thừa sức lọt throttle 100 req/60s) rồi `PATCH /documents/D1/parent {parentId: D22}` → **vòng được ghi vào DB**, đúng thứ code tự nhận là không cho phép.

Bán kính thiệt hại có giới hạn — mọi bên đọc đều cap **và** giữ visited-set, nên không treo và không có query loop vô hạn; hậu quả là lineage hỏng + số `version` bão hoà ở 21.

**Fix (fail-closed)**: `loadAncestors` trả thêm `complete: boolean`; đi hết cap mà chưa tới điểm dừng → `setParent` **từ chối** với **400** `documents.errors.lineageTooDeep`, không phải đoán. Lý do chọn fail-closed thay vì recursive CTE: "không tìm thấy vòng" khi walk bị cắt là một phát biểu về **độ sâu đã nhìn**, không phải về dữ liệu — một câu trả lời không biết thì phải từ chối. Regression test: `documents.service.spec.ts` — *"refuses to extend a chain longer than it can verify"* (25 mắt xích → 400, `document.update` **không** được gọi) + *"still accepts a chain it can walk to the end"* (5 mắt xích → ghi bình thường).

### 🟢 L3 — `gaps` trả về không cap trong khi diff có cap · **ĐÃ FIX**

`toSide()` trả nguyên `report.gaps`, còn `diffGaps` cắt ở `MAX_GAPS_PER_SIDE = 50`. Không phải DoS (phép ghép O(n·m) đã chặn đúng ở 50×50), nhưng **response hiển thị nhiều gap hơn số gap thực sự được đem so** — user nhìn thấy thứ thuật toán đã bỏ qua. Fix: `gapsOf()` cắt ở cùng hằng số.

### 🟢 L4 — `findMany` lịch sử match không giới hạn · **ĐÃ FIX**

`comparison.service.ts` nạp mọi `MatchResult` `succeeded` của 2 CV, mỗi row kéo theo một JSON `report`. Chỉ tự hại mình, nhưng thêm `take: MAX_MATCHES_SCANNED = 500` (chỉ bên đọc mới nhất mỗi cặp (CV, JD) được dùng, nên cap này chỉ cắt bớt **danh sách JD chọn được**).

### 🟢 L5 — `baseDoc.kind` không được kiểm · **ĐÃ FIX**

Bản mới được kiểm là `CV`, bản cha thì không. Không tới được qua đường ghi hiện tại (`setParent` chặn cross-kind), nhưng cột thì cho phép. Thêm check + 400 `notCv`.

### 🟢 L1 — Race check-then-write vẫn tạo được 2-cycle · **CHẤP NHẬN, có lý do**

Kiểm vòng và `update` là 2 câu lệnh rời, không transaction. Hai `PATCH` đồng thời (`X.parent=Y` và `Y.parent=X`) đều validate trên trạng thái trước race và đều commit.

**Không fix**, có chủ ý: cách đóng duy nhất là `$transaction` với isolation **Serializable**, thứ sẽ biến một race hiếm và **vô hại có giới hạn** (mọi bên đọc đều cap + visited-set → không treo, không loop) thành **500 serialization failure thỉnh thoảng** trong luồng chính, mà Prisma không tự retry. Đổi một lỗi hiển thị hiếm lấy một lỗi khả dụng thường xuyên hơn là đổi tồi. Thêm nữa, ADR #9 đã chặn deploy public cho tới khi Auth xong, nên hiện chỉ có một user single-session. **Mở lại khi Roadmap #10 (Auth/SSO) về** — lúc đó mới thực sự có nhiều caller đồng thời.

### 🟢 L2 — Walk tổ tiên là N+1 · **CHẤP NHẬN, có lý do**

Tối đa 20 round-trip tuần tự cho mỗi `GET /comparisons/:id`, chỉ để hiển thị số phiên bản. Trong thực tế chuỗi dài 1–2 nên vòng lặp thoát ngay; 20 là **trần lý thuyết**, không phải chi phí thường trực. Recursive CTE (`$queryRaw`) sẽ là lời gọi raw SQL **đầu tiên** của codebase, đổi một nhất quán đang có lấy một tối ưu chưa ai đo được là cần. Ghi lại ở đây để có gì thì biết đường quay lại.

## Đã verify sạch (không cần hành động)

| Hạng mục | Bằng chứng |
|---|---|
| **Không có đường tới AI** | `comparison.module.ts` không `imports` gì; `ComparisonService` chỉ nhận `PrismaService` + `CurrentUserService`; không có tham chiếu `openai`/`AiService` trong module. Claim "màn so sánh không tiêu call AI" của `design.md` §2 là **bất biến cấu trúc**, không phải lời hứa. |
| **Data exposure** | `ComparisonSideDto` chỉ có id / điểm / tên provider-model / gaps / `createdAt`. Không key, không ciphertext, không `rawText`, không `fileData`, và **không `errorCode`** (query lọc `status: succeeded` nên mã lỗi provider không thể lọt ra). |
| **IDOR trên query param** | `selectJd()` đối chiếu `jdDocumentId` với danh sách dựng **từ chính match của user**, và ném 400 thay vì âm thầm đổi JD → id của user khác cho ra 400, không cho ra dữ liệu. |
| **IDOR trên `parentId` body** | Parent phải `findFirst({ id, userId })`; không thấy → **400** với **cùng một message** như "không tồn tại", nên tài liệu của user khác không phân biệt được với tài liệu không có thật. |
| **Injection** | Toàn bộ query qua Prisma builder. FE `ENDPOINTS.comparison` / `documentParent` bọc `encodeURIComponent` cả path segment lẫn giá trị query. |
| **XSS** | Gap do LLM viết render dưới dạng text child của React (`GapDiffList`), nhãn `Select` của antd là text node. Không `dangerouslySetInnerHTML` / `innerHTML` / `eval`. E2E có case bơm `<script>` và assert nó hiện ra **dưới dạng chữ** + `window.__pwned` không tồn tại. |
| **Validation** | `ComparisonQueryDto`: `@IsOptional() @IsUUID()`. `SetDocumentParentDto`: `@ValidateIf(dto => dto.parentId !== null) @IsUUID()` — body rỗng bị 400 chứ **không** âm thầm gỡ liên kết. Path param qua `ParseUUIDPipe`. Global pipe `{ whitelist, transform }`. |
| **Rate limit** | Throttle global 100 req/60s là đủ: không endpoint nào ở đây gọi AI hay ghi dữ liệu nặng (khác `POST /cv-rewrite`, thứ phải siết xuống 10/phút vì mỗi lần gọi là một chat completion). |

## Ghi chú không thuộc bảo mật

- Nút "Compare versions" ở `DocumentRow` hiện với **mọi** document có `parentId`, kể cả JD (thư viện `/jd` cũng dùng chung row). Server trả 400 `notCv` đúng, nên đây là vết xước UX, không phải lỗ hổng — ghi lại để lần chạm `DocumentLibrary` tới thì dọn.
