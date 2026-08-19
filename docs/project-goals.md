# Project Goals & Requirements — `web-app-match-cv`

> Chốt tại brainstorm feature đầu (`cv-jd-matching-wizard`) ngày 2026-07-14.
> Cập nhật 2026-08-06: thêm **Goal 6** (BYO AI credentials + multi-provider compare) + ghi nhận feature `home-dashboard-library` vào scope/roadmap.
> Cập nhật 2026-08-09: Roadmap **#6 CV rewrite assistant (Goal 7a) DONE** — chốt 2 open question của Goal 7 (§12) và chốt phương án lưu trữ ở `erd.md`.
> Cập nhật 2026-08-09: Roadmap **#7 CV version comparison (Goal 9) DONE** — không migration; chốt open question *"số phiên bản"* (§12) và ghi rõ ở §6.6 rằng **màn so sánh không chạy match** và **ghép gap là ước lượng**.
> Cập nhật 2026-08-08: **thu hẹp định vị** — bỏ "Recruiter đăng Job" + "Apply flow" khỏi roadmap (chuyển hẳn sang Non-Goals); thêm **Goal 7** (CV rewrite assistant + Cover letter generator); **đồng bộ trạng thái theo code hiện tại** (Roadmap #2 đã DONE + merge `main`).
> Cập nhật 2026-08-09: **Goal 7b (cover letter) DONE** — §6.4 viết lại theo bản đã implement, §12 đóng open question về lưu trữ, Roadmap #8 → ✅.
> Source of truth về Identity/Vision/Goals/Non-Goals. Feature mới phải đối chiếu §4 Goals + §5 Non-Goals **trước khi** `superpowers:brainstorming`.

## 1. Identity & Vision

Web app **công cụ matching CV ↔ JD** phục vụ cả 2 phía (candidate ↔ recruiter), với điểm khác biệt cốt lõi là **matching theo cơ chế hybrid** (keyword/skill + vector semantic + LLM giải thích) và **sinh nội dung hỗ trợ ứng tuyển** từ kết quả match.

**Định vị đã thu hẹp (2026-08-08)**: đây **KHÔNG phải marketplace / job-board đăng tin**. Không có đăng job công khai, không có luồng ứng tuyển, không có messaging giữa 2 bên — xem §5 Non-Goals. Giá trị nằm ở **chất lượng matching + nội dung sinh ra từ nó**, không ở chỗ nối cung–cầu.

Tầm nhìn dài hạn: tích hợp SSO với hệ sinh thái (`web-app-store-server-client` đóng vai Identity Provider trung tâm) + mở rộng sang batch ranking nhiều CV cho 1 JD.

## 2. Domain Model

Domain chính xoay quanh:

- **User** — người dùng của app này, có role (candidate / recruiter / admin) + profile mirror từ IdP (`email`, `fullName`, `avatar`, `phone` — nullable). **match-cv sở hữu bảng User riêng**; IdP (`store-app`) chỉ sở hữu credential đăng nhập và cấp claim. Chưa có auth → dùng **mock user** (xem §3).
- **Document** — tài liệu CV hoặc JD do user nạp (PDF / DOCX / text), có thể lưu lại (per-user) để tái dùng.
- **MatchResult** — kết quả match giữa 1 CV và 1 JD: điểm tổng + breakdown + báo cáo chi tiết (gap, gợi ý cải thiện) + provider/model đã dùng.
- **MatchRun** — một lần chạy match, nhóm N `MatchResult` (mỗi provider 1 kết quả) của cùng cặp CV↔JD để đối chiếu.
- **AiCredential** — API token AI của user (per-user, **mã hoá at-rest**) + provider + model override + trạng thái test connection.

Chi tiết schema xem `docs/erd.md`.

## 3. Target Users & Roles

| Role | Mô tả |
|---|---|
| `candidate` | Người tìm việc — nạp CV, xem độ khớp với JD, nhận gợi ý cải thiện CV, (roadmap) sinh bản CV chỉnh sửa + cover letter. |
| `recruiter` | Nhà tuyển dụng — nạp JD, chấm 1 CV, (roadmap) rank nhiều CV cho 1 JD. **Không** đăng job / nhận đơn ứng tuyển (§5). |
| `admin` | Quản trị hệ thống. |

**MVP chưa build auth thật.** Mọi data key theo `userId` ngay từ đầu để **SSO-ready** — khi SSO về sau không phải đổi schema.

**Mock user (thay cho khái niệm "stub" trước đây)**: khi chưa có auth, app dùng **một `User` hợp lệ trong DB** — seed idempotent tại `STUB_USER_ID = 00000000-0000-0000-0000-000000000001` (`server/prisma/seed.ts`), lấy qua `CurrentUserService.getUserId()` — không phải một id ảo ngoài DB.

> ⚠️ **Drift code ↔ spec (2026-08-08)**: cột **`isMock` CHƯA có** trong `server/prisma/schema.prisma` (cũng chưa có `email`/`fullName`/`avatar`/`phone`/`updatedAt` — xem `erd.md`, các field đánh 📝). Hệ quả: câu clean data `DELETE FROM users WHERE is_mock = true` **chưa dùng được**; hiện phải xoá theo id hằng số. Bổ sung cột khi làm Roadmap #10 (Auth/SSO) hoặc sớm hơn nếu cần clean data.

**Ý nghĩa hành vi**: app chạy **như thể đã đăng nhập bằng user này**. Không có màn hình login, không có trạng thái "khách", không có tính năng nào bị khoá hay giảm chức năng vì chưa auth. Mọi action user làm trên web (upload CV/JD, lưu tái dùng, chạy match, thêm/xoá AI credential) đi qua đúng code path của một user thật — chỉ khác ở chỗ `userId` đến từ hằng số thay vì từ token. Khi Auth/SSO về, **không có luồng nghiệp vụ nào phải viết lại**, chỉ đổi nguồn `userId`.

Mọi `Document` / `MatchResult` / `MatchRun` / `AiCredential` vì thế gắn vào user này như user thật, nên:

- FK toàn vẹn, không có trường hợp "user không tồn tại";
- clean data về sau = `DELETE FROM users WHERE is_mock = true` (cascade) — không phải dò từng bảng;
- `CurrentUserService.getUserId()` giữ nguyên chữ ký, chỉ đổi phần thân khi Auth/SSO về.

**Ranh giới với IdP**: `store-app` giữ `Authentication` (password, roles, verifiedEmail, tokenVersion…) + `OAuthConsent`; match-cv **KHÔNG** copy bảng credential đó, chỉ lưu `externalSub` để link và mirror profile claim theo scope đã consent.

## 4. Goals

1. Cho user **nạp CV & JD** qua nhiều định dạng (PDF / DOCX / paste text) và **lưu tái dùng per-user**.
2. **Tính độ khớp CV ↔ JD hybrid**: keyword overlap + semantic (vector) + LLM. *(làm rõ 2026-08-08 — trước đó ghi "keyword/skill overlap")*
   - **Điểm số do 2 chân rẻ gánh**: `overallScore = round(0.6 × semanticScore + 0.4 × keywordScore)`. **LLM KHÔNG tham gia chấm điểm** — chỉ sinh phần giải thích (`report.strengths/gaps/suggestions`). Đây là chủ ý của ADR #4 (kiểm soát cost + số liệu tái lập được).
   - **Keyword chạy ở cấp token**, không phải cấp skill: tách token → lọc stopword → `|JD ∩ CV| / |JD|`. Nghĩa là nó đo **độ trùng từ vựng**, không đo **độ khớp kỹ năng**; `React` ≠ `ReactJS`. Vế semantic là cái bù cho điểm yếu này.
   - **Phần "thiếu skill nào" do LLM trả lời**, không suy ra từ `keywordScore`. Nâng chân keyword lên skill-level (trích skill từ `parsedContent` + normalize alias) là **cải tiến tuỳ chọn**, không phải nợ của Goal 2 — xem `unfinished-features.md` #5.
3. **Báo cáo dễ hiểu, UX-first**: % match, breakdown, điểm thiếu/gap, hướng chỉnh CV, điểm mạnh khớp.
4. **Cô lập dữ liệu per-user**: CV/JD đã lưu của user này user khác không thấy.
5. Kiến trúc **SSO-ready** để tích hợp `web-app-store-server-client` (IdP) ở giai đoạn sau — app tự quản lý bảng `User` + profile, IdP chỉ cấp claim.
6. **BYO AI credentials**: user cắm API token AI của chính họ, chọn provider tương ứng, **test connection trước khi dùng**, và chạy 1 cặp CV↔JD qua **nhiều provider cùng lúc** để đối chiếu kết quả. Key hệ thống chỉ là **fallback** khi user không có key riêng.
7. **Sinh nội dung ứng tuyển từ kết quả match** *(2026-08-08)*: từ một `MatchResult` đã có, sinh (a) **bản CV chỉnh sửa đề xuất** đóng các `gaps` — hiển thị dạng diff so với bản gốc, user **duyệt từng thay đổi** trước khi nhận; (b) **cover letter** cho đúng cặp CV↔JD đó. Đây là bước tiếp nối tự nhiên của Goal 3: hiện app chỉ **nói nên sửa gì**, Goal 7 là **sửa hộ** — nhưng luôn để user giữ quyền quyết định cuối.
8. **Tài liệu tiếng Việt được chấm đúng như tiếng Anh** *(2026-08-08)*: chân keyword của engine matching phải cho kết quả đúng với CV/JD tiếng Việt, không chỉ tiếng Anh. Gồm tokenizer Unicode-aware, stopword tiếng Việt, và normalize alias kỹ thuật (`React`/`ReactJS`/`React.js`). **Đây vừa là goal vừa là lỗi đang chạy trên `main`** — regex tách token hiện coi mọi ký tự có dấu là dấu phân cách, khiến 40% trọng số điểm thành nhiễu với tài liệu tiếng Việt. Chi tiết + bằng chứng: `specs/goals-8-9-10/design.md` §2.
9. **Đo được sự cải thiện qua các phiên bản CV** *(2026-08-08)*: user thấy được CV của mình tốt lên bao nhiêu sau khi chỉnh sửa, chứ không chỉ nhận điểm rời rạc từng lần. Gồm quan hệ cha–con giữa `Document` (lineage) + màn so sánh 2 phiên bản **trên cùng một JD**: delta điểm + gap nào đã đóng / còn / mới phát sinh. Đây là thứ làm **Goal 7 chứng minh được giá trị** — không có nó, user nhận CV mới mà không biết có tốt hơn thật không.
10. **Chủ quyền dữ liệu** *(2026-08-08)*: user kiểm soát và **nhìn thấy được** vòng đời dữ liệu cá nhân của mình, kể cả phần đã rời khỏi hệ thống. Gồm export toàn bộ, xoá sạch, và **nhật ký tiết lộ dữ liệu** — tài liệu nào đã gửi tới provider nào, lúc nào, thành công hay lỗi. Nâng §7 Privacy từ một dòng NFR thành năng lực user dùng được; cũng là một nửa còn lại của điều kiện mở khoá ADR #9 (bên cạnh Auth).

## 5. Non-Goals

- Auth/SSO thật **trong MVP** (defer — làm sau khi cả store-app lẫn match-cv hoàn thiện).
- Batch ranking nhiều CV cho 1 JD (roadmap).
- **Recruiter đăng Job / public job listing / search / filter công khai** — *(chốt 2026-08-08)* **đã loại khỏi roadmap**, không phải "làm sau". App không nối cung–cầu, không lưu tin tuyển dụng như một thực thể publish được. Hệ quả: **không cần model `Job`**.
- **Apply flow / messaging / notification giữa candidate ↔ recruiter** — *(chốt 2026-08-08)* **đã loại khỏi roadmap**. JD chỉ tồn tại như một `Document` để đem đi match, không phải một vị trí có thể ứng tuyển.
- Payment / subscription.
- Mobile native app.
- **Proxy / marketplace AI**: không bán credit, không làm gateway AI, không cache/relay response cho user khác.
- **Quản lý billing / quota hộ user**: không theo dõi số dư, không cảnh báo hết hạn mức — chỉ phản ánh lỗi provider trả về.
- **Tự chọn provider thay user**: không auto-route "provider nào rẻ/nhanh nhất"; user chọn tường minh, hệ thống chỉ fallback về key hệ thống khi user không có credential nào.
- **Provider không có embeddings API** (vd Anthropic, hoặc provider embed-only như Voyage) — xem ADR #10.
- **Tách từ ghép tiếng Việt** (word segmentation) *(chốt 2026-08-08, Goal 8)*: keyword chạy ở **cấp âm tiết**. CV và JD đều viết cùng kiểu nên overlap vẫn đúng; không kéo thư viện NLP vào engine — xem ADR #14.
- **Từ điển VI↔EN cho cặp lệch ngôn ngữ** *(chốt 2026-08-08, Goal 8)*: CV tiếng Việt ↔ JD tiếng Anh thì vế **semantic gánh**, không dựng từ điển ánh xạ khái niệm và không thêm call AI để dịch.
- **Retention tự động / tự xoá tài liệu sau N ngày** *(chốt 2026-08-08, Goal 10)*: cần scheduler chạy nền — hạ tầng chưa có và app chưa deploy. Goal 10 chỉ cho user **tự** export và **tự** xoá.

## 6. Functional Scope

**MVP — CV↔JD Matching Wizard** (single JD × single CV), 4 bước:

1. **JD** — upload PDF / DOCX / paste text → parse text. Reuse: **radio-select** JD đã lưu (per-user); có action lưu JD (UX thiết kế ở SuperDesign step 1.5).
2. **CV** — 3 định dạng tương tự + reuse radio-select CV đã lưu (per-user) + action lưu.
3. **Review** — xem lại text đã parse của CV & JD trước khi match. **Read-only** *(chốt 2026-08-08)*: user **không** sửa tay nội dung ở bước này. Parse sai → quay lại step 1/2 nạp lại tài liệu, không vá bằng edit thủ công.
4. **Kết quả** — báo cáo chi tiết: % match tổng, breakdown (semantic + keyword), điểm thiếu/gap, hướng chỉnh CV, điểm mạnh khớp.

### 6.1 Home dashboard + Document library — ✅ **ĐÃ IMPLEMENT** *(`home-dashboard-library`, merge `main` 2026-08-08)*

Mở rộng của Goal 1 (lưu tái dùng per-user). Spec + mock SuperDesign ở `specs/home-dashboard-library/` + `ui-designs/home-dashboard-library/`.

- ✅ **App shell** — sidebar nav responsive (`layouts/AppShell/`), thay cho app 2-route (`/`, `/wizard`).
- ✅ **Home dashboard** — hero CTA vào wizard + stat cards + recent matches (`views/Home/mains/{HeroCta,StatCards,RecentMatches}`).
- ✅ **Library** — routes `/cv` + `/jd` (`views/CvLibrary/` + `views/JdLibrary/`, dùng chung `components/DocumentRow` + 3 modal `Document*Modal`, mỗi trang 1 hook `use{Cv,Jd}Library`): rename, delete (chặn 409 khi đang được 1 match dùng), download/stream file gốc (`GET /documents/:id/file`), preview PDF / DOCX / text.
- 🟡 **Match history** — **BE xong, FE chưa đủ**: `GET /match` (list newest-first) + `GET /match/:id` đã có; FE mới chỉ có widget `RecentMatches` trên Home, **chưa có trang `/history` riêng** và sidebar chưa có link. Còn thiếu: filter theo CV/JD, sort theo điểm/ngày, `DELETE /match/:id`. → ghi ở `unfinished-features.md`.

### 6.2 BYO AI credentials + multi-provider compare *(sau MVP — Goal 6)*

- **Trang `/ai-credentials`** — CRUD credential (cùng pattern quản lý với Library CV/JD): thêm / đổi label / xoá / **test connection**, hiển thị token dạng masked (`••••1234`) + provider + trạng thái test lần cuối.
- **Modal ở wizard step 3** — shortcut chọn nhanh / thêm nhanh credential ngay trong luồng match, không phải rời wizard. Trang là nơi quản lý chính, modal là đường tắt.
- **Multi-select provider** ở step 3 → chuyển sang step 4 **ngay**, mỗi provider 1 card: card nào xong trước hiện kết quả trước, các card còn lại ở trạng thái skeleton/loading để user biết ai đang chờ, ai đã xong.
- **Partial success là trạng thái hợp lệ**: 1 provider fail (sai key / hết quota / timeout) → chỉ card đó hiện lỗi, các card khác giữ nguyên kết quả.
- **Fallback key hệ thống** — user không có credential nào thì vẫn chạy được bằng `OPENROUTER_API_KEY` của hệ thống (1 kết quả).

### 6.3 CV rewrite assistant — ✅ **ĐÃ IMPLEMENT** *(Goal 7a, Roadmap #6, merge 2026-08-09)*

Từ 1 `MatchResult` đã có → sinh bản CV chỉnh sửa đề xuất. Spec: `specs/cv-rewrite-assistant/`.

- ✅ **Điểm vào**: nút "Improve my CV" trên card kết quả ở wizard step 4 — **cùng card đó** cũng là thứ hiện ra khi mở lại một match từ history, nên một nút phục vụ cả hai điểm vào.
- ✅ **Input**: `rawText` của CV gốc + `report.gaps` + `report.suggestions` + JD text; chạy bằng credential user chọn (hoặc key hệ thống), có thông báo quyền riêng tư nêu đích danh provider **trước** khi bấm sinh.
- ✅ **Output**: danh sách **thay đổi có neo** (anchored change) — mỗi thay đổi kèm đoạn gốc nguyên văn để đối chiếu; user tick **từng cái** (mặc định không tick gì) rồi lưu thành `Document` mới (`kind=CV`, `parentId` = CV gốc) — **không ghi đè CV gốc**.
- ✅ **Ràng buộc nội dung được THI HÀNH, không chỉ được dặn**: mỗi thay đổi phải neo vào một đoạn **nguyên văn và duy nhất** của CV gốc; neo bịa / mơ hồ / phình quá cỡ bị **loại ở server**, cả lúc sinh lẫn lúc lưu. Gap không đóng được bằng viết lại → trả về `unaddressedGaps` và hiển thị là *"cần kinh nghiệm thật"*. Chi tiết + phần **không** chặn được (bịa ở mức ngữ nghĩa): `specs/cv-rewrite-assistant/design.md` §3.
- **Diff ở mức toàn văn có neo, KHÔNG theo section** *(chốt 2026-08-09)* — `Document.parsedContent` vẫn `null`, xem `unfinished-features.md` #2 và design §2.
- **Vòng lặp giá trị**: CV mới đem match lại đúng JD đó → user thấy điểm tăng bao nhiêu. Phần đo lường này là **Goal 9** (§6.6), không nằm trong feature này — nhưng `parentId` mà nó cần **đã có sẵn**.

### 6.4 Cover letter generator *(Goal 7b)* — ✅ **ĐÃ IMPLEMENT** *(`cover-letter-generator`, 2026-08-09)*

Spec đầy đủ: `specs/cover-letter-generator/design.md`.

- ✅ **Điểm vào**: nút trên **header của card kết quả `succeeded`**, cạnh nút "Improve CV" của 7a — hai hành động anh em của cùng một report. Vì card này cũng là card render khi mở lại một match từ Home, **điểm vào từ match history có sẵn** (trước khi 7a merge thì chưa, do regression *"No run to show"*).
- ✅ **Input**: cặp CV↔JD + `report.strengths` làm chất liệu, và `report.gaps` làm **danh sách cấm** (xem dưới).
- ✅ **Tuỳ chọn**: độ dài (`short`/`standard`), tone (`formal`/`friendly`), **ngôn ngữ lá thư `en`/`vi`** — độc lập với ngôn ngữ UI.
- ✅ **Output**: plain text sửa được tại chỗ + copy + tải `.txt`. Export `.docx`/`.pdf` **ngoài phạm vi** (đích đến là ô soạn email / form tuyển dụng).
- ✅ **Dùng chung hạ tầng Goal 6**: chạy bằng credential user chọn, không có → key hệ thống. Provider lỗi → **lưu row `status=failed`**, không ném 503 (cùng hợp đồng `POST /match`).
- ✅ **Grounding (ADR #13) hiện thực có kiểm chứng**: `gaps` đi vào prompt dưới nhãn **`MUST NOT CLAIM`**, và model phải trả `omittedRequirements` — danh sách yêu cầu nó **không** dám nhận vì CV không chống lưng được. UI hiển thị đúng danh sách đó dưới lá thư, nên ràng buộc trở thành thứ **user nhìn thấy** thay vì một câu dặn dò. Unit test assert prompt thực gửi đi có đủ 3 tầng ràng buộc → gỡ ra là test đỏ.
- ✅ **Lưu trữ**: model **`CoverLetter` riêng**, mỗi lần sinh là một row, **tự lưu** (xem §12 — open question đã đóng).

### 6.5 Vietnamese document support *(Goal 8)*

Sửa chân keyword của engine để chấm đúng tài liệu tiếng Việt. **Bằng chứng lỗi + lập luận đầy đủ: `specs/goals-8-9-10/design.md` §2.**

- **Tokenizer Unicode-aware** — chữ có dấu không bị băm. Hiện `[^a-z0-9+#.]+` coi `ệ`/`á`/`ể` là dấu phân cách: `nghiệm` → `nghi`, `hệ thống` → `th` + `ng`, `năm` → mất hẳn.
- **Stopword tiếng Việt** — `và`, `với`, `của`, `các`, `được`, `cho`, `trong`…
- **Normalize alias kỹ thuật** — `React` / `ReactJS` / `React.js` → `react`. Cũng đóng một phần mục #5 ở `unfinished-features.md`.
- **Tính lại dữ liệu cũ** — script chạy một lần tính lại `keywordScore` + `overallScore` cho `MatchResult` đã lưu. **Không tốn call AI** (`rawText` còn, `semanticScore` đã lưu). Bắt buộc, vì để lẫn 2 hệ điểm sẽ khiến Goal 9 đọc ra delta vô nghĩa.
- **Không làm**: tách từ ghép (ADR #14), từ điển VI↔EN (§5).

### 6.6 CV version comparison *(Goal 9)* — ✅ **ĐÃ IMPLEMENT** *(`cv-version-comparison`, 2026-08-09)*

- ✅ **Lineage** — `Document.parentId` (nullable self-FK). CV rewrite của Goal 7 tự gán parent; upload thủ công khai báo qua `PATCH /documents/:id/parent` (từ chối self / khác `kind` / tạo vòng).
- ✅ **Màn so sánh** — `GET /comparisons/:documentId` + trang `/compare/$documentId?jd=`: bản mới so với **cha của nó** trên **một JD do user chọn** (JD nằm ở search param nên reload/share link giữ nguyên). Delta `overallScore` / `semanticScore` / `keywordScore` **có dấu**, và gap **đã đóng** / **còn lại** / **mới phát sinh**.
- ✅ **Số phiên bản** hiển thị `Version 1 → Version 2`, **suy từ chuỗi `parentId`**, không thêm cột (§12).
- **So sánh KHÔNG chạy match** *(chốt 2026-08-09)* — màn hình read-only tuyệt đối, không tiêu call AI nào. Bản chưa từng match với JD đó → nói thẳng ra + CTA đưa về wizard (nơi đã sở hữu chọn credential + thông báo quyền riêng tư). Ngược lại thì mỗi lần đổi JD trong dropdown là một lần CV rời hệ thống mà user không hề bấm gì.
- **Ghép gap là ước lượng, và UI nói vậy** — `report.gaps` là free-text LLM sinh lại mỗi lần, nên so nguyên văn sẽ báo mọi gap vừa "đã đóng" vừa "mới". Cách làm: **trùng lặp token chủ đề** dùng chung `matching/tokenizer.ts` (Goal 8) sau khi gỡ từ đệm, ngưỡng overlap 0.5, ghép best-first. Giới hạn đã biết: gộp nhầm 2 gap cùng chủ đề khác chi tiết (nghiêng về "còn tồn tại" — hướng an toàn), tách nhầm 1 gap diễn đạt bằng từ vựng hoàn toàn khác. Vì thế UI **luôn hiện nguyên văn** cả hai câu và dẫn đầu bằng delta điểm. Chi tiết: `specs/cv-version-comparison/design.md` §3.
- **Cảnh báo khác model** — hai lần match chạy bằng chat/embed model khác nhau thì `semanticScore` không cùng không gian vector và gap không cùng giọng văn; API trả cờ, UI hiện `Alert`.
- ✅ **Chạy được độc lập với Goal 7** — user tự upload bản sửa tay rồi khai báo lineage là đủ dùng.
- **Không làm**: hồ sơ định vị CV ("CV này mạnh với nhóm JD nào") và dashboard xu hướng — hướng phân tích khác, để thành goal riêng nếu cần. Cũng **không** so 3+ phiên bản cùng lúc.

### 6.7 Data sovereignty *(Goal 10)*

- **Export toàn bộ** — JSON + file gốc của mọi `Document`, `MatchResult`, `AiCredential` (dạng masked, **không** kèm plaintext key).
- **Xoá sạch** — cascade toàn bộ dữ liệu của user, xác nhận 2 bước.
- **Nhật ký tiết lộ dữ liệu** — bảng `DataDisclosure` ghi **trước** mỗi call AI: `documentId`, `provider`, `purpose` (embed | chat), `sentAt`, `outcome` (ok | failed). Màn xem theo từng tài liệu: *"CV này đã gửi ra ngoài mấy lần, cho ai, lúc nào"*.
- **Hai ràng buộc cứng** (ADR #16): **fail-closed** — ghi nhật ký không thành công thì **không gọi AI**; và nhật ký **không chứa nội dung tài liệu, không chứa key**, chỉ giữ con trỏ + metadata.
- **Không làm**: retention tự động (§5), consent flow riêng (Goal 6 đã cảnh báo trước khi chạy).

## 7. Non-Functional Requirements

- **i18n**: EN + VI (BE `nestjs-i18n`, FE `i18next`).
- **Privacy**: CV/JD chứa PII → data per-user, cô lập; API key AI của hệ thống để `.env`, không commit; cân nhắc data-exposure khi gửi text ra **OpenRouter** (và model provider phía sau nó).
- **Secret của user (Goal 6)**: token AI do user cung cấp là secret bậc cao nhất trong app —
  - mã hoá at-rest (**AES-256-GCM**, key từ env `CREDENTIAL_ENCRYPTION_KEY`), không lưu plaintext;
  - **API không bao giờ trả lại plaintext** (write-only; response chỉ có `provider` + label + `••••1234` + trạng thái test);
  - không xuất hiện trong log, error message, response `/match`, hay Swagger example;
  - user chọn nhiều provider → CV/JD được gửi tới **nhiều nhà cung cấp trong một lần chạy**; UI phải nói rõ điều này trước khi chạy.
- **Performance**: MVP tính match synchronous có loading UI; background queue là roadmap. Multi-provider chạy **song song, N request độc lập** → wall-clock ≈ provider chậm nhất, không phải tổng; cost = 3N call AI (2 embed + 1 chat mỗi provider) nên UI phải cho user thấy rõ họ đang chọn mấy provider.
- **Security**: validate/parse input file an toàn (size limit, type check); rate-limit; helmet/cors.

## 8. Key Architectural Decisions (ADR summary)

| # | Quyết định | Lý do |
|---|---|---|
| 1 | Monorepo nhiều git repo độc lập (`docs/`, `.claude/`, `server/`, `client/`) | Nhân bản methodology hệ sinh thái |
| 2 | BE **NestJS + PostgreSQL + pgvector + Prisma** | Quan hệ dữ liệu job-board chặt + vector native cho semantic match |
| 3 | FE **TanStack Start + Tailwind + Ant Design** | Full-stack React (SSR + server fns), antd component lib |
| 4 | Matching **hybrid** keyword + vector + LLM | Chất lượng cao, có giải thích, kiểm soát cost. *(làm rõ 2026-08-08)* Phân vai cứng: **keyword + vector chấm điểm** (rẻ, tái lập được), **LLM chỉ giải thích** (không đưa vào công thức điểm). Keyword ở cấp token — vế semantic chịu trách nhiệm bắt các cách diễn đạt khác chữ. |
| 5 | AI = **OpenRouter** (OpenAI-compatible, SDK `openai`) — chat `openai/gpt-4o-mini` (report) + `openai/text-embedding-3-small` (embed) | *(đổi 2026-07-24)* 1 key cả chat + embeddings; đã thử Gemini nhưng key hết quota generation. Không fallback mock. |
| 5b | Semantic **không pgvector** ở MVP | Match 1 CV × 1 JD → cosine 2 vector **tính in-app**; pgvector chỉ cần khi rank nhiều CV (**roadmap #11** — roadmap đánh số lại 2026-08-08, trước đó là #7). |
| 6 | Auth **defer**, mock user, schema SSO-ready | Không chặn MVP; SSO store-app chưa tồn tại (phải xây từ đầu) |
| 7 | match-cv có **bảng `User` riêng**; IdP chỉ cấp claim | *(2026-08-06)* `store-app` sở hữu `Authentication` + `OAuthConsent`; match-cv sở hữu profile mirror (`email`/`fullName`/`avatar`/`phone`, nullable) + toàn bộ dữ liệu nghiệp vụ. KHÔNG copy bảng credential sang đây. |
| 8 | **Mock user = user thật** có cờ `isMock` | *(2026-08-06)* Thay khái niệm "stub id ngoài DB": mọi data gắn vào 1 `User` hợp lệ → FK toàn vẹn + clean data bằng `DELETE … WHERE is_mock` cascade. App hành xử **như đã đăng nhập** bằng user này (không có màn login, không có mode khách, không tính năng nào bị khoá) → khi Auth về chỉ đổi nguồn `userId`, không viết lại luồng nghiệp vụ. |
| 9 | BYO token **lưu server-side, mã hoá AES-256-GCM** | *(2026-08-06)* Để reuse cross-session/cross-device (yêu cầu "lưu để dùng sau"). **Precondition cứng**: chỉ chạy local / single-user, **KHÔNG deploy public trước khi Auth/SSO xong** — vì mock user dùng chung nghĩa là mọi caller đọc được cùng credential. |
| 10 | Provider whitelist = **có cả chat + embed** — cả 3 lái bằng **một SDK `openai`**, khác nhau chỉ ở `baseURL` + tên model *(xác nhận 2026-08-08)* | *(2026-08-06)* Engine hybrid cần 2 capability. OpenRouter / OpenAI / Google Gemini đạt; **Anthropic không có embeddings API** → loại (Voyage embed-only → loại). Giữ mọi provider cùng công thức điểm nên kết quả **so sánh được với nhau**. |
| 11 | Multi-provider = **N request độc lập + progressive reveal** | *(2026-08-06)* FE bắn N request song song (mỗi provider 1 `MatchResult` trong cùng `MatchRun`); xong trước render trước, còn lại skeleton. Không cần queue / stream / polling; partial success hợp lệ. |
| 12 | **Bỏ job-board**: không đăng Job, không apply flow | *(2026-08-08)* Sản phẩm là **công cụ matching + sinh nội dung**, không nối cung–cầu. Loại 2 mục này khỏi roadmap (không phải defer) → **không cần model `Job`**, không cần trạng thái ứng tuyển, không cần notification/messaging. Giữ scope quanh `Document` + `MatchResult`. |
| 13 | Goal 7 sinh nội dung: **grounded + user duyệt** | *(2026-08-08)* CV rewrite chỉ được diễn đạt lại nội dung **đã có** trong CV gốc — cấm bịa kinh nghiệm/kỹ năng/bằng cấp (rủi ro pháp lý + đạo đức cho user). Output là **đề xuất dạng diff**, user duyệt từng thay đổi; lưu thành `Document` mới, **không ghi đè CV gốc**. |
| 14 | Keyword tiếng Việt ở **cấp âm tiết**, không tách từ ghép | *(2026-08-08)* CV và JD đều viết rời từng âm tiết theo cùng một kiểu (`hệ thống` → `hệ` + `thống` ở cả hai phía), nên phép đếm overlap vẫn phản ánh đúng độ trùng mà không cần word segmentation. Tránh kéo thư viện NLP + một nguồn sai mới vào engine. Đơn giản hoá **có chủ ý**. |
| 15 | Lineage bằng `parentId` self-FK trên `Document` | *(2026-08-08)* Bản CV mới **luôn là row mới** (nối tiếp ADR #13 "không ghi đè CV gốc"); lineage chỉ là **liên kết**, không phải version hoá tại chỗ. `ON DELETE SET NULL` — xoá bản gốc không được xoá mất bản cải tiến. Phương án "cho user tự chọn 2 kết quả bất kỳ để so" bị loại vì hệ thống không biết bản nào cải tiến từ bản nào → không tự nói được "CV của bạn đã tốt lên". |
| 16 | Nhật ký tiết lộ dữ liệu = **bảng riêng**, ghi **trước** call AI, **fail-closed** | *(2026-08-08)* Không suy từ `MatchResult`: lần match **lỗi** không tạo row ở đó, nhưng đó lại chính là lần dữ liệu **đã rời hệ thống** rồi mới lỗi → suy từ `MatchResult` sẽ bỏ sót đúng ca đáng lo nhất. Hai thứ cũng khác ngữ nghĩa (kết quả nghiệp vụ ≠ sự kiện tiết lộ dữ liệu). Bảng riêng còn khiến Goal 10 **độc lập** với `multi-provider-compare`. |

## 9. Tech Stack (fixed)

Chi tiết + version xem `.claude/techstack/backend.md` + `.claude/techstack/frontend.md`. Tóm tắt:

- **BE**: Node + TypeScript, NestJS, PostgreSQL (pgvector defer), Prisma, class-validator, Swagger, **`openai` SDK → OpenRouter (report + embedding)**, `pdf-parse` + `mammoth`, nestjs-i18n, Jest. Port `:5200`. *(Goal 6)* mã hoá credential bằng `node:crypto` AES-256-GCM — **không thêm dependency mới**; client AI phải dựng **per-request** thay vì 1 instance ở constructor như hiện tại.
- **FE**: TanStack Start (React 19 / Vite), Ant Design + Tailwind, TanStack Query + Zustand, react-hook-form + zod, i18next, Playwright + Vitest. Port đề xuất `:5300`.

## 10. Roadmap (MVP order)

| # | Feature | Goal | Trạng thái |
|---|---|---|---|
| 1 | **CV↔JD Matching Wizard** | 1–4 | ✅ **DONE** — merge `main` cả 4 repo (Plan 0–2) |
| 2 | **Home dashboard + Document library** (§6.1) | 1, 4 | ✅ **DONE** — merge `main` (`docs` #11, `server` #7, `client` #9). **Trừ** trang Match history đầy đủ → `unfinished-features.md` |
| 3 | **Vietnamese document support** (§6.5) | 8 | ✅ **DONE** *(2026-08-08)* — merge `main` (`docs` #16, `server` #9). Tokenizer tách ra `src/modules/matching/tokenizer.ts` (Unicode-aware, gỡ dấu, stopword VI, alias kỹ thuật) + script `yarn recompute-scores` tính lại điểm cho `MatchResult` cũ. Sửa **lỗi đang chạy trên `main`**: regex cũ coi mọi ký tự có dấu là dấu phân cách nên 40% trọng số điểm là nhiễu với tài liệu tiếng Việt |
| 4 | **BYO AI credentials — single provider** (§6.2 phần 1) | 6a | ✅ **DONE** *(2026-08-08)* — merge `main` (`docs` #15, `server` #8, `client` #12). `AiCredential` + AES-256-GCM + test connection chat/embed + trang `/ai-credentials` + chọn credential ở wizard step 3 + snapshot provider trên `MatchResult`. Security review PASS; gate A E2E 78/78. **Gate B (MCP walk) chưa chạy** — xem `specs/ai-credentials/e2e.md` |
| 5 | **Data sovereignty** (§6.7) | 10 | 📝 spec tầng goal xong, chưa có spec feature. Xếp ngay sau #4 vì cả hai cùng sửa `AiService` |
| 6 | **CV rewrite assistant** (§6.3) | 7a | ✅ **DONE** *(2026-08-09)* — `Document.parentId` (ADR #15) + `POST /cv-rewrite` / `POST /cv-rewrite/accept` + trang `/cv-rewrite/$matchResultId` (diff có neo, duyệt từng thay đổi, lưu thành CV mới). ADR #13 được **thi hành bằng code** (grounding), không chỉ bằng prompt. Security review PASS (2 HIGH về availability đã fix); gate A E2E 115/115. **Gate B (MCP walk) chưa chạy** — xem `specs/cv-rewrite-assistant/e2e.md` |
| 7 | **CV version comparison** (§6.6) | 9 | ✅ **DONE** *(2026-08-09)* — `GET /comparisons/:documentId` + `PATCH /documents/:id/parent` + trang `/compare/$documentId?jd=`. **Không có migration** (tiêu thụ `parentId` của #6). Ghép gap bằng topic-overlap trên tokenizer chung, tách thành module thuần `gap-diff.ts` có test riêng. **Màn so sánh không gọi AI** — `ComparisonModule` không import `AiModule`. Đóng vòng lặp của #6: user thấy được CV mới tốt lên bao nhiêu. Gate A E2E **176/176** (toàn bộ desktop, sau khi merge #8 và Roadmap #5); **gate B chưa chạy** — xem `specs/cv-version-comparison/e2e.md` |
| 8 | **Cover letter generator** (§6.4) | 7b | ✅ **DONE** *(2026-08-09)* — model `CoverLetter` + `POST/GET/PATCH/DELETE /cover-letters` + modal ở step 4 (sinh / sửa tại chỗ / copy / tải `.txt` / so nhiều bản). Grounding ADR #13 qua danh sách cấm `MUST NOT CLAIM` + `omittedRequirements` hiển thị cho user. **Goal 7 hoàn tất.** Gate A E2E 143/143 (toàn bộ desktop, sau khi merge #6); **gate B chưa chạy** — xem `specs/cover-letter-generator/e2e.md` |
| 9 | **Multi-provider compare** (§6.2 phần 2) | 6b | ✅ **DONE** *(2026-08-08)* — `MatchRun` + `runId`/`status`/`errorCode`, multi-select ở step 3, N card progressive reveal + partial success ở step 4. **Goal 6 hoàn tất.** Gate A E2E 96/96; gate B chưa chạy — xem `specs/multi-provider-compare/e2e.md` |
| 10 | **Auth / SSO** với `web-app-store-server-client` (IdP) | 5 | ⬜ chưa bắt đầu — IdP phải xây từ đầu. Kèm: thêm cột `isMock` + profile mirror (ADR #7/#8, hiện **chưa có trong schema**) và **mở khoá precondition của ADR #9** |
| 11 | **Batch ranking** nhiều CV cho 1 JD | — | ⬜ chưa bắt đầu — đây là lúc mới cần pgvector (ADR #5b) + background queue |

> **Đã loại khỏi roadmap (2026-08-08)**: ~~Recruiter đăng Job + candidate list/search~~ và ~~Apply flow~~ — chuyển hẳn sang §5 Non-Goals theo ADR #12. Không còn nhu cầu model `Job`.
>
> **Sắp lại thứ tự (2026-08-08, `specs/goals-8-9-10/design.md` §7)**: roadmap #3 cũ ("BYO AI credentials + multi-provider compare") **tách đôi** thành #4 và #9, khớp với việc feature `ai-credentials` đã tự tách phạm vi. Batch ranking từ #7 → **#11** (ADR #5b + `erd.md` trỏ theo số mới).

## 11. Out of Scope

Xem §5 Non-Goals. Ngoài ra: crawling job từ site ngoài, video interview, ATS integration bên thứ ba.

## 12. Open Questions

> *(2026-08-09, feature `cover-letter-generator`)* Đã đóng câu *"Cover letter có cần lưu lịch sử để so nhiều bản không, hay chỉ generate-and-copy?"* → **CÓ LƯU**, bảng riêng `CoverLetter`, tự lưu mỗi lần sinh. Lý do: feature có 3 núm vặn (tone × length × language) và núm vặn chỉ có nghĩa nếu **so được** kết quả — generate-and-copy buộc user phá bản cũ để xem bản mới; mỗi lần sinh tốn một call chat mang cả CV lẫn JD nên mất bản nháp là mất tiền thật; và không có bảng thì **không ghi nổi lần lỗi**, tức phải quay về ném 503 — đúng thứ `multi-provider-compare` vừa bỏ. Lập luận đầy đủ: `specs/cover-letter-generator/design.md` §3.
>
> *(2026-08-08, feature `ai-credentials`)* Đã đóng 2 câu của Goal 6: **Gemini có** endpoint OpenAI-compatible phủ cả `/embeddings` (verify tại https://ai.google.dev/gemini-api/docs/openai) nên cả 3 provider dùng chung SDK `openai`; và **model là ô nhập tự do**, để trống = mặc định của provider, test connection là cơ chế xác minh.


- Cấu trúc `parsedContent` (jsonb) chuẩn hóa ra sao (schema section CV/JD)? → chốt ở `writing-plans`.
- Công thức combine `overallScore` từ semantic + keyword (trọng số)? → chốt ở design feature.
- OpenRouter model (chat default `openai/gpt-4o-mini`; embed `openai/text-embedding-3-small`) → cấu hình qua env `OPENROUTER_CHAT_MODEL`/`OPENROUTER_EMBED_MODEL`.
- Deploy target (Docker Compose local? cloud nào?) → TBD. **Lưu ý**: ADR #9 chặn deploy public cho tới khi Auth xong.
- ~~*(Goal 7a)* Lưu output CV rewrite ở đâu~~ → **ĐÃ CHỐT 2026-08-09** (feature `cv-rewrite-assistant`): **không thêm model**. Bản đề xuất **không lưu** (ADR #13: chỉ thành dữ liệu thật khi user duyệt; lưu đề xuất = lưu thêm một bản sao PII cho thứ có thể không bao giờ được nhận). Bản đã duyệt → `Document` mới + `parentId`. Không thêm `sourceMatchResultId` vì Goal 9 so 2 phiên bản trên **JD do user chọn**, không cần con trỏ ngược. Xem `erd.md` mục "Generated content".
- ~~*(Goal 7)* Diff CV hiển thị ở mức nào~~ → **ĐÃ CHỐT 2026-08-09**: **toàn văn, dạng thay đổi có neo** (mỗi thay đổi trích nguyên văn một đoạn duy nhất của CV), **không** theo section. Lý do: cái feature cần là *neo*, không phải *section*; và neo chính là thứ biến ADR #13 từ lời dặn trong prompt thành ràng buộc kiểm tra được bằng máy. `parsedContent` **giữ nguyên `null`** — xem `specs/cv-rewrite-assistant/design.md` §2.
- ~~*(Goal 7b)* Cover letter có cần lưu lịch sử để so nhiều bản không~~ → **ĐÃ CHỐT 2026-08-09** (feature `cover-letter-generator`): **CÓ LƯU**, bảng riêng `CoverLetter`, tự lưu mỗi lần sinh. **Ngược hướng 7a, có chủ ý** — xem ghi chú đầu mục này và `erd.md` mục "Generated content".
- *(Goal 8)* Stopword tiếng Việt lấy từ danh sách công khai nào, hay tự soạn theo ngữ cảnh CV/JD? → chốt ở design feature.
- ~~*(Goal 9)* Số phiên bản (`v2`, `v3`) suy ra bằng cách đi ngược chuỗi `parentId`, hay lưu hẳn cột `version`?~~ → **ĐÓNG 2026-08-09** (`specs/cv-version-comparison/design.md` §4.4): **suy ra, không thêm cột**. Cột `version` là state nhân bản và drift ngay ở ca đầu tiên — `ON DELETE SET NULL` biến `v2` thành gốc mới khi xoá bản gốc, nhưng cột đã lưu vẫn nói "2". Chuỗi ngắn, đã có `@@index([parentId])`, walk cap ở 20.
- *(Goal 10)* `DataDisclosure` có thêm `credentialId` không (audit *"gửi bằng key cá nhân nào"*)? Khả thi vì lúc làm Goal 10 thì `ai-credentials` đã merge. → chốt ở design feature.

## 13. Changelog

- **2026-07-14**: Chốt goal + tech + MVP (feature `cv-jd-matching-wizard`) qua `superpowers:brainstorming`. Điền toàn bộ file (từ TBD).
- **2026-08-06**: Thêm **Goal 6** BYO AI credentials + multi-provider compare (§6.2) qua `superpowers:brainstorming` — chỉ chốt goal, **chưa** viết spec/plan. Kèm: ghi nhận feature `home-dashboard-library` vào §6.1 + Roadmap #2 (trước đó nằm ngoài goals); định nghĩa lại "stub user" → **mock user thật** có cờ `isMock` + ranh giới User ↔ IdP (ADR #7/#8); Non-Goals thêm 4 mục; ADR #7–#11; Roadmap đổi sang dạng bảng có trạng thái.
- **2026-08-08**: **Thu hẹp định vị + đồng bộ doc với code.**
  - **Loại khỏi roadmap**: "Recruiter đăng Job + candidate list/search" và "Apply flow" → chuyển hẳn sang §5 Non-Goals (ADR #12). Không còn nhu cầu model `Job`. §1 Vision viết lại: **không phải marketplace/job-board**.
  - **Thêm Goal 7** (§6.3 CV rewrite assistant + §6.4 Cover letter generator) → Roadmap #6, #8 *(đánh số cuối ngày, sau lần sắp lại ở mục dưới)*. Kèm ADR #13 (grounded, cấm bịa, user duyệt diff, không ghi đè CV gốc).
  - **Sync theo code hiện tại**: Roadmap #2 `home-dashboard-library` 🟡 → ✅ **DONE** (đã merge `main`, doc trước đó ghi sai là "chưa push"); tách phần Match history còn dở sang `unfinished-features.md`; §3 ghi rõ **`isMock` + profile mirror chưa có trong `schema.prisma`** (drift ERD → code).
  - Roadmap bảng thêm cột **Goal** để mỗi dòng truy được về §4.
  - **Goal 2 bỏ chữ "skill"** → "keyword overlap + semantic + LLM", kèm phân vai rõ (keyword+vector chấm điểm, LLM chỉ giải thích) ở Goal 2 + ADR #4. Skill-level overlap hạ xuống cải tiến tuỳ chọn (`unfinished-features.md` #5). **Goal 2 = ✅ xong.**
  - **Thêm Goal 8, 9, 10** qua `superpowers:brainstorming` — spec tầng goal ở `specs/goals-8-9-10/design.md` (giữ **lý do**; file này giữ **quyết định**). Goal 8 tài liệu tiếng Việt (§6.5) · Goal 9 so sánh phiên bản CV (§6.6) · Goal 10 chủ quyền dữ liệu (§6.7). Kèm ADR #14 (không tách từ ghép) · #15 (lineage `parentId`) · #16 (nhật ký tiết lộ là bảng riêng, fail-closed). Non-Goals thêm 3 mục. Roadmap sắp lại 11 dòng: Goal 8 chen lên #3 vì là lỗi đang chạy; roadmap #3 cũ tách đôi thành #4/#9; batch ranking #7 → #11.
  - **§6 step 3 Review chốt read-only** — bỏ "sửa text/structured". User không vá nội dung parse bằng tay; parse sai thì nạp lại tài liệu ở step 1/2. (Khớp đúng code hiện tại: `views/Wizard/mains/StepReview` chỉ render `DocumentPreview`.)
- **2026-08-08** *(feature `ai-credentials`)*: tách Goal 6 làm 2 feature; hiện thực phần 1 (AiCredential + AES-256-GCM + test connection chat/embed + `/ai-credentials` + chọn credential ở wizard step 3 + snapshot provider trên `MatchResult`). Đóng 2 open question của Goal 6 (§12). Cập nhật Roadmap #3 + ADR #10.
- **2026-08-09** *(feature `cover-letter-generator`)*: hoàn tất **Goal 7b** (§6.4) — **Goal 7 đóng trọn**. Thêm model `CoverLetter` + 4 enum (migration `add_cover_letter`) — **cố ý độc lập `Document`** và độc lập lineage `parentId`, vì cover letter là **lá**: không engine nào chấm nó, không thư viện nào liệt kê nó. Thêm `AiService.generateCoverLetter()` (thêm method, không refactor — 7a chạy song song trên cùng file). Đóng open question §12 về lưu trữ: **có lưu**, ngược hướng 7a và đó là kết luận đúng — tiêu chí phân biệt là *output có chảy tiếp vào hệ thống hay không*. Ghi rõ ở §6.4 rằng "lưu lại là tuỳ chọn" nghĩa là **user xoá được**, không phải "hệ thống không lưu". Điểm vào từ match history **hoãn** cùng trang `/history`.
- **2026-08-09** *(feature `cv-rewrite-assistant`)*: hoàn tất **Goal 7a** (Roadmap #6). Thêm `Document.parentId` (self-FK, `ON DELETE SET NULL` — ADR #15, tiền đề của Goal 9); module BE `cv-rewrite` với `POST /cv-rewrite` (throttle 10/phút) + `POST /cv-rewrite/accept` (throttle 20/phút); trang FE `/cv-rewrite/$matchResultId`. **ADR #13 được thi hành bằng code**: mỗi thay đổi phải neo vào một đoạn nguyên văn duy nhất của CV, kiểm ở cả lúc sinh lẫn lúc lưu (`grounding.ts`) — bịa ở mức ngữ nghĩa vẫn không chặn được và được nói thẳng trong design §3. Chốt 2 open question của Goal 7 (§12) + phương án lưu trữ ở `erd.md`. Kèm sửa **bug đang chạy trên `main`**: mở lại một match từ Home hiện *"No run to show"* (regression của `multi-provider-compare` — `StepResult` chỉ đọc `runId`, bỏ quên `matchId`).
- **2026-08-08** *(feature `multi-provider-compare`)*: hoàn tất **Goal 6**. Thêm `MatchRun` + 3 cột `runId`/`status`/`errorCode`; **đổi hợp đồng `POST /match`**: provider lỗi trả 201 kèm `status=failed` + `errorCode` thay vì 503 (503 chỉ còn cho lỗi cấu hình). Chốt open question cap provider: **không cap**, nhưng CTA nêu số lượng và thông báo quyền riêng tư liệt kê đủ tên provider.
- **2026-08-09** *(feature `cv-version-comparison`)*: hoàn tất **Goal 9** (Roadmap #7) — đóng vòng lặp của Roadmap #6. **Không có migration**: feature tiêu thụ `Document.parentId` sẵn có. Thêm module BE `comparison` (`GET /comparisons/:documentId`) + `PATCH /documents/:id/parent` (khai lineage thủ công, chặn self/khác-kind/vòng) + trang FE `/compare/$documentId?jd=`. Ba quyết định đáng ghi: (1) **so sánh không bao giờ chạy match** — read-only tuyệt đối, `ComparisonModule` không import `AiModule`, bản chưa match trả `delta: null` (không phải `0`) và đưa user về wizard; (2) **ghép gap bằng topic-overlap** trên `matching/tokenizer.ts` sau khi gỡ từ đệm (module thuần `gap-diff.ts`, ngưỡng 0.5, ghép best-first) — embedding và một call LLM đều bị loại vì mâu thuẫn với (1); giới hạn của cách này được nói thẳng ở design §3.4 và UI luôn hiện nguyên văn gap; (3) **base match được chọn ưu tiên cùng chat+embed model** với bản mới, và khi không có cặp cùng model thì API trả cờ để UI cảnh báo, thay vì đưa ra một delta không so sánh được. Đóng open question *"số phiên bản suy ra hay lưu cột"* (§12) = **suy ra**.
- **2026-08-09** *(dọn dẹp sau Goal 7)*: sửa dòng Roadmap #3 — Vietnamese document support đã merge từ 2026-08-08 nhưng bảng vẫn ghi "🔜 TIẾP THEO", ai đọc roadmap cũng tưởng còn phải làm.
- **2026-08-09** *(dọn dẹp sau Goal 7)*: sửa dòng Roadmap #3 — Vietnamese document support đã merge từ 2026-08-08 nhưng bảng vẫn ghi "tiếp theo", ai đọc roadmap cũng tưởng còn phải làm.
