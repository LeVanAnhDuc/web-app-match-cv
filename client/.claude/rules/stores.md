---
name: stores
paths:
  - "src/stores/**/*"
---

# Stores Convention (src/stores/)

Global client state bằng **Zustand**. Mỗi store = 1 slice trong `stores/slices/<name>.ts`; `stores/index.ts` là **barrel** re-export.

## Cấu trúc

```
src/stores/
  index.ts              # barrel: export * from './slices/wizard'  ...
  slices/
    wizard.ts           # useWizardStore
```

## Ví dụ — `src/stores/slices/wizard.ts`

```ts
import { create } from "zustand";
import type { WizardStep } from "#/types/Wizard";

interface WizardState {
  step: WizardStep;
  jdDocId: string | null;
  cvDocId: string | null;
  matchId: string | null;
  setStep: (step: WizardStep) => void;
  setJdDocId: (id: string) => void;
  setCvDocId: (id: string) => void;
  setMatchId: (id: string) => void;
  goNext: () => void;
  goBack: () => void;
  reset: () => void;
}

const initialState = {
  step: 1 as WizardStep,
  jdDocId: null as string | null,
  cvDocId: null as string | null,
  matchId: null as string | null
};

export const useWizardStore = create<WizardState>((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setJdDocId: (id) => set({ jdDocId: id }),
  setCvDocId: (id) => set({ cvDocId: id }),
  setMatchId: (id) => set({ matchId: id }),
  goNext: () => set((s) => ({ step: Math.min(4, s.step + 1) as WizardStep })),
  goBack: () => set((s) => ({ step: Math.max(1, s.step - 1) as WizardStep })),
  reset: () => set({ ...initialState })
}));
```

```ts
// src/stores/index.ts
export * from "./slices/wizard";
```

## Truy cập ngoài React — `useXStore.getState()`

Trong React: selector `useWizardStore((s) => s.step)` (chỉ subscribe field cần → tránh re-render thừa). Ngoài React (util, request handler, event listener): đọc/ghi imperative qua `getState()` / `setState()`:

```ts
const { jdDocId, cvDocId } = useWizardStore.getState();
useWizardStore.getState().reset();
```

## Quy tắc

1. Chỉ đưa vào store state **client-side dùng chung nhiều nơi** (VD tiến trình wizard qua các bước). **Server state** (data từ API) thuộc React Query (`src/hooks/`) — KHÔNG nhân bản DTO vào Zustand.
2. State shape / union dùng chung (VD `WizardStep`) → khai báo ở `#/types/<Domain>`; interface nội bộ store có thể để trong file store.
3. Trong component ưu tiên selector hẹp; ngoài React dùng `getState()`.
4. Store dùng ở đúng 1 view và không cần cross-component → cân nhắc local state/props trước; chỉ nâng lên store khi thật sự cần chia sẻ.
