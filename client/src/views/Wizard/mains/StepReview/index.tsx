import { Button } from "antd";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import DocumentPreview from "#/components/DocumentPreview";
import SectionCard from "#/components/SectionCard";
import { useDocument } from "#/hooks/useDocuments";
import { useCreateMatchRun } from "#/hooks/useMatch";
import { useWizardStore } from "#/stores";
import RunWithSelector from "../../components/RunWithSelector";

const StepReview = () => {
  const { t } = useTranslation();
  const jdDocId = useWizardStore((s) => s.jdDocId);
  const cvDocId = useWizardStore((s) => s.cvDocId);
  const credentialIds = useWizardStore((s) => s.credentialIds);
  const setCredentialIds = useWizardStore((s) => s.setCredentialIds);
  const startRun = useWizardStore((s) => s.startRun);
  const goNext = useWizardStore((s) => s.goNext);
  const goBack = useWizardStore((s) => s.goBack);

  const jdQuery = useDocument(jdDocId);
  const cvQuery = useDocument(cvDocId);
  const createRun = useCreateMatchRun();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRunMatch() {
    if (!cvDocId || !jdDocId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      // Open the run first so step 4 has an id to render skeletons against;
      // the per-provider requests are fired by the cards themselves.
      const run = await createRun.mutateAsync({
        cvDocumentId: cvDocId,
        jdDocumentId: jdDocId
      });
      startRun(run.id, credentialIds);
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("err.matchFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Guard: reaching step 3 without a JD/CV id → useDocument(null) is disabled
  // and never resolves, so offer a way back instead of hanging on the spinner.
  if (!jdDocId || !cvDocId) {
    return (
      <SectionCard
        className="h-full"
        bodyClassName="flex h-full flex-col items-center justify-center gap-4 p-8 md:p-16"
      >
        <p role="alert" className="font-medium text-muted">
          {t("review.missingDocs")}
        </p>
        <Button icon={<ArrowLeft size={16} />} onClick={goBack}>
          {t("action.back")}
        </Button>
      </SectionCard>
    );
  }

  const isLoadingDocs =
    jdQuery.isLoading || cvQuery.isLoading || !jdQuery.data || !cvQuery.data;

  if (isLoadingDocs) {
    return (
      <SectionCard
        className="h-full"
        bodyClassName="flex h-full items-center justify-center gap-3 p-8 md:p-16"
      >
        <Loader2 className="animate-spin text-faint" size={20} />
        <p className="font-medium text-faint">{t("review.loading")}</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      fill
      className="h-full"
      title={t("wizard.stepReview.title")}
      description={t("wizard.stepReview.description")}
      bodyClassName="flex min-h-0 flex-1 flex-col p-0"
      footer={
        <>
          <Button
            type="text"
            icon={<ArrowLeft size={16} />}
            onClick={goBack}
            className="!text-muted"
          >
            {t("action.back")}
          </Button>
          <Button
            type="primary"
            loading={isSubmitting}
            disabled={credentialIds.length === 0}
            onClick={() => void handleRunMatch()}
            icon={<Sparkles size={16} />}
          >
            {credentialIds.length > 1
              ? t("action.runMatchCount", { count: credentialIds.length })
              : t("action.runMatch")}
          </Button>
        </>
      }
    >
      <RunWithSelector value={credentialIds} onChange={setCredentialIds} />
      <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-line lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <section className="flex min-h-0 flex-col p-4 md:p-6">
          <h3 className="mb-4 shrink-0 text-xs font-semibold tracking-wider text-faint uppercase">
            {t("step.cv")}
          </h3>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-line">
            <DocumentPreview
              docId={cvDocId}
              sourceFormat={cvQuery.data.sourceFormat}
              rawText={cvQuery.data.rawText}
            />
          </div>
        </section>
        <section className="flex min-h-0 flex-col p-4 md:p-6">
          <h3 className="mb-4 shrink-0 text-xs font-semibold tracking-wider text-faint uppercase">
            {t("step.jd")}
          </h3>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-line">
            <DocumentPreview
              docId={jdDocId}
              sourceFormat={jdQuery.data.sourceFormat}
              rawText={jdQuery.data.rawText}
            />
          </div>
        </section>
      </div>
      {error && (
        <p
          role="alert"
          className="shrink-0 px-4 pb-4 text-sm text-red-600 md:px-6 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </SectionCard>
  );
};

export default StepReview;
