# GUESTMODE — Bug log

Không có mục `## Gom từ …` để chuyển: lúc scaffold module này chỉ gom về hai spec (`tests/e2e/guest-mode/guest.e2e.ts`,
`tests/api/guest-mode/guest-quota.api.ts`), không có `e2e-bugs.md` cũ nào.

## Đang mở

_(không có)_

## Đã sửa

### BUG-GUESTMODE-01

- **TC:** TC-GUESTMODE-015, TC-GUESTMODE-016 · **Requirement:** REQ-GUESTMODE-09
- **Bước tái hiện:**
  1. Khách A (bộ đếm IP đang 0) gọi `POST /match` với `cvDocumentId` / `jdDocumentId` của khách B → 400 `matching.errors.documentNotOwned`.
  2. Hoặc: khách A gọi `POST /match` với cặp tài liệu của mình nhưng `runId` của một run mở trên cặp khác → 400.
  3. `GET /auth/me`.
- **Mong đợi:** request bị từ chối không tốn lượt — `guestQuota.used` vẫn 0 (lượt chỉ trừ sau khi body, quyền sở hữu
  và `runId` đã hợp lệ, ngay trước call AI — quyết định Q1 trong `docs/decisions/guest-mode.md`).
- **Thực tế:** `used` = 1 sau mỗi request như vậy. `server/src/modules/matching/matching.service.ts` `createMatch` gọi
  `guestUsage.consume(ip)` trước `requireOwnedPair` và `requireRunMatches`; năm request sai là khách hết lượt cả ngày
  trên IP đó mà không chạy được match nào.
- **Đã sửa:** root cause — `createMatch` gọi `guestUsage.consume(ip)` trước `requireOwnedPair` / `requireRunMatches`; fix — giữ 403 credential ở đầu, chuyển bước trừ lượt xuống sau hai kiểm tra đó, vẫn trước call AI (commit: _pending_).
