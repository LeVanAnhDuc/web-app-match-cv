import { beforeEach, describe, expect, it } from "vitest";
import { useWizardStore } from "#/stores";

describe("wizardStore", () => {
  beforeEach(() => useWizardStore.getState().reset());

  it("changing the CV clears stale results — otherwise step 4 shows the wrong document pair's result", () => {
    useWizardStore.setState({
      cvDocId: "cv-1",
      jdDocId: "jd-1",
      runId: "run-1",
      matchId: "match-1",
      pendingCredentialIds: ["cred-1"]
    });

    useWizardStore.getState().setCvDocId("cv-2");

    const s = useWizardStore.getState();
    expect(s.cvDocId).toBe("cv-2");
    expect(s.runId).toBeNull();
    expect(s.matchId).toBeNull();
    expect(s.pendingCredentialIds).toEqual([]);
  });

  it("changing the JD also clears stale results", () => {
    useWizardStore.setState({ jdDocId: "jd-1", runId: "run-1" });

    useWizardStore.getState().setJdDocId("jd-2");

    expect(useWizardStore.getState().runId).toBeNull();
  });

  it("re-picking the same document does NOT clear results", () => {
    useWizardStore.setState({ cvDocId: "cv-1", runId: "run-1" });

    useWizardStore.getState().setCvDocId("cv-1");

    expect(useWizardStore.getState().runId).toBe("run-1");
  });

  it("jumpTo only goes back to a completed step", () => {
    useWizardStore.setState({ step: 3, cvDocId: "cv-1", jdDocId: "jd-1" });

    useWizardStore.getState().jumpTo(1);
    expect(useWizardStore.getState().step).toBe(1);

    useWizardStore.getState().jumpTo(4);
    expect(useWizardStore.getState().step).toBe(1);
  });
});
