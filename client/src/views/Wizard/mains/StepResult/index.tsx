import { Alert, Button } from "antd";
import { Loader2, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "#/components/SectionCard";
import { useMatchResult, useMatchRun } from "#/hooks/useMatch";
import { ApiError } from "#/libs/api";
import { useWizardStore } from "#/stores";
import MatchResultCard from "../../components/MatchResultCard";

type ResultPhase =
  | "single-loading"
  | "single-error"
  | "single-success"
  | "guard"
  | "run-loading"
  | "run-error"
  | "run-success";

const StepResult = () => {
  const { t } = useTranslation();
  const runId = useWizardStore((s) => s.runId);
  const matchId = useWizardStore((s) => s.matchId);
  const cvDocId = useWizardStore((s) => s.cvDocId);
  const jdDocId = useWizardStore((s) => s.jdDocId);
  const pending = useWizardStore((s) => s.pendingCredentialIds);
  const reset = useWizardStore((s) => s.reset);
  const setResultReady = useWizardStore((s) => s.setResultReady);

  const isLive = pending.length > 0;
  const isSingle = !runId && matchId !== null;
  // Only fetch on the reload path — during a live run the cards are the source
  // of truth and a fetch would race them.
  const runQuery = useMatchRun(runId, !isLive && !isSingle);
  const singleQuery = useMatchResult(isSingle ? matchId : null);

  // One priority chain drives both what renders below AND whether the shell
  // may show its pinned "Start over" / "Save report" bar — only the two
  // "-success" phases have an actual report, and only those phases keep no
  // inline "Start over" of their own (see the branches below), so the shell
  // bar never ends up doubled with this component's own recovery button.
  const phase: ResultPhase = isSingle
    ? singleQuery.isLoading
      ? "single-loading"
      : singleQuery.isError || !singleQuery.data
        ? "single-error"
        : "single-success"
    : !runId || !cvDocId || !jdDocId
      ? "guard"
      : !isLive && runQuery.isLoading
        ? "run-loading"
        : !isLive && runQuery.isError
          ? "run-error"
          : "run-success";

  const isReportReady = phase === "single-success" || phase === "run-success";

  useEffect(() => {
    setResultReady(isReportReady);
    return () => setResultReady(false);
  }, [isReportReady, setResultReady]);

  const startOver = (
    <Button
      type="text"
      size="large"
      icon={<RotateCcw size={16} />}
      onClick={reset}
      className="!text-muted"
    >
      {t("action.startOver")}
    </Button>
  );

  if (phase === "single-loading" || phase === "run-loading") {
    return (
      <SectionCard
        className="h-full"
        bodyClassName="flex h-full items-center justify-center gap-3 p-8 md:p-16"
      >
        <Loader2 className="animate-spin text-faint" size={20} />
        <p className="font-medium text-muted">{t("result.loading")}</p>
      </SectionCard>
    );
  }

  if (phase === "single-error") {
    const message =
      singleQuery.error instanceof ApiError && singleQuery.error.status === 404
        ? t("result.missingRun")
        : t("err.matchFailed");
    return (
      <SectionCard className="h-full" bodyClassName="p-8 md:p-16">
        <p role="alert" className="text-center font-medium text-red-600">
          {message}
        </p>
        <div className="mt-4 flex justify-center">{startOver}</div>
      </SectionCard>
    );
  }

  if (isSingle && singleQuery.data) {
    // Same condition as the "single-success" phase above — checked again
    // here so TypeScript narrows `singleQuery.data` to non-null.
    const stored = singleQuery.data;
    return (
      <MatchResultCard
        runId={stored.runId ?? ""}
        // Taken from the row, not the store: arriving from history there is
        // no wizard selection behind this result.
        cvDocumentId={stored.cvDocumentId}
        jdDocumentId={stored.jdDocumentId}
        credentialId={stored.credentialId}
        autoRun={false}
        initialResult={stored}
        expanded
      />
    );
  }

  if (!runId || !cvDocId || !jdDocId) {
    // Same condition as the "guard" phase above — checked again here (rather
    // than reused as `phase === "guard"`) so TypeScript narrows `runId` /
    // `cvDocId` / `jdDocId` to non-null for every branch below.
    return (
      <SectionCard className="h-full" bodyClassName="p-8 md:p-16">
        <p role="alert" className="text-center font-medium text-muted">
          {t("result.missingRun")}
        </p>
        <div className="mt-4 flex justify-center">{startOver}</div>
      </SectionCard>
    );
  }

  if (phase === "run-error") {
    const message =
      runQuery.error instanceof ApiError && runQuery.error.status === 404
        ? t("result.missingRun")
        : t("err.matchFailed");
    return (
      <SectionCard className="h-full" bodyClassName="p-8 md:p-16">
        <p role="alert" className="text-center font-medium text-red-600">
          {message}
        </p>
        <div className="mt-4 flex justify-center">{startOver}</div>
      </SectionCard>
    );
  }

  const persisted = runQuery.data?.results ?? [];
  const cards = isLive
    ? pending.map((credentialId, index) => ({
        key: `${credentialId ?? "system"}-${index}`,
        credentialId,
        initialResult: undefined
      }))
    : persisted.map((result) => ({
        key: result.id,
        credentialId: result.credentialId,
        initialResult: result
      }));

  const expanded = cards.length <= 1;

  return (
    <div aria-live="polite" className="flex flex-1 flex-col gap-4">
      {cards.length === 0 && (
        <SectionCard bodyClassName="p-8 md:p-16">
          <Alert
            type="info"
            showIcon
            message={t("result.emptyRun")}
            description={t("result.emptyRunHint")}
          />
        </SectionCard>
      )}
      {cards.map((card) => (
        <MatchResultCard
          key={card.key}
          runId={runId}
          cvDocumentId={cvDocId}
          jdDocumentId={jdDocId}
          credentialId={card.credentialId}
          autoRun={isLive}
          initialResult={card.initialResult}
          expanded={expanded}
        />
      ))}
    </div>
  );
};

export default StepResult;
