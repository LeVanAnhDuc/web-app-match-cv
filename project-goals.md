# Project Goals & Requirements — `web-app-match-cv`

> Chốt tại brainstorm feature đầu (`cv-jd-matching-wizard`) ngày 2026-07-14.
> Source of truth về Identity/Vision/Goals/Non-Goals. Feature mới phải đối chiếu §4 Goals + §5 Non-Goals **trước khi** `superpowers:brainstorming`.

## 1. Identity & Vision

Web app **job-board 2 chiều** (candidate ↔ recruiter) với điểm khác biệt cốt lõi là **matching CV ↔ JD theo cơ chế hybrid** (keyword/skill + vector semantic + LLM giải thích). Tầm nhìn dài hạn: một marketplace tuyển dụng có matching thông minh, tích hợp SSO với hệ sinh thái (`web-app-store-server-client` đóng vai Identity Provider trung tâm).

## 2. Domain Model

Domain chính xoay quanh:

- **User** — người dùng, có role (candidate / recruiter / admin). MVP dùng stub (chưa auth thật).
- **Document** — tài liệu CV hoặc JD do user nạp (PDF / DOCX / text), có thể lưu lại (per-user) để tái dùng.
- **MatchResult** — kết quả match giữa 1 CV và 1 JD: điểm tổng + breakdown + báo cáo chi tiết (gap, gợi ý cải thiện).

Chi tiết schema xem `docs/erd.md`.

## 3. Target Users & Roles

| Role | Mô tả |
|---|---|
| `candidate` | Người tìm việc — nạp CV, xem độ khớp với JD, nhận gợi ý cải thiện CV. |
| `recruiter` | Nhà tuyển dụng — nạp JD, (roadmap) đăng job + rank ứng viên. |
| `admin` | Quản trị hệ thống. |

**MVP chưa build auth thật.** Dùng **stub current-user** (session/anon id hoặc dev role-switcher). Mọi data key theo `userId` ngay từ đầu để **SSO-ready** — khi SSO về sau không phải đổi schema.

## 4. Goals

1. Cho user **nạp CV & JD** qua nhiều định dạng (PDF / DOCX / paste text) và **lưu tái dùng per-user**.
2. **Tính độ khớp CV ↔ JD hybrid**: keyword/skill overlap + semantic (vector) + LLM.
3. **Báo cáo dễ hiểu, UX-first**: % match, breakdown, điểm thiếu/gap, hướng chỉnh CV, điểm mạnh khớp.
4. **Cô lập dữ liệu per-user**: CV/JD đã lưu của user này user khác không thấy.
5. Kiến trúc **SSO-ready** để tích hợp `web-app-store-server-client` (IdP) ở giai đoạn sau.

## 5. Non-Goals

- Auth/SSO thật **trong MVP** (defer — làm sau khi cả store-app lẫn match-cv hoàn thiện).
- Batch ranking nhiều CV cho 1 JD (roadmap).
- Apply flow / messaging / notification giữa candidate ↔ recruiter.
- Public job listing / search / filter công khai.
- Payment / subscription.
- Mobile native app.

## 6. Functional Scope

**MVP — CV↔JD Matching Wizard** (single JD × single CV), 4 bước:

1. **JD** — upload PDF / DOCX / paste text → parse text. Reuse: **radio-select** JD đã lưu (per-user); có action lưu JD (UX thiết kế ở SuperDesign step 1.5).
2. **CV** — 3 định dạng tương tự + reuse radio-select CV đã lưu (per-user) + action lưu.
3. **Review** — xem lại & sửa text/structured đã parse của CV & JD trước khi match.
4. **Kết quả** — báo cáo chi tiết: % match tổng, breakdown (semantic + keyword), điểm thiếu/gap, hướng chỉnh CV, điểm mạnh khớp.

## 7. Non-Functional Requirements

- **i18n**: EN + VI (BE `nestjs-i18n`, FE `i18next`).
- **Privacy**: CV/JD chứa PII → data per-user, cô lập; API key AI để `.env`, không commit; cân nhắc data-exposure khi gửi text ra Claude/Voyage.
- **Performance**: MVP tính match synchronous có loading UI; background queue là roadmap.
- **Security**: validate/parse input file an toàn (size limit, type check); rate-limit; helmet/cors.

## 8. Key Architectural Decisions (ADR summary)

| # | Quyết định | Lý do |
|---|---|---|
| 1 | Monorepo nhiều git repo độc lập (`docs/`, `.claude/`, `server/`, `client/`) | Nhân bản methodology hệ sinh thái |
| 2 | BE **NestJS + PostgreSQL + pgvector + Prisma** | Quan hệ dữ liệu job-board chặt + vector native cho semantic match |
| 3 | FE **TanStack Start + Tailwind + Ant Design** | Full-stack React (SSR + server fns), antd component lib |
| 4 | Matching **hybrid** keyword + vector + LLM | Chất lượng cao, có giải thích, kiểm soát cost |
| 5 | AI = **Claude** (report) + **Voyage AI** (embedding) | Anthropic không có embedding API; Voyage được khuyến nghị |
| 6 | Auth **defer**, stub user, schema SSO-ready | Không chặn MVP; SSO store-app chưa tồn tại (phải xây từ đầu) |

## 9. Tech Stack (fixed)

Chi tiết + version xem `.claude/techstack/backend.md` + `.claude/techstack/frontend.md`. Tóm tắt:

- **BE**: Node + TypeScript, NestJS, PostgreSQL + pgvector, Prisma, class-validator, Swagger, `@anthropic-ai/sdk`, `voyageai`, `pdf-parse` + `mammoth`, nestjs-i18n, Jest. Port đề xuất `:5200`.
- **FE**: TanStack Start (React 19 / Vite), Ant Design + Tailwind, TanStack Query + Zustand, react-hook-form + zod, i18next, Playwright + Vitest. Port đề xuất `:5300`.

## 10. Roadmap (MVP order)

1. **CV↔JD Matching Wizard** (feature đầu — feature này).
2. **Auth / SSO** với `web-app-store-server-client` (IdP).
3. **Recruiter đăng Job** + candidate list/search.
4. **Apply flow** (candidate ↔ recruiter).
5. **Batch ranking** nhiều CV cho 1 JD.

## 11. Out of Scope

Xem §5 Non-Goals. Ngoài ra: crawling job từ site ngoài, video interview, ATS integration bên thứ ba.

## 12. Open Questions

- Cấu trúc `parsedContent` (jsonb) chuẩn hóa ra sao (schema section CV/JD)? → chốt ở `writing-plans`.
- Công thức combine `overallScore` từ semantic + keyword (trọng số)? → chốt ở design feature.
- Voyage model cụ thể (`voyage-3` / `voyage-law-2`...) + Claude model id? → chốt khi scaffold.
- Deploy target (Docker Compose local? cloud nào?) → TBD.

## 13. Changelog

- **2026-07-14**: Chốt goal + tech + MVP (feature `cv-jd-matching-wizard`) qua `superpowers:brainstorming`. Điền toàn bộ file (từ TBD).
