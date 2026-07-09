# Init `web-app-match-cv` (Tầng A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng khung cấu trúc + flow phát triển (Tầng A, agnostic) cho webapp mới `web-app-match-cv`: 2 git repo (`docs/`, `.claude/`) + container root, generalize methodology từ `web-app-store-server-client`, tech/goal để placeholder scaffolded.

**Architecture:** Container folder (KHÔNG git) chứa các git repo con độc lập. Init phiên này tạo `.claude/` (repo `claude-architecture-match-cv` — methodology orchestration) + `docs/` (repo `doc-web-app-match-cv` — specs/docs). `server/`/`client/` thêm sau khi chốt tech. Nguồn generalize: các file store-app tại `D:\Learn\web-app-store-server-client\` (đọc trực tiếp, KHÔNG copy vào match-cv nếu chưa xử lý).

**Tech Stack:** N/A (đây là scaffold, tech sản phẩm TBD). Công cụ dùng: git, GitHub MCP (`mcp__github__*`), Bash/PowerShell.

## Global Constraints

- **Nguồn store-app**: `D:\Learn\web-app-store-server-client` (viết tắt `<STORE>`). Đích: `D:\Learn\web-app-match-cv` (viết tắt `<MATCH>`).
- **KHÔNG commit secret**: không đưa PAT/connection-string vào file được git-track. `.mcp.json` nằm ở container root (không phải repo → không track) — được phép chứa github token của user.
- **Repo GitHub**: `private`, owner `LeVanAnhDuc`. **Xác nhận `mcp__github__get_me`** trước khi tạo; nếu login user không có quyền tạo dưới `LeVanAnhDuc` → DỪNG, báo user.
- **Tên repo**: `docs/` → `doc-web-app-match-cv`; `.claude/` → `claude-architecture-match-cv`.
- **Bootstrap trên `main`**: init = initial commit trên `main` (repo chưa tồn tại nên không thể branch từ `origin/main`). Worktree isolation §6 áp từ feature kế tiếp.
- **Commit review gate (§7)**: trước MỌI `git commit`/push, trình danh sách file + nội dung, đợi user duyệt.
- **Leftover-token denylist** (không được xuất hiện trong file đã generalize, TRỪ khi là tên skill tech-specific đánh dấu TBD): `IDMS`, `constellation`, `vệ tinh`, `satellite`, `Apartment_App`, `api-web-store-apps`, `web-store-apps`, `doc-web-app-store`, `:5000`, `:3000`, `:3100`, `:5100`, và literal `claude-architecture` (phải là `claude-architecture-match-cv`).
- **Placeholder scaffolded**: giữ nguyên các heading section của file nguồn, thay nội dung bằng `_TBD — điền khi <điều kiện>_`.
- **DEFER (KHÔNG làm phiên này)**: `.claude/scripts/worktree.mjs` + `.claude/scripts/lib/*` (runner BE/FE, phụ thuộc ports/env/server/client) → thêm khi tạo `server/`/`client/`. `server/`/`client/` repo. mongo/redis MCP.

## File Structure (tạo mới trong `<MATCH>`)

```
<MATCH>\
├── .mcp.json                                 [Task 3] github MCP only
├── .claude\                                   [Task 1] repo claude-architecture-match-cv
│   ├── CLAUDE.md                              generalize từ <STORE>\.claude\CLAUDE.md
│   ├── .gitignore                             .worktrees/ + settings.local.json
│   ├── settings.local.json                    [Task 3] local, KHÔNG track (lesson hooks + minimal perms)
│   ├── lesson.md                              rỗng ("# Lessons\n")
│   ├── agents\README.md                       generalize (bỏ ref store); readme-maintainer.md copy as-is
│   ├── agents\readme-maintainer.md
│   ├── scripts\lesson-detect.sh               copy as-is
│   ├── scripts\lesson-flush.sh                copy as-is
│   ├── skills\commit\SKILL.md                 generalize repo-map (docs + .claude only)
│   ├── skills\creating-github-pr\SKILL.md     generalize (sub-repos hiện có)
│   ├── skills\e2e-scenario-coverage\          copy as-is
│   ├── skills\prompt-formatter\               copy as-is (kèm references/)
│   ├── skills\superdesign\                    copy as-is (INIT/SKILL/SOURCE/SUPERDESIGN.md)
│   ├── skills\triage-lessons\SKILL.md         copy as-is
│   ├── techstack\backend.md                   placeholder scaffolded
│   ├── techstack\frontend.md                  placeholder scaffolded
│   └── uiux\{design-guide,frontend-reference,icon-map,ux-copy}.md   placeholder scaffolded
└── docs\                                       [Task 2] repo doc-web-app-match-cv
    ├── .claude\CLAUDE.md                       generalize từ <STORE>\docs\.claude\CLAUDE.md
    ├── project-goals.md                        placeholder scaffolded
    ├── erd.md                                  placeholder scaffolded
    ├── unfinished-features.md                  rỗng scaffolded
    ├── specs\.gitkeep
    ├── specs\project-init\design.md            ĐÃ TỒN TẠI (giữ nguyên)
    ├── specs\project-init\plan.md              file NÀY
    ├── adr\.gitkeep
    ├── ui-designs\.gitkeep
    └── .superdesign\design-system.md           placeholder scaffolded
        .superdesign\replica_html_template\.gitkeep
```

---

### Task 1: `.claude` methodology repo skeleton

**Files:**
- Create: `<MATCH>\.claude\CLAUDE.md` (generalize)
- Create: `<MATCH>\.claude\.gitignore`, `lesson.md`
- Create: `<MATCH>\.claude\agents\README.md` (generalize) + copy `readme-maintainer.md`
- Create: `<MATCH>\.claude\scripts\lesson-detect.sh`, `lesson-flush.sh` (copy as-is)
- Create: `<MATCH>\.claude\skills\{commit,creating-github-pr}\SKILL.md` (generalize) + copy dirs `{e2e-scenario-coverage,prompt-formatter,superdesign,triage-lessons}` as-is
- Create: `<MATCH>\.claude\techstack\{backend,frontend}.md` (placeholder)
- Create: `<MATCH>\.claude\uiux\{design-guide,frontend-reference,icon-map,ux-copy}.md` (placeholder)

**Interfaces:**
- Produces: `<MATCH>\.claude\CLAUDE.md` — root orchestration, referenced by every later feature; must keep §1–§7 structure of store-app but tech-agnostic.

- [ ] **Step 1: Copy as-is các asset agnostic**

```bash
S="/d/Learn/web-app-store-server-client/.claude"
M="/d/Learn/web-app-match-cv/.claude"
mkdir -p "$M/agents" "$M/scripts" "$M/skills" "$M/techstack" "$M/uiux"
cp "$S/agents/readme-maintainer.md" "$M/agents/"
cp "$S/scripts/lesson-detect.sh" "$S/scripts/lesson-flush.sh" "$M/scripts/"
for d in e2e-scenario-coverage prompt-formatter superdesign triage-lessons; do cp -r "$S/skills/$d" "$M/skills/"; done
printf '# Lessons\n' > "$M/lesson.md"
printf '.worktrees/\nsettings.local.json\n' > "$M/.gitignore"
```

- [ ] **Step 2: Generalize `CLAUDE.md`** (đọc `<STORE>\.claude\CLAUDE.md`, viết `<MATCH>\.claude\CLAUDE.md`)

Giữ nguyên khung §1–§7 và toàn bộ flow (context routing, superpowers spine, E2E dual-gate, worktree isolation, commit gate). Áp transformation:
- §1: đổi mô tả project sang trung tính "webapp trong hệ sinh thái (goal TBD)". Giữ specs location `docs/specs/<feature>/`.
- §3.1: techstack files → giữ đường dẫn `.claude/techstack/{backend,frontend}.md`, nội dung mô tả "TBD tới khi chốt tech".
- §3.2/§3.3: giữ nguyên cơ chế uiux + SuperDesign strict-theme (agnostic về quy trình), token cụ thể = TBD.
- §4.1: giữ nguyên bảng superpowers (agnostic).
- §4.2: skill convention stack — giữ các skill root-level + agnostic (`standard-coding-universal`, `standard-typescript`); các skill tech-specific (`standard-jwt`, `standard-mongodb`, `standard-restful-api`, `standard-nextjs`, `standard-tailwind`, `standard-shadcn`, `module-struct`, …) đánh dấu **"TBD — định nghĩa khi thêm server/client + chốt tech"**, KHÔNG liệt kê như đang tồn tại.
- §4.3/§5: giữ flow E2E dual-gate + cross-stack; port cụ thể (`:5000`/`:3000`/`:3100`/`:5100`), lệnh `yarn e2e`, env cụ thể → thay bằng "TBD khi có server/client + tech". Ghi rõ `server/`/`client/` repo **sẽ được thêm sau**.
- §6: giữ worktree isolation rule; note runner `worktree.mjs` **chưa có** (thêm cùng server/client).
- §7: giữ nguyên commit review gate.
- Mọi tên repo store → repo match-cv tương ứng (`doc-web-app-match-cv`, `claude-architecture-match-cv`); `server`/`client` repo = "TBD".

- [ ] **Step 3: Generalize `agents/README.md`**

Đọc `<STORE>\.claude\agents\README.md`, giữ cấu trúc (superpowers spine + readme-maintainer + /security-review insertion). Thay ref store-specific (path ví dụ) sang trung tính; giữ luồng agnostic.

- [ ] **Step 4: Generalize skill `commit`**

Trong `<MATCH>\.claude\skills\commit\SKILL.md`, sửa **Repo map** còn các repo hiện có:
```
- `docs/` → doc-web-app-match-cv
- `.claude/` → claude-architecture-match-cv
```
và ghi chú: "`server/`, `client/` sẽ được thêm khi chốt tech". Cập nhật frontmatter `description` bỏ "4 independent repos" → "independent repos (docs/, .claude/; server/ client/ thêm sau)". Giữ nguyên logic scope-per-folder + không stage `settings.local.json`.

- [ ] **Step 5: Generalize skill `creating-github-pr`**

Trong `<MATCH>\...\creating-github-pr\SKILL.md`, đổi liệt kê sub-repos `(server/, client/, docs/)` → repos hiện có `(docs/, .claude/)` ở phần Overview + frontmatter description. Giữ toàn bộ Procedure/Error-handling/Red-flags (agnostic).

- [ ] **Step 6: Viết placeholder scaffolded `techstack/`**

`backend.md` — giữ heading nguồn:
```markdown
# Backend Tech Stack

> _TBD — điền khi chốt tech backend._

## Core
## Authentication & Security
## Validation & Documentation
## Email
## Queue & Background Jobs
## Internationalization
## Utilities
## Dev Tools
## Infrastructure
```
`frontend.md`:
```markdown
# Frontend Tech Stack

> _TBD — điền khi chốt tech frontend._

## Core
## State Management & Data Fetching
## UI Components
## Forms & Validation
## Internationalization
## Other
## Dev Tools
## Testing
## Infrastructure
```

- [ ] **Step 7: Viết placeholder scaffolded `uiux/`** (giữ heading level-1/2 của nguồn, mỗi file mở đầu `> _TBD — điền khi có design system._`)

- `design-guide.md`: `## 1. Design Principles`, `## 2. Màu Sắc`, `## 3. Typography`, `## 4. Spacing`, `## 5. Button`, `## 6. Form`, `## 7. States`, `## 8. Dialog vs Popover vs Tooltip`, `## 9. Card`, `## 10. Animation`, `## 11. Icon`, `## 12. Accessibility`, `## 13. Do's and Don'ts`.
- `frontend-reference.md`: `## 1. Color System` … `## 20. Data Attribute Conventions` + `## Key File Map` (giữ 20 heading như nguồn, nội dung TBD).
- `icon-map.md`: `## 1. Actions` … `## 10. Thêm Icon Mới`.
- `ux-copy.md`: `## 1. Tone & Voice` … `## 10. Microcopy Đặc Biệt`.

(Không cần copy chi tiết sub-heading `###` — chỉ giữ các section `##` chính là đủ cho scaffold.)

- [ ] **Step 8: Verify Task 1** — cấu trúc + no leftover tokens

Run:
```bash
M="/d/Learn/web-app-match-cv/.claude"
ls -R "$M" | head -60
grep -rniE 'IDMS|constellation|vệ tinh|satellite|Apartment_App|api-web-store-apps|web-store-apps|doc-web-app-store|:5000|:3000|:3100|:5100' "$M/CLAUDE.md" "$M/agents/README.md" "$M/skills/commit/SKILL.md" "$M/skills/creating-github-pr/SKILL.md" || echo "CLEAN ✓"
grep -rn 'claude-architecture[^-]' "$M/skills/commit/SKILL.md" && echo "FAIL: bare claude-architecture" || echo "repo-name CLEAN ✓"
```
Expected: cây thư mục đúng; `CLEAN ✓` (không token store); repo-name `CLEAN ✓`.

---

### Task 2: `docs` repo skeleton

**Files:**
- Create: `<MATCH>\docs\.claude\CLAUDE.md` (generalize)
- Create: `<MATCH>\docs\project-goals.md`, `erd.md`, `unfinished-features.md` (placeholder)
- Create: `<MATCH>\docs\.superdesign\design-system.md` (placeholder) + `replica_html_template\.gitkeep`
- Create: `.gitkeep` cho `specs\`, `adr\`, `ui-designs\`
- Exists: `<MATCH>\docs\specs\project-init\{design.md,plan.md}` (giữ)

**Interfaces:**
- Consumes: không.
- Produces: `docs/` layout mà root `CLAUDE.md` §1 tham chiếu (specs/, ui-designs/, .superdesign/).

- [ ] **Step 1: Tạo cây thư mục docs + .gitkeep**

```bash
M="/d/Learn/web-app-match-cv/docs"
mkdir -p "$M/.claude" "$M/adr" "$M/ui-designs" "$M/.superdesign/replica_html_template" "$M/specs"
touch "$M/adr/.gitkeep" "$M/ui-designs/.gitkeep" "$M/.superdesign/replica_html_template/.gitkeep" "$M/specs/.gitkeep"
```

- [ ] **Step 2: Generalize `docs/.claude/CLAUDE.md`**

Đọc `<STORE>\docs\.claude\CLAUDE.md` (4 mục: project-goals / erd / ui-designs / specs). Giữ cấu trúc; transformation:
- Mục 2 `erd.md`: bỏ "IDMS (Identity + …)" → "data model của dự án (TBD)"; giữ rule sync ERD ↔ Mongoose... → đổi thành "sync ERD ↔ model của tech đã chọn (TBD)".
- Mục 3 `ui-designs/`: store nói Pencil `.pen`; **đổi sang SuperDesign HTML** (`docs/ui-designs/<feature>/*.html`) cho khớp root §3.3 hiện tại (store docs CLAUDE.md còn nhắc Pencil = stale). Không dùng `.pen`.
- Mục 1/4: giữ nguyên (agnostic).

- [ ] **Step 3: Placeholder `project-goals.md`** (giữ heading §1–§13 của nguồn, nội dung TBD)

```markdown
# Project Goals & Requirements — `web-app-match-cv`

> _TBD — điền khi chốt goal/scope sản phẩm (brainstorm feature đầu tiên)._

## 1. Identity & Vision
## 2. Domain Model
## 3. Target Users & Roles
## 4. Goals
## 5. Non-Goals
## 6. Functional Scope
## 7. Non-Functional Requirements
## 8. Key Architectural Decisions (ADR summary)
## 9. Tech Stack (fixed)
## 10. Roadmap (MVP order)
## 11. Out of Scope
## 12. Open Questions
## 13. Changelog
```

- [ ] **Step 4: Placeholder `erd.md` + `unfinished-features.md`**

`erd.md`:
```markdown
# ERD — web-app-match-cv

> _TBD — điền khi chốt data model + tech DB._

## Module groups
## Schema
## Notes (semantics ngoài schema)
## How to update
```
`unfinished-features.md`:
```markdown
# Tính năng chưa hoàn thiện (UI có, API chưa có)

> _TBD — chưa có feature nào._

## Bảng tổng quan
## Ghi chú
```

- [ ] **Step 5: Placeholder `.superdesign/design-system.md`** (giữ heading §0–§6 strict của nguồn, note sync từ uiux)

```markdown
# web-app-match-cv — Design System (STRICT — SuperDesign MUST obey)

> _TBD — sync từ `.claude/uiux/` khi có design token. Giữ cơ chế strict-theme (root CLAUDE.md §3.3)._

## 0. MANDATORY BOILERPLATE — copy this `<head>` VERBATIM into every generated HTML
## 1a. BOTH themes — MANDATORY page structure
## 1b. HARD RULES (a design is REJECTED if it breaks any)
## 2. Typography tiers
## 3. Header
## 4. (feature-specific sections)
## 5. UX copy
## 6. Accessibility
```

- [ ] **Step 6: Verify Task 2**

Run:
```bash
M="/d/Learn/web-app-match-cv/docs"
ls -R "$M" | head -40
grep -rniE 'IDMS|constellation|vệ tinh|satellite|Pencil|\.pen' "$M/.claude/CLAUDE.md" "$M/erd.md" "$M/project-goals.md" || echo "CLEAN ✓"
test -f "$M/specs/project-init/design.md" && echo "design.md OK"
```
Expected: cây đúng, `CLEAN ✓`, `design.md OK`.

---

### Task 3: Container root `.mcp.json` + local `settings.local.json`

**Files:**
- Create: `<MATCH>\.mcp.json` (github only)
- Create: `<MATCH>\.claude\settings.local.json` (local, KHÔNG track)

**Interfaces:**
- Consumes: không.
- Produces: github MCP available cho Task 4 (thực tế session hiện tại đã có github MCP; file này để lần mở dự án sau).

- [ ] **Step 1: `.mcp.json`** (chỉ github; token tái dùng từ user — KHÔNG track vì root không phải repo)

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp",
      "headers": { "Authorization": "Bearer <REUSE_USER_PAT>" }
    }
  }
}
```
(Điền `<REUSE_USER_PAT>` = PAT github của user, lấy từ `<STORE>\.mcp.json`. Flag cho user đây là secret local-only.)

- [ ] **Step 2: `.claude/settings.local.json`** (lesson hooks trỏ `<MATCH>`; bỏ PostToolUse tsc/eslint/prettier vì chưa có server/client node_modules; enabled plugins + github MCP + deny-list an toàn)

```json
{
  "includeCoAuthoredBy": false,
  "permissions": {
    "allow": ["Bash(*)","Read","Edit","Write","Glob","Grep","WebSearch","WebFetch",
      "Skill(commit)","mcp__github__get_me","mcp__github__create_repository",
      "mcp__github__create_pull_request","mcp__github__merge_pull_request",
      "mcp__github__pull_request_read","mcp__github__list_branches",
      "Bash(bash .claude/scripts/lesson-detect.sh)","Bash(bash .claude/scripts/lesson-flush.sh)"],
    "deny": ["Bash(rm -rf /:*)","Bash(rm -rf /*:*)","Bash(rm --no-preserve-root:*)",
      "Bash(dd if=* of=/dev/*:*)","Bash(mkfs*:*)","Bash(shutdown:*)","Bash(reboot:*)",
      "Bash(halt:*)","Bash(poweroff:*)","Bash(format C:*)","Bash(format D:*)"],
    "ask": []
  },
  "enabledMcpjsonServers": ["github"],
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command",
      "command": "bash \"${CLAUDE_PROJECT_DIR:-D:/Learn/web-app-match-cv}/.claude/scripts/lesson-detect.sh\"",
      "timeout": 10, "statusMessage": "Quét tín hiệu lesson..." }] }],
    "Stop": [{ "hooks": [{ "type": "command",
      "command": "bash \"${CLAUDE_PROJECT_DIR:-D:/Learn/web-app-match-cv}/.claude/scripts/lesson-flush.sh\"",
      "timeout": 10 }] }]
  },
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true,
    "understand-anything@understand-anything": true,
    "playwright@claude-plugins-official": true,
    "typescript-lsp@claude-plugins-official": true,
    "claude-md-management@claude-plugins-official": true
  }
}
```

- [ ] **Step 3: Verify Task 3** — `.mcp.json` JSON hợp lệ, không track (root không git); `settings.local.json` có trong `.gitignore`.
```bash
node -e "JSON.parse(require('fs').readFileSync('/d/Learn/web-app-match-cv/.mcp.json','utf8'));console.log('mcp OK')"
node -e "JSON.parse(require('fs').readFileSync('/d/Learn/web-app-match-cv/.claude/settings.local.json','utf8'));console.log('settings OK')"
grep -q settings.local.json /d/Learn/web-app-match-cv/.claude/.gitignore && echo "ignored ✓"
```

---

### Task 4: GitHub repos + git init + initial commit + push

**Files:** không tạo file mới; thao tác git trên `<MATCH>\docs` và `<MATCH>\.claude`.

**Interfaces:**
- Consumes: file skeleton từ Task 1–3.
- Produces: 2 repo GitHub private + `origin/main` mỗi repo (worktree flow dùng từ feature sau).

- [ ] **Step 1: Xác nhận identity GitHub**

`mcp__github__get_me` → xác nhận login + quyền tạo repo dưới owner `LeVanAnhDuc`. Nếu login ≠ LeVanAnhDuc và không có quyền → DỪNG, báo user chọn owner khác.

- [ ] **Step 2: Tạo 2 repo private qua MCP**

`mcp__github__create_repository` × 2: `{ name: "doc-web-app-match-cv", private: true, autoInit: false }` và `{ name: "claude-architecture-match-cv", private: true, autoInit: false }`. (autoInit=false để tránh lệch history với initial commit local.)

- [ ] **Step 3: `git init` + branch main + remote mỗi repo**

```bash
for r in docs .claude; do
  git -C "/d/Learn/web-app-match-cv/$r" init -b main
done
git -C /d/Learn/web-app-match-cv/docs remote add origin https://github.com/LeVanAnhDuc/doc-web-app-match-cv.git
git -C /d/Learn/web-app-match-cv/.claude remote add origin https://github.com/LeVanAnhDuc/claude-architecture-match-cv.git
```

- [ ] **Step 4: Stage (KHÔNG commit) + trình diff cho commit gate §7**

```bash
git -C /d/Learn/web-app-match-cv/docs add -A
git -C /d/Learn/web-app-match-cv/.claude add -A   # settings.local.json bị .gitignore loại
git -C /d/Learn/web-app-match-cv/docs status
git -C /d/Learn/web-app-match-cv/.claude status
```
Trình danh sách file staged + tóm tắt nội dung cho user → **đợi duyệt**. Xác nhận `.claude` KHÔNG có `settings.local.json` trong staged.

- [ ] **Step 5: Initial commit + push (sau khi user duyệt)**

```bash
git -C /d/Learn/web-app-match-cv/docs commit -m "chore: init docs skeleton for web-app-match-cv (Tầng A)"
git -C /d/Learn/web-app-match-cv/.claude commit -m "chore: init methodology skeleton (generalized from claude-architecture)"
git -C /d/Learn/web-app-match-cv/docs push -u origin main
git -C /d/Learn/web-app-match-cv/.claude push -u origin main
```

- [ ] **Step 6: Verify Task 4**

```bash
git -C /d/Learn/web-app-match-cv/docs ls-remote --heads origin main
git -C /d/Learn/web-app-match-cv/.claude ls-remote --heads origin main
```
Expected: mỗi repo trả sha cho `main`. Báo user 2 URL repo.

---

## Self-Review

**Spec coverage:**
- design §2 tree → Task 1 (.claude) + Task 2 (docs) + Task 3 (.mcp.json). ✓
- §3 generalize CLAUDE.md → Task 1 Step 2 + Task 2 Step 2. ✓
- §4 placeholder scaffolded → Task 1 Step 6-7, Task 2 Step 3-5. ✓
- §5 bảo mật (no secret track, private, get_me, bootstrap main, commit gate) → Global Constraints + Task 3 + Task 4. ✓
- §6 thứ tự thực thi → Task 1→4. ✓
- §7 non-goals (no server/client, no tech, no mongo/redis) → Global Constraints DEFER. ✓
- **Refinement vs design §5**: `worktree.mjs` + `lib/` DEFER (không copy làm template) — runner BE/FE vô nghĩa khi chưa có server/client. Đã ghi Global Constraints.

**Placeholder scan:** Các "TBD" trong plan là nội-dung-file cố ý (placeholder scaffolded), không phải plan-gap. Mọi bước có lệnh/nội dung cụ thể. ✓

**Type consistency:** Tên repo nhất quán (`doc-web-app-match-cv`, `claude-architecture-match-cv`) xuyên Task 3/4. Denylist grep khớp Global Constraints. ✓
