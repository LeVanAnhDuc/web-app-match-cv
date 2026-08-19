---
name: views
paths:
  - "src/views/**/*"
---

# View Folder Structure

`src/views/` chứa các **page-level composition** (một view = một màn hình / feature UI, được render bởi 1 route trong `src/routes/`). Route file trong `src/routes/` giữ mỏng — chỉ import và render view tương ứng.

Mỗi view tuân cấu trúc:

```
src/views/<ViewName>/
  index.tsx        # Entry / page shell — compose từ mains/ (+ ghosts/)
  mains/           # Organism — import TRỰC TIẾP bởi index.tsx
    StepJD/index.tsx
    StepCV/index.tsx
    StepReview/index.tsx
    StepResult/index.tsx
  components/       # Molecule — view-local, chỉ dùng bên trong mains/ (hoặc components/ khác)
    Stepper/index.tsx
    DocumentInputPanel/index.tsx
  ghosts/          # (optional) Headless side-effect components — return null
    SyncWizardStep/index.tsx
```

Ví dụ cụ thể — `src/views/Wizard/`:

- `index.tsx` = shell: brand header + step badge + `<Stepper />` + render step body theo `useWizardStore((s) => s.step)`.
- `mains/StepJD`, `mains/StepCV`, `mains/StepReview`, `mains/StepResult` = 4 organism cho 4 bước, index import trực tiếp.
- `components/Stepper`, `components/DocumentInputPanel` = molecule view-local, lắp bởi các `mains/`.

## mains/ vs components/ — Placement Rule

- Component được `views/<View>/index.tsx` import trực tiếp → `mains/<Name>/index.tsx` (organism).
- Component chỉ được `mains/` (hoặc `components/` khác) import → `components/<Name>/index.tsx` (molecule).

```tsx
// ✅ index.tsx chỉ import từ mains/
import StepJD from "./mains/StepJD";

// ✅ mains/ mới được import components/
import Stepper from "../../components/Stepper";
```

Nếu 1 component ở `components/` sau đó được index gốc dùng → **di chuyển sang `mains/`**.

## index.tsx (Page Entry / Shell)

Chỉ import & compose từ `mains/` (+ `ghosts/`) — không chứa logic phức tạp hay UI chi tiết:

```tsx
const Wizard = () => {
  const step = useWizardStore((s) => s.step);
  return (
    <div className="...">
      <Stepper current={step} />
      {step === 1 && <StepJD />}
      {step === 2 && <StepCV />}
      {step === 3 && <StepReview />}
      {step === 4 && <StepResult />}
    </div>
  );
};

export default Wizard;
```

## ghosts/ (optional)

Headless component chỉ chứa side effect (`useEffect` sync, subscription) và luôn `return null` — chi tiết `ghosts.md`. Ghost chỉ dùng 1 view → `views/<View>/ghosts/`; dùng ≥ 2 view → nâng lên `src/ghosts/`.

## Quy tắc

1. Component dùng chung ≥ 2 view → nâng lên `src/components/` (xem `components.md`).
2. `index.tsx` chỉ import từ `mains/` (+ `ghosts/`), KHÔNG import trực tiếp `components/`.
3. `mains/` được phép import `components/` cùng view.
4. Types dùng chung của view → `src/types/<Domain>/index.ts`; props component viết inline (xem `types.md`).
5. React Query hook (`useDocument`, `useRunMatch`…) sống ở `src/hooks/`, view chỉ gọi hook — KHÔNG khai báo `useQuery`/`useMutation` inline trong view (xem `hooks.md`).
6. State chia sẻ giữa các bước (VD `useWizardStore`) sống ở `src/stores/` (xem `stores.md`).
