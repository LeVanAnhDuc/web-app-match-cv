# ADR-0018 · Cả sản phẩm là một git repo; `.claude/` là ngoại lệ duy nhất

> **Ngày:** 2026-09-03
> **Trạng thái:** accepted
> **Liên quan:** supersedes ADR-0001

## 1. Bối cảnh

[ADR-0001](0001-monorepo-nhieu-git-repo-doc-lap.md) tách sản phẩm thành bốn git repo.
Trên thực tế `client-web-app-match-cv`, `api-web-app-match-cv` và
`doc-web-app-match-cv` đã được gộp vào một repo bằng `git subtree` (lịch sử giữ
nguyên), và ba repo con đó **đã bị xoá khỏi GitHub ngày 2026-09-03**. Tài liệu vẫn mô
tả thế giới cũ, nên vẫn dặn tạo worktree per-repo và mở PR per-repo cho một feature.

## 2. Quyết định

**`web-app-match-cv` là một git repo.** `client/`, `server/` và `docs/` là thư mục
trong cùng repo đó: một thay đổi trải nhiều thư mục là **một commit và một PR**.

Ngoại lệ duy nhất là `.claude/` — repo riêng (`claude-architecture-match-cv`) lồng bên
trong, bị app repo gitignore. Nó commit tách và PR tách.

Ba slug đã xoá **không được tái sử dụng**: `client-web-app-match-cv`,
`api-web-app-match-cv`, `doc-web-app-match-cv`.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Giữ nguyên bốn repo | Một feature cross-stack thành 2–4 PR phải merge đúng thứ tự, và không `git log` nào kể được toàn bộ câu chuyện |
| Gộp luôn `.claude/` vào app repo | Tầng methodology dùng chung cho nhiều sản phẩm và có vòng đời riêng; gộp vào thì mỗi lần sửa quy trình lại lẫn vào lịch sử sản phẩm |

## 4. Hệ quả

**Được:**

- Một commit, một PR, một lịch sử cho mỗi feature.
- Worktree là **một** cho cả feature, không phải một bộ.

**Mất / phải chấp nhận:**

- Vẫn còn hai repo phải nhớ (app + `.claude/`), nên vẫn có ca "quên commit bên kia".
- Mọi tài liệu cũ mô tả bốn repo đều **stale** — gặp thì sửa, đừng làm theo.

**Điều kiện xem lại quyết định này:** nếu `.claude/` được đưa vào một cơ chế phân phối
khác (plugin, marketplace) và hết cần là git repo riêng.
