import { create } from "zustand";
import type { WizardStep } from "#/types/Wizard";

interface WizardState {
  step: WizardStep;
  jdDocId: string | null;
  cvDocId: string | null;
  matchId: string | null;
  /** One entry per provider chosen; `null` inside the array = the system key. */
  credentialIds: Array<string | null>;
  runId: string | null;
  /** Which providers still need firing this session. Empty after a reload. */
  pendingCredentialIds: Array<string | null>;
  setStep: (step: WizardStep) => void;
  setJdDocId: (id: string) => void;
  setCvDocId: (id: string) => void;
  setMatchId: (id: string) => void;
  setCredentialIds: (ids: Array<string | null>) => void;
  startRun: (runId: string, credentialIds: Array<string | null>) => void;
  goNext: () => void;
  goBack: () => void;
  reset: () => void;
}

const initialState = {
  step: 1 as WizardStep,
  jdDocId: null as string | null,
  cvDocId: null as string | null,
  matchId: null as string | null,
  credentialIds: [] as Array<string | null>,
  runId: null as string | null,
  pendingCredentialIds: [] as Array<string | null>
};

export const useWizardStore = create<WizardState>((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setJdDocId: (id) => set({ jdDocId: id }),
  setCvDocId: (id) => set({ cvDocId: id }),
  setMatchId: (id) => set({ matchId: id }),
  setCredentialIds: (ids) => set({ credentialIds: ids }),
  startRun: (runId, credentialIds) =>
    set({ runId, pendingCredentialIds: credentialIds }),
  goNext: () => set((s) => ({ step: Math.min(4, s.step + 1) as WizardStep })),
  goBack: () => set((s) => ({ step: Math.max(1, s.step - 1) as WizardStep })),
  reset: () => set({ ...initialState })
}));
