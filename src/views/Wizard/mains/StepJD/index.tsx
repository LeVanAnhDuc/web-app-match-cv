import { useWizardStore } from "#/stores";
import DocumentInputStep from "../../components/DocumentInputStep";

const StepJD = () => {
  const setJdDocId = useWizardStore((s) => s.setJdDocId);
  const goNext = useWizardStore((s) => s.goNext);

  return (
    <DocumentInputStep
      kind="JD"
      onNext={(docId) => {
        setJdDocId(docId);
        goNext();
      }}
    />
  );
};

export default StepJD;
