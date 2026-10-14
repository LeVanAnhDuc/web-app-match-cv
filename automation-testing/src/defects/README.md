# defects/

**App đang sai ở đâu.** Một file mỗi module: `<module>.md`.

```md
# SIGNIN — Bug log

## Đang mở

| Bug | Mức | TC | Tóm tắt |
|---|---|---|---|
| [BUG-SIGNIN-01](#bug-signin-01) | Cao | TC-SIGNIN-016 | … |

### BUG-SIGNIN-01

- **TC:** TC-SIGNIN-016 · **Requirement:** REQ-SIGNIN-08
- **Bước tái hiện:** …
- **Mong đợi:** …
- **Thực tế:** …

## Đã sửa

_(chưa có)_
```

- Spec đánh dấu bằng comment `// BUG: defects/<module>.md#bug-<module>-nn` **ngay trên** `test.fail()`.
- App được sửa → test đỏ vì "pass ngoài dự kiến" → bỏ comment + `test.fail()`, chuyển mục `### BUG-…` xuống `## Đã sửa`.
- `pnpm coverage:check` kiểm hai chiều: comment trỏ bug có thật và đang mở; bug đang mở có spec đánh dấu.
