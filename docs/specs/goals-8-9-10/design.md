# Design — Goal 8, 9, 10 (tiếng Việt · lineage · chủ quyền dữ liệu)

> Brainstorm 2026-08-08 qua `superpowers:brainstorming`.
> **Đây là spec ở tầng GOAL, không phải tầng feature.** Nó định nghĩa 3 goal mới cho `project-goals.md` §4 và ghi lại **lý do** đằng sau từng quyết định. Mỗi goal sau đó có phiên brainstorm feature riêng → `specs/<feature>/design.md` + `plan.md` của nó.
> Phân vai: file này giữ **tại sao**; `project-goals.md` giữ **quyết định**. Không chép lặp.

## 1. Vì sao có phiên này

Sau đợt đồng bộ doc ↔ code 2026-08-08 (PR `docs` #12), bức tranh goal hiện tại là: Goal 1–4 xong, Goal 5 một nửa, Goal 6 đang làm, Goal 7 vừa chốt. Rà lại sản phẩm ở trạng thái đó lộ ra 3 khoảng trống mà không goal nào đang phủ:

1. **Một lỗi đang chạy trên `main`** khiến 40% trọng số điểm trở thành nhiễu với tài liệu tiếng Việt — thị trường chính của app.
2. **Không có cách đo sự cải thiện.** App chấm điểm một lần rồi thôi. Goal 7 sắp sinh ra CV mới nhưng không có gì chứng minh bản mới tốt hơn.
3. **Không có kiểm soát vòng đời dữ liệu.** CV là PII, và Goal 6 sắp gửi nó tới nhiều nhà cung cấp AI trong một lần chạy.

Ba khoảng trống này độc lập nhau về code, nên chúng là 3 goal riêng, không phải một.

## 2. Goal 8 — Tài liệu tiếng Việt được chấm đúng như tiếng Anh

### 2.1 Bằng chứng

Chạy tokenizer thật (`server/src/modules/matching/matching.service.ts:124`) với CV tiếng Việt:

```
CV: "Kinh nghiệm 3 năm phát triển hệ thống với ReactJS và Node.js"
→  ['kinh', 'nghi', 'ph', 'tri', 'th', 'ng', 'reactjs', 'node.js']

JD: "3 years experience developing systems with React and Node.js"
→  ['years', 'experience', 'developing', 'systems', 'with', 'react', 'and', 'node.js']

overlap = ['node.js']        keywordScore ≈ 12%
```

Nguyên nhân: regex tách token là `[^a-z0-9+#.]+`. Mọi ký tự có dấu (`ệ`, `á`, `ể`, `ệ`, `ố`…) không nằm trong `a-z0-9+#.` nên **bị coi là dấu phân cách**. `nghiệm` → `nghi`, `phát` → `ph`, `triển` → `tri`, `hệ thống` → `th` + `ng`, `năm` → biến mất (2 mảnh 1 ký tự, dưới `MIN_TOKEN_LENGTH`).

Vế semantic (embedding) vẫn chạy đúng nên `overallScore` không sập hẳn — nhưng **40% trọng số là rác** khi tài liệu bằng tiếng Việt.

### 2.2 Phạm vi

| Trong phạm vi | Ghi chú |
|---|---|
| Tokenizer Unicode-aware | Chữ có dấu không bị băm |
| Stopword tiếng Việt | `và`, `với`, `của`, `các`, `được`, `cho`, `trong`… |
| Normalize alias kỹ thuật | `React` / `ReactJS` / `React.js` → `react` |

| Ngoài phạm vi | Lý do |
|---|---|
| **Tách từ ghép tiếng Việt** (word segmentation) | Xem §2.3 |
| Từ điển VI↔EN cho cặp CV-VI ↔ JD-EN | Vế semantic đã gánh. Thêm từ điển nghĩa là dựng + bảo trì tay, hoặc thêm 1 call AI dịch mỗi lần match (tăng cost). Không đáng ở giai đoạn này |

### 2.3 Vì sao KHÔNG tách từ ghép

Tiếng Việt viết rời từng âm tiết: `hệ thống` là 1 từ nhưng 2 âm tiết cách nhau bằng dấu cách. Tách từ đúng ngữ pháp cần thư viện NLP (vd `vi-word-segmenter`, mô hình CRF) — thêm dependency, thêm thời gian xử lý, thêm một nguồn sai.

**Không cần thiết**, vì cả CV lẫn JD đều viết cùng một kiểu. `hệ thống` trong CV thành `hệ` + `thống`; `hệ thống` trong JD cũng thành `hệ` + `thống`. Cả 2 âm tiết đều khớp → phép đếm overlap vẫn phản ánh đúng độ trùng.

Cái mất: không phân biệt được `hệ thống` (danh từ ghép) với một câu tình cờ chứa `hệ` và `thống` rời rạc. Trong ngữ cảnh CV/JD, xác suất đó thấp và hậu quả nhỏ.

**Đây là đơn giản hoá có chủ ý, không phải thiếu sót.** → ADR #14.

### 2.4 Dữ liệu cũ

`MatchResult` đã lưu trong DB đang mang `keywordScore` sai với tài liệu tiếng Việt.

May mắn: **keyword tính thuần từ text, không cần gọi AI** — `rawText` của CV/JD vẫn còn, `semanticScore` đã lưu. Nên có thể viết script tính lại `keywordScore` + `overallScore` cho row cũ mà **không tốn một call AI nào**.

**Quyết định: tính lại.** Lý do: dữ liệu hiện tại ít, và để lẫn 2 hệ điểm khác nhau trong cùng một bảng sẽ khiến Goal 9 (so delta giữa các lần match) đọc ra số vô nghĩa — người dùng sẽ thấy "điểm tăng 15%" trong khi thực tế chỉ là công thức đổi.

### 2.5 Tiêu chí thành công

Cặp CV-VI ↔ JD-VI cho `keywordScore` có chất lượng tương đương cặp EN↔EN. Ví dụ ở §2.1 phải khớp được các token có nghĩa (`kinh nghiệm`, `phát triển`, `hệ thống`, `reactjs`→`react`) thay vì chỉ `node.js`.

## 3. Goal 9 — Đo được sự cải thiện qua các phiên bản CV

### 3.1 Vấn đề

Sản phẩm hiện là **máy chấm điểm một lần**: chấm xong, hết. Goal 7 sắp sinh ra CV chỉnh sửa — nhưng theo ADR #13, bản mới lưu thành một `Document` **mới**, tức `cvDocumentId` khác. Hệ thống **không biết** bản mới là phiên bản của bản cũ, nên không tự so được.

Không có Goal 9 thì Goal 7 không chứng minh được giá trị: user nhận một CV mới và không có cách nào biết nó có thật sự tốt hơn không.

### 3.2 Phạm vi

**Trong**: quan hệ cha–con giữa `Document` (`parentId`) · CV rewrite của Goal 7 tự gán parent · upload thủ công cũng khai báo được "đây là bản mới của X" · màn so sánh v1↔v2 **trên cùng một JD**: delta tổng / semantic / keyword + gap nào đã đóng, còn lại, mới phát sinh.

**Ngoài**: hồ sơ định vị CV ("CV này mạnh nhất với nhóm JD nào", "skill nào thường xuyên thiếu") và dashboard xu hướng theo thời gian. Đây là hướng phân tích khác — trả lời *"điểm yếu cố hữu của tôi là gì"* chứ không phải *"tôi có khá lên không"*. Có giá trị nhưng là goal riêng, không nhét vào đây.

### 3.3 Vì sao lineage chứ không phải "so 2 kết quả bất kỳ"

Phương án rẻ hơn là cho user tự chọn 2 `MatchResult` đặt cạnh nhau — không đổi schema. Bị loại vì hệ thống không biết bản nào là cải tiến của bản nào, nên **không tự nói được "CV của bạn đã tốt lên"**; user phải tự nhớ mình đã sửa gì. Mà tự nhớ chính là thứ goal này sinh ra để thay thế.

Lineage cũng là thứ Goal 7 cần sẵn để gắn vào, nên làm đúng một lần.

### 3.4 Phụ thuộc

Goal 7 làm cho goal này **tự động**, nhưng Goal 9 **chạy được độc lập** — user tự upload bản sửa tay rồi khai báo lineage là đủ dùng. Không chặn nhau.

## 4. Goal 10 — Chủ quyền dữ liệu

### 4.1 Vấn đề

CV là PII. `project-goals.md` §7 hiện chỉ có một dòng NFR về privacy. Không có: export dữ liệu, xoá sạch, và — quan trọng nhất — **không có dấu vết nào về việc dữ liệu đã rời khỏi hệ thống đi đâu**.

Goal 6 làm điều này nặng thêm: user chọn nhiều provider thì CV được gửi tới **nhiều nhà cung cấp trong một lần chạy**.

### 4.2 Phạm vi

**Trong**: export toàn bộ (JSON + file gốc) · xoá sạch (cascade, xác nhận 2 bước) · bảng `DataDisclosure` ghi trước mỗi call AI · màn xem nhật ký theo từng tài liệu.

**Ngoài**: retention tự động (cần scheduler chạy nền — hạ tầng chưa có, app chưa deploy) · consent flow riêng (Goal 6 đã có cảnh báo trước khi chạy, không dựng thêm tầng).

### 4.3 Vì sao bảng riêng, không tái dùng `MatchResult`

`MatchResult` **gần như** đã là nhật ký: nó snapshot `provider` / `chatModel` / `embedModel` / `credentialId` / `createdAt` cùng `cvDocumentId` (thiết kế `ai-credentials` §1). Cám dỗ là suy nhật ký ra từ đó, khỏi thêm bảng.

Bị loại vì **một lỗ hổng nghiêm trọng**: theo thiết kế đó, lần match **lỗi** thì **không tạo row** `MatchResult`. Nhưng lần lỗi là lần dữ liệu **đã thực sự được gửi** tới provider rồi mới lỗi (sai key → request vẫn mang nội dung CV; embed xong nhưng chat lỗi → CV đã đi). Nhật ký suy từ `MatchResult` sẽ **bỏ sót đúng những lần đáng lo nhất**.

Ngoài ra hai thứ này khác nhau về ngữ nghĩa: `MatchResult` là *kết quả nghiệp vụ*, `DataDisclosure` là *sự kiện dữ liệu rời hệ thống*. Gộp lại thì mỗi lần đổi luồng match lại phải kiểm tra xem có vô tình phá nhật ký privacy không.

Bảng riêng cũng khiến Goal 10 **độc lập với `multi-provider-compare`** — không phải chờ feature đó thêm cột `status`/`errorCode`.

→ ADR #16.

### 4.4 Hai ràng buộc cứng

1. **Fail-closed** — ghi `DataDisclosure` không thành công thì **không gọi AI**. Nhật ký có lỗ là nhật ký không tin được, mà một tính năng về quyền riêng tư sai còn tệ hơn không có tính năng đó.
2. **Không chứa nội dung và không chứa key** — `DataDisclosure` chỉ giữ con trỏ (`documentId`) và metadata. Nối tiếp bất biến của `AiCredential` ở `erd.md`: ciphertext không rời tầng service.

## 5. Thay đổi ERD

| Goal | Thay đổi | Chi tiết |
|---|---|---|
| 8 | **không có** | Thuần logic trong `matching.service.ts` |
| 9 | `Document.parentId` | uuid nullable, self-FK. `ON DELETE SET NULL` — xoá CV gốc thì bản v2 vẫn còn, chỉ mất liên kết. Không cascade: mất bản cải tiến vì xoá bản gốc là hành vi gây bất ngờ |
| 10 | `DataDisclosure` (bảng mới) | `id`, `userId`, `documentId` (FK), `provider`, `purpose` (enum `embed` \| `chat`), `sentAt`, `outcome` (enum `ok` \| `failed`) |

**Hai chi tiết cố ý để mở** — chốt ở brainstorm feature, không ở tầng goal:

- Số phiên bản (`v2`, `v3`) suy ra bằng cách đi ngược chuỗi `parentId`, hay lưu hẳn cột `version`? Ảnh hưởng độ phức tạp query, không ảnh hưởng định nghĩa goal.
- `DataDisclosure` có thêm `credentialId` không (audit *"gửi bằng key cá nhân nào"*)? Hữu ích, nhưng phụ thuộc `ai-credentials` đã merge — mà theo thứ tự §7 thì lúc làm Goal 10 nó đã merge rồi, nên khả thi.

## 6. ADR mới

| # | Quyết định | Lý do |
|---|---|---|
| 14 | Keyword tiếng Việt ở **cấp âm tiết**, không tách từ ghép | CV và JD viết cùng kiểu nên overlap vẫn đúng; tránh kéo thư viện NLP + một nguồn sai mới vào engine. Xem §2.3 |
| 15 | Lineage bằng `parentId` self-FK trên `Document` | Bản mới **luôn là row mới** (nối tiếp ADR #13 "không ghi đè CV gốc"); lineage chỉ là liên kết, không phải cơ chế version hoá tại chỗ. Xem §3.3 |
| 16 | Nhật ký tiết lộ dữ liệu là **bảng riêng**, ghi **trước** call AI, **fail-closed** | `MatchResult` không tạo row khi lỗi, mà lần lỗi là lần dữ liệu vẫn đã rời hệ thống → suy từ đó sẽ bỏ sót đúng ca đáng lo nhất. Xem §4.3 |

## 7. Roadmap sau khi sắp lại

```
 1  CV↔JD Matching Wizard                        ✅
 2  Home dashboard + Document library            ✅
 3  Vietnamese document support        (Goal 8)  🔜 tiếp theo
 4  BYO AI credentials — single        (Goal 6a) 🚧 design+plan xong
 5  Data sovereignty                   (Goal 10) 📝
 6  CV rewrite assistant               (Goal 7a) 📝
 7  CV version comparison              (Goal 9)  📝
 8  Cover letter generator             (Goal 7b) 📝
 9  Multi-provider compare             (Goal 6b) 📝
10  Auth / SSO                         (Goal 5)  ⬜
11  Batch ranking                                ⬜
```

**Lý do thứ tự**:

- **Goal 8 chen lên đầu** — là lỗi đang chạy trên `main`, độc lập hoàn toàn (chỉ đụng hàm `tokenize`), và mỗi ngày trôi qua là thêm `MatchResult` mang điểm sai nằm lại trong DB.
- **`ai-credentials` giữ nguyên vị trí** — đang dở, `design.md` + `plan.md` đã viết xong, không ngắt mạch.
- **Goal 10 ngay sau `ai-credentials`** — cả hai cùng sửa `AiService` (`ai-credentials` đổi sang dựng client per-request; Goal 10 chèn ghi nhật ký trước mỗi call). Chấp nhận sửa `AiService` 2 lần thay vì gộp, vì gộp nghĩa là mở lại `plan.md` 2534 dòng đã viết xong. Lần sửa thứ 2 sẽ sạch hơn vì lúc đó `AiService` đã ổn định.
- **Goal 9 chen trước cover letter** — Goal 9 đóng vòng lặp của CV rewrite, làm liền sau #6 thì chứng minh được ngay giá trị của rewrite. Cover letter độc lập, để sau không mất gì.
- **Roadmap #3 cũ tách đôi** thành #4 và #9, phản ánh việc `ai-credentials` đã tự tách "single-provider" và "multi-provider-compare" thành 2 feature.

**Kéo theo**: `ADR #5b` và `erd.md` đang trỏ *"roadmap #7"* cho batch ranking → phải đổi thành **#11**.

## 8. File phải sửa khi áp spec này

| File | Nội dung |
|---|---|
| `docs/project-goals.md` | §4 thêm Goal 8/9/10 · §5 Non-Goals thêm 3 mục (tách từ ghép, từ điển VI↔EN, retention tự động) · §6 thêm 6.5–6.7 · §8 ADR #14–16 · §10 roadmap mới · §12 open questions · §13 changelog |
| `docs/erd.md` | `Document.parentId` · `DataDisclosure` · cập nhật bảng trạng thái implement · đổi số roadmap #7 → #11 |
| `docs/unfinished-features.md` | Mục **#4** (so sánh 2 lần match) thăng cấp thành Goal 9 → gỡ khỏi bảng. Mục **#5** (skill overlap) ghi chú: Goal 8 làm phần normalize alias, phần trích skill vẫn treo |
| `.claude/CLAUDE.md` | dòng roadmap trong status header |

## 9. Ngoài phạm vi phiên này

- **Thiết kế implementation của từng goal.** Mỗi goal có phiên brainstorm feature riêng sau.
- **Ba ý tưởng đã cân nhắc và loại** vì đâm vào Non-Goals đã chốt: theo dõi chi phí/quota AI hộ user (§5) · Chrome extension chấm JD trên trang tuyển dụng (§11 crawling) · gợi ý JD phù hợp với CV (job matching trá hình — đúng thứ ADR #12 vừa loại).
- **Goal 11 đã đề xuất nhưng chưa chốt**: đánh giá chất lượng output AI (feedback 👍/👎, bộ test prompt, hiển thị độ tin cậy). Hoãn vì chỉ có giá trị sau khi Goal 6 và 7 chạy — lúc đó mới có đủ output để đánh giá.
