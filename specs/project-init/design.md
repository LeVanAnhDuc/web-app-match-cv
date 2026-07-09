# Design — Init `web-app-match-cv` (Tầng A: khung flow)

> Feature: `project-init` · Ngày: 2026-07-09 · Loại: bootstrap/scaffold (không phải feature sản phẩm).
> Mục tiêu: khởi tạo khung cấu trúc + flow phát triển cho một webapp mới trong hệ sinh thái, **nhân bản methodology** từ `web-app-store-server-client`, nhưng **chưa chốt tech/goal** → chỉ dựng phần agnostic.

## 1. Bối cảnh & phạm vi

`web-app-match-cv` là một webapp mới trong cùng hệ sinh thái với `web-app-store-server-client`. Người dùng muốn tái sử dụng **cấu trúc + flow phát triển** (monorepo nhiều git repo độc lập, orchestration qua `CLAUDE.md`, superpowers methodology, worktree isolation, docs/specs per-feature, E2E dual-gate, commit gate...) nhưng **chưa quyết công nghệ hay mục tiêu sản phẩm**.

Cấu trúc/flow chia làm 2 tầng:

- **Tầng A — Khung & flow (agnostic)**: layout repo, `CLAUDE.md` điều phối, superpowers plugin, worktree flow, docs/specs skeleton, MCP config, các skill methodology. → **Init trong phiên này.**
- **Tầng B — Convention theo tech/goal**: `rules/*`, skill tech-specific, `techstack/*`, `uiux/*` (token thật), ports, DB, ERD, entity. → **Để trống (placeholder scaffolded)**, điền khi brainstorm feature đầu tiên.

### Quyết định đã chốt (brainstorm)

| Mục | Chốt |
|---|---|
| Phạm vi | Chỉ **Tầng A** — tech/goal/convention để placeholder |
| Layout | **Tối giản**: chỉ `docs/` + `.claude/` bây giờ; `server/`, `client/` thêm sau khi chốt tech |
| Git | **Tạo 2 GitHub repo mới ngay** qua MCP, set origin, push initial commit |
| `.claude` | **Repo mới riêng** `claude-architecture-match-cv` (generalize từ store-app) |
| Tên/owner | Owner `LeVanAnhDuc` · `doc-web-app-match-cv` + `claude-architecture-match-cv` |
| Visibility | **Private** (WIP) |
| Placeholder | **Scaffolded** — giữ section headings, để trống nội dung |

## 2. Cấu trúc thư mục mục tiêu

```
D:\Learn\web-app-match-cv\           ← container (KHÔNG phải git repo)
├── .mcp.json                        ← chỉ github MCP (mongo/redis DEFER tới khi chốt tech)
├── .claude\                         ← git repo claude-architecture-match-cv (private)
│   ├── CLAUDE.md                    ← root orchestration, GENERALIZE (bỏ store-specific)
│   ├── .gitignore
│   ├── settings.local.json          ← lesson-capture hooks + permission tối thiểu
│   ├── lesson.md                    ← rỗng
│   ├── agents\                       ← readme-maintainer.md + README.md (agnostic, giữ)
│   ├── scripts\                      ← lesson-detect/flush.sh + lib\ (giữ); worktree.mjs (template, ports TBD)
│   ├── skills\                       ← commit, creating-github-pr, e2e-scenario-coverage,
│   │                                   superdesign, prompt-formatter, triage-lessons (generalize tên repo)
│   ├── techstack\                    ← backend.md + frontend.md = PLACEHOLDER scaffolded
│   └── uiux\                         ← design-guide/frontend-reference/icon-map/ux-copy = PLACEHOLDER scaffolded
└── docs\                            ← git repo doc-web-app-match-cv (private)
    ├── .claude\CLAUDE.md            ← docs convention, generalize
    ├── project-goals.md            ← PLACEHOLDER scaffolded (goal TBD)
    ├── erd.md                      ← PLACEHOLDER scaffolded
    ├── unfinished-features.md      ← rỗng
    ├── specs\
    │   ├── .gitkeep
    │   └── project-init\design.md  ← chính tài liệu này
    ├── adr\.gitkeep
    ├── ui-designs\.gitkeep
    └── .superdesign\
        ├── design-system.md        ← PLACEHOLDER scaffolded (sync từ uiux sau)
        └── replica_html_template\.gitkeep
```

**Không tạo bây giờ**: `server/`, `client/` (và các repo GitHub tương ứng) — thêm khi chốt tech. Root `.mcp.json` chỉ khai báo `github`; `mongodb`/`redis` để lại khi biết DB.

## 3. Chiến lược generalize `CLAUDE.md`

**Giữ nguyên bộ khung điều phối** (bám cấu trúc §1–§7 của store-app):

- §1 Workspace layout + specs location (`docs/specs/<feature>/`)
- §2 Context routing (đọc `<repo>/.claude/CLAUDE.md` trước khi đụng code side đó)
- §3 Techstack / UI-UX / SuperDesign (trỏ tới `.claude/techstack`, `.claude/uiux`, `docs/.superdesign`)
- §4 Superpowers methodology + skill convention stack + §4.3 E2E dual-gate
- §5 Cross-stack feature rule (flow 0→5: isolation → brainstorm → SuperDesign → plan → code → review → security → drift audit → green checks → finish → PR)
- §6 Worktree isolation + state tracking
- §7 Commit review gate

**Thay/parameterize mọi fact store-specific**:

- Bỏ domain IDMS/OAuth/vệ tinh → mô tả trung tính "webapp trong hệ sinh thái, goal TBD".
- Bỏ tên tech cụ thể (Express/Mongoose/MongoDB/Redis/JWT/Next.js/Tailwind/shadcn) → ghi "TBD — xác định khi chốt tech".
- Bỏ port cụ thể (`:5000/:3000/:3100/:5100`) → "TBD".
- Bỏ tên repo store (`api-web-store-apps`...) → tên repo match-cv (`doc-web-app-match-cv`, `claude-architecture-match-cv`; `server`/`client` repo thêm sau).
- Bỏ connection string / secret.
- `server/`, `client/`: mô tả **forward-looking** — "repo sẽ được thêm khi chốt tech; `rules/`, skill tech-specific, `techstack`, `uiux` là TBD". Flow cross-stack + E2E vẫn mô tả đầy đủ như đích hướng tới (không xóa).

**Generalize repo-name coupling** trong skill `commit` + `creating-github-pr` (đang hard-code server/client/docs/.claude + tên GitHub store) → cập nhật theo repo hiện có của match-cv (docs + .claude), thêm server/client khi có.

## 4. Placeholder scaffolded — bố cục giữ, nội dung trống

- `techstack/backend.md`, `techstack/frontend.md`: giữ heading (Runtime / Framework / Ngôn ngữ / DB / Auth / Lib chính / Version…), nội dung = "_TBD — điền khi chốt tech_".
- `uiux/*`: giữ heading các file design-guide / frontend-reference (token color/spacing/typography) / icon-map / ux-copy, nội dung TBD.
- `docs/project-goals.md`: heading Mục tiêu / Scope / Non-goals / Users / Success criteria — TBD.
- `docs/erd.md`: heading Entities / Relationships — TBD.
- `docs/.superdesign/design-system.md`: heading theme boilerplate `<head>` + hard rules — TBD (sync từ `uiux/` khi có token).

## 5. Bảo mật & lưu ý thực thi

- **`.mcp.json` ở container root KHÔNG được git-track** (root không phải repo) → tái dùng github PAT hiện có của user cho github MCP (token của chính user). **Không** copy secret mongo/redis từ store-app. Flag lại cho user.
- **Repo private**; `get_me` xác nhận user MCP có quyền tạo dưới owner `LeVanAnhDuc` **trước khi** tạo. Nếu owner không khớp → dừng, báo user.
- **Bootstrap trên `main`**: init = initial commit trên `main` mỗi repo mới (không thể branch từ `origin/main` khi repo chưa tồn tại — chấp nhận). Từ feature kế tiếp mới áp worktree isolation §6.
- **Commit review gate §7**: trước mỗi commit, trình danh sách file + nội dung, đợi user duyệt.
- **superpowers plugin** cài ở cấp global (đã có trong session) — không copy per-project; flow phụ thuộc plugin này tồn tại.
- **worktree.mjs**: copy làm template nhưng ports/env là TBD (chỉ dùng được khi có server/client + tech).

## 6. Thứ tự thực thi (sẽ chi tiết ở writing-plans)

1. Tạo cây thư mục + file (generalize `CLAUDE.md`/skills, placeholder scaffolded) trong `D:\Learn\web-app-match-cv`.
2. `get_me` → tạo 2 GitHub repo private qua MCP → `git init` + set origin mỗi repo (`docs`, `.claude`).
3. Tạo `.mcp.json` container root (github only).
4. Trình diff/summary → **user duyệt** → initial commit + push `main` mỗi repo.
5. Design doc này nằm sẵn ở `docs/specs/project-init/design.md`, vào commit đầu của repo docs.

## 7. Non-goals (phiên này)

- KHÔNG chọn tech stack, KHÔNG chốt goal/domain sản phẩm.
- KHÔNG tạo `server/`/`client/` repo, KHÔNG scaffold code app.
- KHÔNG viết convention tech-specific (rules/skill BE/FE), token uiux thật, ERD thật.
- KHÔNG cấu hình mongo/redis MCP.
- KHÔNG áp worktree cho chính bước init (bootstrap trên main); worktree áp từ feature kế tiếp.
```
