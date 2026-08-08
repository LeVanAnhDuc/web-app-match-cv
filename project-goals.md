# Project Goals & Requirements — `web-app-match-cv`

> Chốt tại brainstorm feature đầu (`cv-jd-matching-wizard`) ngày 2026-07-14.
> Cập nhật 2026-08-06: thêm **Goal 6** (BYO AI credentials + multi-provider compare) + ghi nhận feature `home-dashboard-library` vào scope/roadmap.
> Cập nhật 2026-08-08: **thu hẹp định vị** — bỏ "Recruiter đăng Job" + "Apply flow" khỏi roadmap (chuyển hẳn sang Non-Goals); thêm **Goal 7** (CV rewrite assistant + Cover letter generator); **đồng bộ trạng thái theo code hiện tại** (Roadmap #2 đã DONE + merge `main`).
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

> ⚠️ **Drift code ↔ spec (2026-08-08)**: cột **`isMock` CHƯA có** trong `server/prisma/schema.prisma` (cũng chưa có `email`/`fullName`/`avatar`/`phone`/`updatedAt` — xem `erd.md`, các field đánh 📝). Hệ quả: câu clean data `DELETE FROM users WHERE is_mock = true` **chưa dùng được**; hiện phải xoá theo id hằng số. Bổ sung cột khi làm Roadmap #6 (Auth/SSO) hoặc sớm hơn nếu cần clean data.

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

## 6. Functional Scope

**MVP — CV↔JD Matching Wizard** (single JD × single CV), 4 bước:

1. **JD** — upload PDF / DOCX / paste text → parse text. Reuse: **radio-select** JD đã lưu (per-user); có action lưu JD (UX thiết kế ở SuperDesign step 1.5).
2. **CV** — 3 định dạng tương tự + reuse radio-select CV đã lưu (per-user) + action lưu.
3. **Review** — xem lại text đã parse của CV & JD trước khi match. **Read-only** *(chốt 2026-08-08)*: user **không** sửa tay nội dung ở bước này. Parse sai → quay lại step 1/2 nạp lại tài liệu, không vá bằng edit thủ công.
4. **Kết quả** — báo cáo chi tiết: % match tổng, breakdown (semantic + keyword), điểm thiếu/gap, hướng chỉnh CV, điểm mạnh khớp.

### 6.1 Home dashboard + Document library — ✅ **ĐÃ IMPLEMENT** *(`home-dashboard-library`, merge `main` 2026-08-08)*

Mở rộng của Goal 1 (lưu tái dùng per-user). Spec + mock SuperDesign ở `specs/home-dashboard-library/` + `ui-designs/home-dashboard-library/`.

- ✅ **App shell** — sidebar nav responsive (`views/AppShell/`), thay cho app 2-route (`/`, `/wizard`).
- ✅ **Home dashboard** — hero CTA vào wizard + stat cards + recent matches (`views/Home/mains/{HeroCta,StatCards,RecentMatches}`).
- ✅ **Library** — routes `/cv` + `/jd` (`views/DocumentLibrary/`): rename, delete (chặn 409 khi đang được 1 match dùng), download/stream file gốc (`GET /documents/:id/file`), preview PDF / DOCX / text.
- 🟡 **Match history** — **BE xong, FE chưa đủ**: `GET /match` (list newest-first) + `GET /match/:id` đã có; FE mới chỉ có widget `RecentMatches` trên Home, **chưa có trang `/history` riêng** và sidebar chưa có link. Còn thiếu: filter theo CV/JD, sort theo điểm/ngày, `DELETE /match/:id`. → ghi ở `unfinished-features.md`.

### 6.2 BYO AI credentials + multi-provider compare *(sau MVP — Goal 6)*

- **Trang `/ai-credentials`** — CRUD credential (cùng pattern quản lý với Library CV/JD): thêm / đổi label / xoá / **test connection**, hiển thị token dạng masked (`••••1234`) + provider + trạng thái test lần cuối.
- **Modal ở wizard step 3** — shortcut chọn nhanh / thêm nhanh credential ngay trong luồng match, không phải rời wizard. Trang là nơi quản lý chính, modal là đường tắt.
- **Multi-select provider** ở step 3 → chuyển sang step 4 **ngay**, mỗi provider 1 card: card nào xong trước hiện kết quả trước, các card còn lại ở trạng thái skeleton/loading để user biết ai đang chờ, ai đã xong.
- **Partial success là trạng thái hợp lệ**: 1 provider fail (sai key / hết quota / timeout) → chỉ card đó hiện lỗi, các card khác giữ nguyên kết quả.
- **Fallback key hệ thống** — user không có credential nào thì vẫn chạy được bằng `OPENROUTER_API_KEY` của hệ thống (1 kết quả).

### 6.3 CV rewrite assistant *(sau MVP — Goal 7a)*

Từ 1 `MatchResult` đã có → sinh bản CV chỉnh sửa đề xuất.

- **Điểm vào**: nút ở wizard step 4 (Result) + ở trang match history — không phải một luồng riêng từ đầu.
- **Input**: `rawText` của CV gốc + `report.gaps` + `report.suggestions` + JD text.
- **Output**: bản CV mới hiển thị **diff cạnh bản gốc** (thêm / sửa / bỏ), user **duyệt từng thay đổi** rồi lưu thành một `Document` mới (`kind=CV`) — **không ghi đè CV gốc**.
- **Ràng buộc nội dung**: chỉ được diễn đạt lại / làm nổi bật cái CV gốc đã có; **KHÔNG bịa kinh nghiệm, kỹ năng, bằng cấp user không có**. Gap nào không thể đóng bằng viết lại → báo là "cần bổ sung thật", không tự điền.
- **Vòng lặp giá trị**: CV mới đem match lại đúng JD đó → user thấy điểm tăng bao nhiêu (cần so sánh 2 match — xem `unfinished-features.md`).

### 6.4 Cover letter generator *(sau MVP — Goal 7b)*

- **Điểm vào**: cùng chỗ với 6.3 (step 4 Result + match history).
- **Input**: cặp CV↔JD + `report.strengths` (để letter nói đúng điểm mạnh đã khớp, không nói chung chung).
- **Tuỳ chọn**: độ dài (ngắn / chuẩn), tone (formal / thân thiện), **ngôn ngữ EN | VI** (khớp NFR i18n §7).
- **Output**: text edit được tại chỗ + copy / export. Lưu lại là **tuỳ chọn**, không bắt buộc.
- **Dùng chung hạ tầng Goal 6**: chạy bằng credential user đã cắm; không có credential → fallback key hệ thống.

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
| 5b | Semantic **không pgvector** ở MVP | Match 1 CV × 1 JD → cosine 2 vector **tính in-app**; pgvector chỉ cần khi rank nhiều CV (roadmap #7 — số cũ là #5, roadmap đánh số lại 2026-08-06). |
| 6 | Auth **defer**, mock user, schema SSO-ready | Không chặn MVP; SSO store-app chưa tồn tại (phải xây từ đầu) |
| 7 | match-cv có **bảng `User` riêng**; IdP chỉ cấp claim | *(2026-08-06)* `store-app` sở hữu `Authentication` + `OAuthConsent`; match-cv sở hữu profile mirror (`email`/`fullName`/`avatar`/`phone`, nullable) + toàn bộ dữ liệu nghiệp vụ. KHÔNG copy bảng credential sang đây. |
| 8 | **Mock user = user thật** có cờ `isMock` | *(2026-08-06)* Thay khái niệm "stub id ngoài DB": mọi data gắn vào 1 `User` hợp lệ → FK toàn vẹn + clean data bằng `DELETE … WHERE is_mock` cascade. App hành xử **như đã đăng nhập** bằng user này (không có màn login, không có mode khách, không tính năng nào bị khoá) → khi Auth về chỉ đổi nguồn `userId`, không viết lại luồng nghiệp vụ. |
| 9 | BYO token **lưu server-side, mã hoá AES-256-GCM** | *(2026-08-06)* Để reuse cross-session/cross-device (yêu cầu "lưu để dùng sau"). **Precondition cứng**: chỉ chạy local / single-user, **KHÔNG deploy public trước khi Auth/SSO xong** — vì mock user dùng chung nghĩa là mọi caller đọc được cùng credential. |
| 10 | Provider whitelist = **có cả chat + embed** | *(2026-08-06)* Engine hybrid cần 2 capability. OpenRouter / OpenAI / Google Gemini đạt; **Anthropic không có embeddings API** → loại (Voyage embed-only → loại). Giữ mọi provider cùng công thức điểm nên kết quả **so sánh được với nhau**. |
| 11 | Multi-provider = **N request độc lập + progressive reveal** | *(2026-08-06)* FE bắn N request song song (mỗi provider 1 `MatchResult` trong cùng `MatchRun`); xong trước render trước, còn lại skeleton. Không cần queue / stream / polling; partial success hợp lệ. |
| 12 | **Bỏ job-board**: không đăng Job, không apply flow | *(2026-08-08)* Sản phẩm là **công cụ matching + sinh nội dung**, không nối cung–cầu. Loại 2 mục này khỏi roadmap (không phải defer) → **không cần model `Job`**, không cần trạng thái ứng tuyển, không cần notification/messaging. Giữ scope quanh `Document` + `MatchResult`. |
| 13 | Goal 7 sinh nội dung: **grounded + user duyệt** | *(2026-08-08)* CV rewrite chỉ được diễn đạt lại nội dung **đã có** trong CV gốc — cấm bịa kinh nghiệm/kỹ năng/bằng cấp (rủi ro pháp lý + đạo đức cho user). Output là **đề xuất dạng diff**, user duyệt từng thay đổi; lưu thành `Document` mới, **không ghi đè CV gốc**. |

## 9. Tech Stack (fixed)

Chi tiết + version xem `.claude/techstack/backend.md` + `.claude/techstack/frontend.md`. Tóm tắt:

- **BE**: Node + TypeScript, NestJS, PostgreSQL (pgvector defer), Prisma, class-validator, Swagger, **`openai` SDK → OpenRouter (report + embedding)**, `pdf-parse` + `mammoth`, nestjs-i18n, Jest. Port `:5200`. *(Goal 6)* mã hoá credential bằng `node:crypto` AES-256-GCM — **không thêm dependency mới**; client AI phải dựng **per-request** thay vì 1 instance ở constructor như hiện tại.
- **FE**: TanStack Start (React 19 / Vite), Ant Design + Tailwind, TanStack Query + Zustand, react-hook-form + zod, i18next, Playwright + Vitest. Port đề xuất `:5300`.

## 10. Roadmap (MVP order)

| # | Feature | Goal | Trạng thái |
|---|---|---|---|
| 1 | **CV↔JD Matching Wizard** | 1–4 | ✅ **DONE** — merge `main` cả 4 repo (Plan 0–2) |
| 2 | **Home dashboard + Document library** (§6.1) | 1, 4 | ✅ **DONE** — merge `main` (`docs` #11, `server` #7, `client` #9). **Trừ** trang Match history đầy đủ → `unfinished-features.md` |
| 3 | **BYO AI credentials + multi-provider compare** (§6.2) | 6 | 📝 goal chốt 2026-08-06, **chưa có spec/plan** — brainstorm sâu khi bắt tay làm |
| 4 | **CV rewrite assistant** (§6.3) | 7a | 📝 *(thêm 2026-08-08)* goal chốt, **chưa có spec/plan**. Phụ thuộc mềm #3 (chạy bằng credential user) — làm được trước nếu chấp nhận chỉ dùng key hệ thống |
| 5 | **Cover letter generator** (§6.4) | 7b | 📝 *(thêm 2026-08-08)* goal chốt, **chưa có spec/plan**. Dùng chung hạ tầng sinh nội dung với #4 → nên làm liền sau #4 |
| 6 | **Auth / SSO** với `web-app-store-server-client` (IdP) | 5 | ⬜ chưa bắt đầu — IdP phải xây từ đầu. Kèm: thêm cột `isMock` + profile mirror (ADR #7/#8, hiện **chưa có trong schema**) và **mở khoá precondition của ADR #9** |
| 7 | **Batch ranking** nhiều CV cho 1 JD | — | ⬜ chưa bắt đầu — đây là lúc mới cần pgvector (ADR #5b) + background queue |

> **Đã loại khỏi roadmap (2026-08-08)**: ~~Recruiter đăng Job + candidate list/search~~ và ~~Apply flow~~ — chuyển hẳn sang §5 Non-Goals theo ADR #12. Không còn nhu cầu model `Job`.

## 11. Out of Scope

Xem §5 Non-Goals. Ngoài ra: crawling job từ site ngoài, video interview, ATS integration bên thứ ba.

## 12. Open Questions

- Cấu trúc `parsedContent` (jsonb) chuẩn hóa ra sao (schema section CV/JD)? → chốt ở `writing-plans`.
- Công thức combine `overallScore` từ semantic + keyword (trọng số)? → chốt ở design feature.
- OpenRouter model (chat default `openai/gpt-4o-mini`; embed `openai/text-embedding-3-small`) → cấu hình qua env `OPENROUTER_CHAT_MODEL`/`OPENROUTER_EMBED_MODEL`.
- Deploy target (Docker Compose local? cloud nào?) → TBD. **Lưu ý**: ADR #9 chặn deploy public cho tới khi Auth xong.
- *(Goal 6)* Có cap số provider mỗi lần chạy không (2–3), hay để user chọn tự do? → chốt ở design feature.
- *(Goal 6)* **Google Gemini**: endpoint OpenAI-compatible có phủ **cả embeddings** hay phải dùng SDK riêng (`@google/genai`)? → **phải verify khi implement**, chưa xác nhận.
- *(Goal 6)* Model list per-provider: hard-code whitelist, hay gọi `GET /models` của provider để user chọn? → chốt ở design feature.
- *(Goal 7)* Lưu output ở đâu: bảng `GeneratedContent` riêng, hay CV rewrite → `Document` mới + cover letter → không lưu? → chốt ở design feature (`erd.md` chưa có model nào cho Goal 7).
- *(Goal 7)* Diff CV hiển thị ở mức nào — dòng, câu, hay section? Phụ thuộc `parsedContent` (jsonb) có được chuẩn hoá chưa. → chốt ở design feature.
- *(Goal 7)* Cover letter có cần lưu lịch sử để so nhiều bản không, hay chỉ generate-and-copy? → chốt ở design feature.

## 13. Changelog

- **2026-07-14**: Chốt goal + tech + MVP (feature `cv-jd-matching-wizard`) qua `superpowers:brainstorming`. Điền toàn bộ file (từ TBD).
- **2026-08-06**: Thêm **Goal 6** BYO AI credentials + multi-provider compare (§6.2) qua `superpowers:brainstorming` — chỉ chốt goal, **chưa** viết spec/plan. Kèm: ghi nhận feature `home-dashboard-library` vào §6.1 + Roadmap #2 (trước đó nằm ngoài goals); định nghĩa lại "stub user" → **mock user thật** có cờ `isMock` + ranh giới User ↔ IdP (ADR #7/#8); Non-Goals thêm 4 mục; ADR #7–#11; Roadmap đổi sang dạng bảng có trạng thái.
- **2026-08-08**: **Thu hẹp định vị + đồng bộ doc với code.**
  - **Loại khỏi roadmap**: "Recruiter đăng Job + candidate list/search" và "Apply flow" → chuyển hẳn sang §5 Non-Goals (ADR #12). Không còn nhu cầu model `Job`. §1 Vision viết lại: **không phải marketplace/job-board**.
  - **Thêm Goal 7** (§6.3 CV rewrite assistant + §6.4 Cover letter generator) → Roadmap #4, #5. Kèm ADR #13 (grounded, cấm bịa, user duyệt diff, không ghi đè CV gốc).
  - **Sync theo code hiện tại**: Roadmap #2 `home-dashboard-library` 🟡 → ✅ **DONE** (đã merge `main`, doc trước đó ghi sai là "chưa push"); tách phần Match history còn dở sang `unfinished-features.md`; §3 ghi rõ **`isMock` + profile mirror chưa có trong `schema.prisma`** (drift ERD → code).
  - Roadmap bảng thêm cột **Goal** để mỗi dòng truy được về §4.
  - **Goal 2 bỏ chữ "skill"** → "keyword overlap + semantic + LLM", kèm phân vai rõ (keyword+vector chấm điểm, LLM chỉ giải thích) ở Goal 2 + ADR #4. Skill-level overlap hạ xuống cải tiến tuỳ chọn (`unfinished-features.md` #5). **Goal 2 = ✅ xong.**
  - **§6 step 3 Review chốt read-only** — bỏ "sửa text/structured". User không vá nội dung parse bằng tay; parse sai thì nạp lại tài liệu ở step 1/2. (Khớp đúng code hiện tại: `views/Wizard/mains/StepReview` chỉ render `DocumentPreview`.)
