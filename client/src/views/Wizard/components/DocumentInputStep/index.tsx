import { Button } from "antd";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "#/components/SectionCard";
import { useCreateDocument } from "#/hooks/useDocuments";
import { FILE } from "#/constants";
import type { DocumentKind } from "#/types/Documents";
import type { InputMode } from "#/types/Wizard";
import SaveForReuseButton from "../SaveForReuseButton";
import SavedDocRadioList from "../SavedDocRadioList";
import UploadPasteTabs from "../UploadPasteTabs";

const DocumentInputStep = ({
  kind,
  onNext,
  onBack
}: {
  kind: DocumentKind;
  onNext: (docId: string) => void;
  onBack?: () => void;
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<InputMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createDocument = useCreateDocument();

  const stepCopyKey = kind === "JD" ? "wizard.stepJd" : "wizard.stepCv";
  const reuseKey = kind === "JD" ? "jd" : "cv";

  const hasNewInput =
    mode === "upload" ? file !== null : pastedText.trim().length > 0;
  const canSubmit = selectedSavedId !== null || hasNewInput;

  function resetDerived() {
    setSelectedSavedId(null);
    setSavedId(null);
    setSavedTitle(null);
    setValidationError(null);
  }

  function handleModeChange(next: InputMode) {
    setMode(next);
    resetDerived();
  }

  function handleFileChange(next: File | null) {
    if (next) {
      if (!FILE.ALLOWED_PATTERN.test(next.name)) {
        setValidationError(t("err.fileType"));
        return;
      }
      if (next.size > FILE.MAX_SIZE_BYTES) {
        setValidationError(t("err.fileSize", { max: FILE.MAX_SIZE_LABEL }));
        return;
      }
    }
    setFile(next);
    resetDerived();
  }

  function handlePastedTextChange(next: string) {
    setPastedText(next);
    resetDerived();
  }

  function handleSelectSaved(id: string) {
    setSelectedSavedId(id);
    setFile(null);
    setPastedText("");
    setSavedId(null);
    setSavedTitle(null);
    setValidationError(null);
  }

  function createFromInput(save: boolean, title?: string) {
    return mode === "upload" && file
      ? createDocument.mutateAsync({ mode: "file", kind, file, save, title })
      : createDocument.mutateAsync({
          mode: "paste",
          kind,
          sourceText: pastedText.trim(),
          save,
          title
        });
  }

  async function handleSaveForReuse(name: string) {
    const created = await createFromInput(true, name);
    setSavedId(created.id);
    setSavedTitle(name);
  }

  async function handleNext() {
    if (selectedSavedId) {
      onNext(selectedSavedId);
      return;
    }
    if (!hasNewInput) {
      setValidationError(t("err.empty", { kind: t(`step.${reuseKey}`) }));
      return;
    }
    if (savedId) {
      onNext(savedId);
      return;
    }
    setIsSubmitting(true);
    setValidationError(null);
    try {
      const created = await createFromInput(false);
      onNext(created.id);
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : t("err.parseFailed")
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SectionCard
      fill
      stickyFooter
      className="h-full"
      title={t(`${stepCopyKey}.title`)}
      description={t(`${stepCopyKey}.description`)}
      footer={
        <>
          <Button
            type="text"
            size="large"
            disabled={!onBack}
            icon={<ArrowLeft size={16} />}
            onClick={onBack}
            className="!text-muted"
          >
            {t("action.back")}
          </Button>
          <Button
            type="primary"
            size="large"
            disabled={!canSubmit}
            loading={isSubmitting || createDocument.isPending}
            onClick={() => void handleNext()}
            iconPosition="end"
            icon={<ArrowRight size={16} />}
          >
            {t("action.next")}
          </Button>
        </>
      }
    >
      <>
        <UploadPasteTabs
          mode={mode}
          onModeChange={handleModeChange}
          file={file}
          onFileChange={handleFileChange}
          pastedText={pastedText}
          onPastedTextChange={handlePastedTextChange}
          maxSizeLabel={FILE.MAX_SIZE_LABEL}
        />
        {hasNewInput && (
          <div className="mb-8">
            <SaveForReuseButton
              kind={kind}
              savedTitle={savedTitle}
              onSave={handleSaveForReuse}
            />
          </div>
        )}
        <div>
          <h3 className="mb-4 text-xs font-semibold tracking-wider text-faint uppercase">
            {t(`reuse.${reuseKey}.title`)}
          </h3>
          <SavedDocRadioList
            kind={kind}
            selectedId={selectedSavedId}
            onSelect={handleSelectSaved}
          />
        </div>
        {validationError && (
          <p
            role="alert"
            className="mt-4 text-sm text-red-600 dark:text-red-400"
          >
            {validationError}
          </p>
        )}
      </>
    </SectionCard>
  );
};

export default DocumentInputStep;
