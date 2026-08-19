---
name: component-folder
paths:
  - "src/**/*.tsx"
---

# Component Folder Convention

- Mỗi component là **một folder** chứa `index.tsx` — KHÔNG dùng file `.tsx` đơn lẻ (VD: `Stepper/index.tsx`, KHÔNG phải `Stepper.tsx`).
- Đặt tên folder theo PascalCase, trùng tên component export.
- Luôn viết dưới dạng **arrow function** và **export default** duy nhất 1 component trùng tên với folder:

  ```tsx
  // Stepper/index.tsx
  const Stepper = () => {
    // ...
    return <div>...</div>;
  };

  export default Stepper;
  ```

- **Một component EXPORT / một file**: file `index.tsx` chỉ `export default` **đúng 1** component (arrow const, trùng tên folder). KHÔNG có `export` thứ hai.
- **Helper PRIVATE được phép co-locate**: trong cùng file được khai báo các phần tử **KHÔNG export** phục vụ riêng component đó:
  - **sub-component dùng-một-chỗ**: ưu tiên `function Xxx() {}` (function declaration, không phải const) — VD `Dot` trong `Stepper/index.tsx`, `ScoreBar`/`ReportList` trong `StepResult/index.tsx`.
  - **data/config const gắn chặt component**: VD `STEPS`, `GAUGE_RADIUS`.
  - **helper thuần nhỏ** chỉ dùng nội bộ.
    Ngay khi một phần tử này bị **dùng lại ở file khác** → phải chuyển ra: sub-component → folder component riêng; hằng dùng chung → `CONSTANTS` (`constants.md`); type dùng chung → `types/` (`types.md`); pure fn dùng chung → `utils/` (`utils.md`).

## Quy tắc export trong `index.tsx` / `index.ts`

Phân biệt **2 loại file** `index`:

### A. Component file (default)

File `index.tsx` định nghĩa **một component cụ thể** → CHỈ `export default` duy nhất 1 component. **KHÔNG** có `export` thứ hai (không named export type, hằng số, helper, sub-component…). Lưu ý: cấm là cấm **export** thứ hai — khai báo **private không export** để dùng nội bộ file thì được phép (xem "Helper PRIVATE" ở trên).

Nếu cần **export / dùng lại** ở nơi khác:

- Pure function / helper → `src/utils/` (xem `utils.md`)
- Type / interface dùng chung → `src/types/<Domain>/index.ts` (xem `types.md`)
- Type props của component → viết **inline** tại tham số (xem `types.md`)
- Constant / config → `CONSTANTS` trong `src/constants/` (xem `constants.md`)
- Sub-component → tách folder component riêng (xem `views.md` cho quy tắc `mains/` ↔ `components/`)
- React Query hook → `src/hooks/` gọi request pure fn ở `src/requests/` (xem `hooks.md`, `requests.md`)
- Nếu không quyết định được nơi đặt → **hỏi user**, KHÔNG tự suy luận.

### B. Barrel file (ngoại lệ được phép)

File `index.ts` **chỉ re-export** giữa bên ngoài và các module con trong folder → ĐƯỢC PHÉP nhiều `export { default as X } from './X'` hoặc `export * from './X'`, KHÔNG default export riêng, KHÔNG chứa logic.

Đây là **ngoại lệ DUY NHẤT** cho quy tắc "1 export default". Ví dụ hợp lệ: `src/hooks/index.ts`, `src/utils/index.ts`, `src/stores/index.ts`.

**Điều kiện (PHẢI thỏa MỌI điều)**:

1. File chỉ chứa các dòng `export { default as X } from './X'` hoặc `export * from './X'` — KHÔNG khai báo thêm component / type / const / function.
2. Folder chứa barrel có ≥ 2 module con cùng "họ".
3. KHÔNG dùng barrel cho 1 component đơn lẻ — component đơn phải tuân quy tắc A.

Mọi file `index.tsx` ngoài 2 loại A/B đều coi là **vi phạm**.
