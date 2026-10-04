import { useSearch } from "@tanstack/react-router";
import { Skeleton } from "antd";
import PageContainer from "#/components/PageContainer";
import SectionCard from "#/components/SectionCard";
import { useWizardStore } from "#/stores";
import type { WizardStep } from "#/types/Wizard";
import Stepper from "./components/Stepper";
import OpenRunFromUrl from "./ghosts/OpenRunFromUrl";
import ClaimedNotice from "./mains/ClaimedNotice";
import StepCV from "./mains/StepCV";
import StepJD from "./mains/StepJD";
import StepResult from "./mains/StepResult";
import StepReview from "./mains/StepReview";

const Wizard = () => {
  const { runId: searchRunId } = useSearch({ from: "/_app/wizard" });
  const step = useWizardStore((s) => s.step);
  const cvDocId = useWizardStore((s) => s.cvDocId);
  const jdDocId = useWizardStore((s) => s.jdDocId);
  const runId = useWizardStore((s) => s.runId);
  const matchId = useWizardStore((s) => s.matchId);
  const jumpTo = useWizardStore((s) => s.jumpTo);
  // 5 = nothing blocked yet; WizardStep is left as the 1-4 union used elsewhere.
  const blockedFrom: WizardStep | 5 = !jdDocId
    ? 2
    : !cvDocId
      ? 3
      : !runId && !matchId
        ? 4
        : 5;
  // `?runId=` not opened yet: show neither step 1 nor a half-filled step 4.
  // Derived from the URL + store alone, so the server render matches.
  const reopening = Boolean(searchRunId) && searchRunId !== runId;

  return (
    <PageContainer className="flex flex-col lg:h-full">
      <OpenRunFromUrl />
      <Stepper current={step} blockedFrom={blockedFrom} onJump={jumpTo} />
      <ClaimedNotice />
      <div className="flex min-h-0 flex-1 flex-col">
        {reopening ? (
          <div aria-busy="true">
            <SectionCard>
              <Skeleton active paragraph={{ rows: 4 }} />
            </SectionCard>
          </div>
        ) : (
          <>
            {step === 1 && <StepJD />}
            {step === 2 && <StepCV />}
            {step === 3 && <StepReview />}
            {step === 4 && <StepResult />}
          </>
        )}
      </div>
    </PageContainer>
  );
};

export default Wizard;
