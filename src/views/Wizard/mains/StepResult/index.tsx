import { Alert, Button } from "antd";
import { Loader2, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionCard from "#/components/SectionCard";
import { useMatchResult, useMatchRun } from "#/hooks/useMatch";
import { ApiError } from "#/libs/api";
import { useWizardStore } from "#/stores";
import MatchResultCard from "../../components/MatchResultCard";

/**
 * Wizard step 4 — one card per provider chosen in step 3.
 *
 * Two paths, deliberately distinct:
 *
 * - **Live run** — `pendingCredentialIds` is populated, so each card fires its
 *   own request and reveals itself as it lands.
 * - **After a reload** — the store is in-memory, so `pendingCredentialIds` is
 *   empty. The step then only READS the run. Re-firing would silently double
 *   the AI spend, and a run holding fewer results than the user selected is
 *   the correct picture of what actually completed (`erd.md`).
 *
 * A third, narrower path reopens a SINGLE stored result: Home's history widget
 * hands over a `matchId` and no run. Every result predating runs, and every row
 * reached from history, arrives this way.
 *
 * See docs/ui-designs/cv-jd-matching-wizard/wizard-step4-result.html.
 */
const StepResult = () => {
  const { t } = useTranslation();
  const runId = useWizardStore((s) => s.runId);
  const matchId = useWizardStore((s) => s.matchId);
  const cvDocId = useWizardStore((s) => s.cvDocId);
  const jdDocId = useWizardStore((s) => s.jdDocId);
  const pending = useWizardStore((s) => s.pendingCredentialIds);
  const reset = useWizardStore((s) => s.reset);

  const isLive = pending.length > 0;
  const isSingle = !runId && matchId !== null;
  // Only fetch on the reload path — during a live run the cards are the source
  // of truth and a fetch would race them.
  const runQuery = useMatchRun(runId, !isLive && !isSingle);
  const singleQuery = useMatchResult(isSingle ? matchId : null);

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

  if (isSingle && singleQuery.isLoading) {
    return (
      <SectionCard
        className="h-full"
        bodyClassName="flex h-full items-center justify-center gap-3 p-8 md:p-16"
      >
        <Loader2 className="animate-spin text-faint" size={20} />
        <p className="font-medium text-faint">{t("result.loading")}</p>
      </SectionCard>
    );
  }

  if (isSingle && (singleQuery.isError || !singleQuery.data)) {
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
    const stored = singleQuery.data;
    return (
      <div className="flex h-full flex-col gap-4">
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
        <div className="flex items-center justify-between rounded-xl border border-line bg-surface-subtle px-4 py-3 md:px-6">
          {startOver}
        </div>
      </div>
    );
  }

  if (!runId || !cvDocId || !jdDocId) {
    return (
      <SectionCard className="h-full" bodyClassName="p-8 md:p-16">
        <p role="alert" className="text-center font-medium text-muted">
          {t("result.missingRun")}
        </p>
        <div className="mt-4 flex justify-center">{startOver}</div>
      </SectionCard>
    );
  }

  if (!isLive && runQuery.isLoading) {
    return (
      <SectionCard
        className="h-full"
        bodyClassName="flex h-full items-center justify-center gap-3 p-8 md:p-16"
      >
        <Loader2 className="animate-spin text-faint" size={20} />
        <p className="font-medium text-faint">{t("result.loading")}</p>
      </SectionCard>
    );
  }

  if (!isLive && runQuery.isError) {
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
    <div className="flex h-full flex-col gap-4">
      {/* polite, not assertive: a provider finishing should be announced, not
          interrupt whatever the user is reading on an earlier card. */}
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

      <div className="flex items-center justify-between rounded-xl border border-line bg-surface-subtle px-4 py-3 md:px-6">
        {startOver}
        <Button type="primary" size="large">
          {t("action.saveReport")}
        </Button>
      </div>
    </div>
  );
};

export default StepResult;
