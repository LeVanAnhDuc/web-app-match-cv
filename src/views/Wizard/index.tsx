import PageContainer from "#/components/PageContainer";
import { useWizardStore } from "#/stores";
import Stepper from "./components/Stepper";
import StepCV from "./mains/StepCV";
import StepJD from "./mains/StepJD";
import StepResult from "./mains/StepResult";
import StepReview from "./mains/StepReview";

const Wizard = () => {
  const step = useWizardStore((s) => s.step);

  return (
    <PageContainer className="flex h-full flex-col">
      <Stepper current={step} />
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
