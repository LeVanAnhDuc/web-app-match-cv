---
name: layouts
paths:
  - "src/layouts/**/*"
---

# Layout Folder Structure

`src/layouts/` chứa **shell bao quanh route** — chrome của app (sidebar, header, drawer nav, footer) render `children`/`<Outlet />`, KHÔNG phải nội dung của một màn hình cụ thể. Một layout được lắp bởi **pathless layout route** trong `src/routes/` (VD `routes/_app.tsx`), không map 1-1 với một URL.

```
src/layouts/<LayoutName>/
  index.tsx        # Shell — nhận children, dựng chrome
  components/      # Molecule layout-local (Sidebar, ...)
    Sidebar/index.tsx
  __tests__/       # Test của layout
```

Ví dụ cụ thể — `src/layouts/AppShell/`:

- `index.tsx` = shell: `>=lg` fixed sidebar (thu gọn thành icon rail), `<lg` header + antd `Drawer`; `<main>` tự cuộn.
- `components/Sidebar` = nav dùng chung cho cả aside và Drawer.

## layouts/ vs views/

| Đặt ở          | Khi                                                           |
| -------------- | ------------------------------------------------------------- |
| `src/layouts/` | Bọc route con qua `children`/`<Outlet />`, dùng bởi ≥ 1 route |
| `src/views/`   | Nội dung 1 màn hình, render bởi đúng 1 route (xem `views.md`) |

Layout KHÔNG có `mains/` — nó không phải page composition. Component lớn của layout đặt ở `components/` cùng folder.

## Quy tắc

1. Import từ ngoài luôn qua alias: `import AppShell from "#/layouts/AppShell"` (xem `imports.md`).
2. Component dùng chung ≥ 2 nơi (layout + view) → nâng lên `src/components/` (xem `components.md`).
3. Cấu trúc file/export theo `component-folder.md`; token & layout primitive theo `layout-primitives.md`.
4. State chia sẻ (VD `useUiStore` cho sidebar thu/mở) sống ở `src/stores/`; layout chỉ đọc/gọi (xem `stores.md`).
5. Layout chạy trong SSR → giá trị persist (`localStorage`) chỉ đọc **sau mount** bằng effect, không đọc lúc render.
