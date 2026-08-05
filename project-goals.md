# Project Goals & Requirements — `web-app-match-cv`

> Chốt tại brainstorm feature đầu (`cv-jd-matching-wizard`) ngày 2026-07-14.
> Cập nhật 2026-08-06: thêm **Goal 6** (BYO AI credentials + multi-provider compare) + ghi nhận feature `home-dashboard-library` vào scope/roadmap.
> Source of truth về Identity/Vision/Goals/Non-Goals. Feature mới phải đối chiếu §4 Goals + §5 Non-Goals **trước khi** `superpowers:brainstorming`.

## 1. Identity & Vision

Web app **job-board 2 chiều** (candidate ↔ recruiter) với điểm khác biệt cốt lõi là **matching CV ↔ JD theo cơ chế hybrid** (keyword/skill + vector semantic + LLM giải thích). Tầm nhìn dài hạn: một marketplace tuyển dụng có matching thông minh, tích hợp SSO với hệ sinh thái (`web-app-store-server-client` đóng vai Identity Provider trung tâm).

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
| `candidate` | Người tìm việc — nạp CV, xem độ khớp với JD, nhận gợi ý cải thiện CV. |
| `recruiter` | Nhà tuyển dụng — nạp JD, (roadmap) đăng job + rank ứng viên. |
| `admin` | Quản trị hệ thống. |

**MVP chưa build auth thật.** Mọi data key theo `userId` ngay từ đầu để **SSO-ready** — khi SSO về sau không phải đổi schema.

**Mock user (thay cho khái niệm "stub" trước đây)**: khi chưa có auth, app dùng **một `User` hợp lệ trong DB** (`isMock = true`, seed idempotent tại `STUB_USER_ID = 00000000-0000-0000-0000-000000000001`) — không phải một id ảo ngoài DB.

**Ý nghĩa hành vi**: app chạy **như thể đã đăng nhập bằng user này**. Không có màn hình login, không có trạng thái "khách", không có tính năng nào bị khoá hay giảm chức năng vì chưa auth. Mọi action user làm trên web (upload CV/JD, lưu tái dùng, chạy match, thêm/xoá AI credential) đi qua đúng code path của một user thật — chỉ khác ở chỗ `userId` đến từ hằng số thay vì từ token. Khi Auth/SSO về, **không có luồng nghiệp vụ nào phải viết lại**, chỉ đổi nguồn `userId`.

Mọi `Document` / `MatchResult` / `MatchRun` / `AiCredential` vì thế gắn vào user này như user thật, nên:

- FK toàn vẹn, không có trường hợp "user không tồn tại";
- clean data về sau = `DELETE FROM users WHERE is_mock = true` (cascade) — không phải dò từng bảng;
- `CurrentUserService.getUserId()` giữ nguyên chữ ký, chỉ đổi phần thân khi Auth/SSO về.

**Ranh giới với IdP**: `store-app` giữ `Authentication` (password, roles, verifiedEmail, tokenVersion…) + `OAuthConsent`; match-cv **KHÔNG** copy bảng credential đó, chỉ lưu `externalSub` để link và mirror profile claim theo scope đã consent.

## 4. Goals

1. Cho user **nạp CV & JD** qua nhiều định dạng (PDF / DOCX / paste text) và **lưu tái dùng per-user**.
2. **Tính độ khớp CV ↔ JD hybrid**: keyword/skill overlap + semantic (vector) + LLM.
3. **Báo cáo dễ hiểu, UX-first**: % match, breakdown, điểm thiếu/gap, hướng chỉnh CV, điểm mạnh khớp.
4. **Cô lập dữ liệu per-user**: CV/JD đã lưu của user này user khác không thấy.
5. Kiến trúc **SSO-ready** để tích hợp `web-app-store-server-client` (IdP) ở giai đoạn sau — app tự quản lý bảng `User` + profile, IdP chỉ cấp claim.
6. **BYO AI credentials**: user cắm API token AI của chính họ, chọn provider tương ứng, **test connection trước khi dùng**, và chạy 1 cặp CV↔JD qua **nhiều provider cùng lúc** để đối chiếu kết quả. Key hệ thống chỉ là **fallback** khi user không có key riêng.

## 5. Non-Goals

- Auth/SSO thật **trong MVP** (defer — làm sau khi cả store-app lẫn match-cv hoàn thiện).
- Batch ranking nhiều CV cho 1 JD (roadmap).
- Apply flow / messaging / notification giữa candidate ↔ recruiter.
- Public job listing / search / filter công khai.
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
3. **Review** — xem lại & sửa text/structured đã parse của CV & JD trước khi match.
4. **Kết quả** — báo cáo chi tiết: % match tổng, breakdown (semantic + keyword), điểm thiếu/gap, hướng chỉnh CV, điểm mạnh khớp.

### 6.1 Home dashboard + Document library *(sau MVP — `home-dashboard-library`)*

Mở rộng của Goal 1 (lưu tái dùng per-user). Spec + mock SuperDesign **đã có** ở `specs/home-dashboard-library/` + `ui-designs/home-dashboard-library/`.

- **App shell** — sidebar nav responsive, thay cho app 2-route (`/`, `/wizard`).
- **Home dashboard** — hero CTA vào wizard + stat cards + recent matches.
- **Library** — quản lý tài liệu đã lưu: rename, delete (chặn 409 khi đang được 1 match dùng), download/stream file gốc, preview (PDF / DOCX / text).
- **Match history** — danh sách match cũ per-user.

### 6.2 BYO AI credentials + multi-provider compare *(sau MVP — Goal 6)*

- **Trang `/ai-credentials`** — CRUD credential (cùng pattern quản lý với Library CV/JD): thêm / đổi label / xoá / **test connection**, hiển thị token dạng masked (`••••1234`) + provider + trạng thái test lần cuối.
- **Modal ở wizard step 3** — shortcut chọn nhanh / thêm nhanh credential ngay trong luồng match, không phải rời wizard. Trang là nơi quản lý chính, modal là đường tắt.
- **Multi-select provider** ở step 3 → chuyển sang step 4 **ngay**, mỗi provider 1 card: card nào xong trước hiện kết quả trước, các card còn lại ở trạng thái skeleton/loading để user biết ai đang chờ, ai đã xong.
- **Partial success là trạng thái hợp lệ**: 1 provider fail (sai key / hết quota / timeout) → chỉ card đó hiện lỗi, các card khác giữ nguyên kết quả.
- **Fallback key hệ thống** — user không có credential nào thì vẫn chạy được bằng `OPENROUTER_API_KEY` của hệ thống (1 kết quả).

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
| 4 | Matching **hybrid** keyword + vector + LLM | Chất lượng cao, có giải thích, kiểm soát cost |
| 5 | AI = **OpenRouter** (OpenAI-compatible, SDK `openai`) — chat `openai/gpt-4o-mini` (report) + `openai/text-embedding-3-small` (embed) | *(đổi 2026-07-24)* 1 key cả chat + embeddings; đã thử Gemini nhưng key hết quota generation. Không fallback mock. |
| 5b | Semantic **không pgvector** ở MVP | Match 1 CV × 1 JD → cosine 2 vector **tính in-app**; pgvector chỉ cần khi rank nhiều CV (roadmap #7 — số cũ là #5, roadmap đánh số lại 2026-08-06). |
| 6 | Auth **defer**, mock user, schema SSO-ready | Không chặn MVP; SSO store-app chưa tồn tại (phải xây từ đầu) |
| 7 | match-cv có **bảng `User` riêng**; IdP chỉ cấp claim | *(2026-08-06)* `store-app` sở hữu `Authentication` + `OAuthConsent`; match-cv sở hữu profile mirror (`email`/`fullName`/`avatar`/`phone`, nullable) + toàn bộ dữ liệu nghiệp vụ. KHÔNG copy bảng credential sang đây. |
| 8 | **Mock user = user thật** có cờ `isMock` | *(2026-08-06)* Thay khái niệm "stub id ngoài DB": mọi data gắn vào 1 `User` hợp lệ → FK toàn vẹn + clean data bằng `DELETE … WHERE is_mock` cascade. App hành xử **như đã đăng nhập** bằng user này (không có màn login, không có mode khách, không tính năng nào bị khoá) → khi Auth về chỉ đổi nguồn `userId`, không viết lại luồng nghiệp vụ. |
| 9 | BYO token **lưu server-side, mã hoá AES-256-GCM** | *(2026-08-06)* Để reuse cross-session/cross-device (yêu cầu "lưu để dùng sau"). **Precondition cứng**: chỉ chạy local / single-user, **KHÔNG deploy public trước khi Auth/SSO xong** — vì mock user dùng chung nghĩa là mọi caller đọc được cùng credential. |
| 10 | Provider whitelist = **có cả chat + embed** | *(2026-08-06)* Engine hybrid cần 2 capability. OpenRouter / OpenAI / Google Gemini đạt; **Anthropic không có embeddings API** → loại (Voyage embed-only → loại). Giữ mọi provider cùng công thức điểm nên kết quả **so sánh được với nhau**. |
| 11 | Multi-provider = **N request độc lập + progressive reveal** | *(2026-08-06)* FE bắn N request song song (mỗi provider 1 `MatchResult` trong cùng `MatchRun`); xong trước render trước, còn lại skeleton. Không cần queue / stream / polling; partial success hợp lệ. |

## 9. Tech Stack (fixed)

Chi tiết + version xem `.claude/techstack/backend.md` + `.claude/techstack/frontend.md`. Tóm tắt:

- **BE**: Node + TypeScript, NestJS, PostgreSQL (pgvector defer), Prisma, class-validator, Swagger, **`openai` SDK → OpenRouter (report + embedding)**, `pdf-parse` + `mammoth`, nestjs-i18n, Jest. Port `:5200`. *(Goal 6)* mã hoá credential bằng `node:crypto` AES-256-GCM — **không thêm dependency mới**; client AI phải dựng **per-request** thay vì 1 instance ở constructor như hiện tại.
- **FE**: TanStack Start (React 19 / Vite), Ant Design + Tailwind, TanStack Query + Zustand, react-hook-form + zod, i18next, Playwright + Vitest. Port đề xuất `:5300`.

## 10. Roadmap (MVP order)

| # | Feature | Trạng thái |
|---|---|---|
| 1 | **CV↔JD Matching Wizard** | ✅ **DONE** — merge `main` cả 4 repo (Plan 0–2) |
| 2 | **Home dashboard + Document library** (§6.1) | 🟡 **ĐANG DỞ** — BE xong (rename/delete/file-stream/match-history), FE còn thiếu trang Library; spec + mock đã có ở `specs/home-dashboard-library/`. Work nằm ở branch `feat/home-dashboard-library` (docs/server/client), **chưa push** |
| 3 | **BYO AI credentials + multi-provider compare** (§6.2, Goal 6) | 📝 goal chốt 2026-08-06, **chưa có spec/plan** — brainstorm sâu khi bắt tay làm |
| 4 | **Auth / SSO** với `web-app-store-server-client` (IdP) | ⬜ chưa bắt đầu — IdP phải xây từ đầu. Kèm: hoàn thiện profile mirror + bỏ mock user (ADR #7/#8) và **mở khoá precondition của ADR #9** |
| 5 | **Recruiter đăng Job** + candidate list/search | ⬜ chưa bắt đầu — cần model `Job` (chưa có trong `erd.md`) |
| 6 | **Apply flow** (candidate ↔ recruiter) | ⬜ chưa bắt đầu |
| 7 | **Batch ranking** nhiều CV cho 1 JD | ⬜ chưa bắt đầu — đây là lúc mới cần pgvector (ADR #5b) + background queue |

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

## 13. Changelog

- **2026-07-14**: Chốt goal + tech + MVP (feature `cv-jd-matching-wizard`) qua `superpowers:brainstorming`. Điền toàn bộ file (từ TBD).
- **2026-08-06**: Thêm **Goal 6** BYO AI credentials + multi-provider compare (§6.2) qua `superpowers:brainstorming` — chỉ chốt goal, **chưa** viết spec/plan. Kèm: ghi nhận feature `home-dashboard-library` vào §6.1 + Roadmap #2 (trước đó nằm ngoài goals); định nghĩa lại "stub user" → **mock user thật** có cờ `isMock` + ranh giới User ↔ IdP (ADR #7/#8); Non-Goals thêm 4 mục; ADR #7–#11; Roadmap đổi sang dạng bảng có trạng thái.
