import { useWizardStore } from "#/stores";
import DocumentInputStep from "../../components/DocumentInputStep";

const StepJD = () => {
  const jdDocId = useWizardStore((s) => s.jdDocId);
  const setJdDocId = useWizardStore((s) => s.setJdDocId);
  const goNext = useWizardStore((s) => s.goNext);

  return (
    <DocumentInputStep
      kind="JD"
      currentDocId={jdDocId}
      onNext={(docId) => {
        setJdDocId(docId);
        goNext();
      }}
    />
  );
};

export default StepJD;
