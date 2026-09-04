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
  /**
   * Step 4 only StepResult knows whether its query landed on a report or on a
   * loading/error/guard screen — the shell reads this to decide whether its
   * pinned action bar (which offers "Save report") may render at all.
   */
  resultReady: boolean;
  setStep: (step: WizardStep) => void;
  setJdDocId: (id: string) => void;
  setCvDocId: (id: string) => void;
  setMatchId: (id: string) => void;
  setCredentialIds: (ids: Array<string | null>) => void;
  startRun: (runId: string, credentialIds: Array<string | null>) => void;
  goNext: () => void;
  goBack: () => void;
  /** Backward-only: jumping ahead to a step without its data would show a blank/stale screen. */
  jumpTo: (step: WizardStep) => void;
  setResultReady: (ready: boolean) => void;
  reset: () => void;
}

const initialState = {
  step: 1 as WizardStep,
  jdDocId: null as string | null,
  cvDocId: null as string | null,
  matchId: null as string | null,
  credentialIds: [] as Array<string | null>,
  runId: null as string | null,
  pendingCredentialIds: [] as Array<string | null>,
  resultReady: false
};

export const useWizardStore = create<WizardState>((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  // Changing the document invalidates any run/match already tied to the
  // previous pair — otherwise step 4 keeps showing a stale result computed
  // for a different CV/JD combination. No-op when re-picking the same id.
  setJdDocId: (id) =>
    set((s) =>
      s.jdDocId === id
        ? s
        : { jdDocId: id, runId: null, matchId: null, pendingCredentialIds: [] }
    ),
  setCvDocId: (id) =>
    set((s) =>
      s.cvDocId === id
        ? s
        : { cvDocId: id, runId: null, matchId: null, pendingCredentialIds: [] }
    ),
  setMatchId: (id) => set({ matchId: id }),
  setCredentialIds: (ids) => set({ credentialIds: ids }),
  startRun: (runId, credentialIds) =>
    set({ runId, pendingCredentialIds: credentialIds }),
  goNext: () => set((s) => ({ step: Math.min(4, s.step + 1) as WizardStep })),
  goBack: () => set((s) => ({ step: Math.max(1, s.step - 1) as WizardStep })),
  jumpTo: (step) => set((s) => (step < s.step ? { step } : s)),
  setResultReady: (ready) => set({ resultReady: ready }),
  reset: () => set({ ...initialState })
}));
