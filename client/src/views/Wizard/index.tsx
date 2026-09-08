import PageContainer from "#/components/PageContainer";
import { useWizardStore } from "#/stores";
import type { WizardStep } from "#/types/Wizard";
import Stepper from "./components/Stepper";
import StepCV from "./mains/StepCV";
import StepJD from "./mains/StepJD";
import StepResult from "./mains/StepResult";
import StepReview from "./mains/StepReview";

const Wizard = () => {
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

  return (
    <PageContainer className="flex flex-col lg:h-full">
      <Stepper current={step} blockedFrom={blockedFrom} onJump={jumpTo} />
      <div className="flex min-h-0 flex-1 flex-col">
        {step === 1 && <StepJD />}
        {step === 2 && <StepCV />}
        {step === 3 && <StepReview />}
        {step === 4 && <StepResult />}
      </div>
    </PageContainer>
  );
};

export default Wizard;
