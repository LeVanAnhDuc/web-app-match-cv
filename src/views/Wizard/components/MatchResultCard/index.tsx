import { useNavigate } from "@tanstack/react-router";
import { Alert, Button, Collapse, Skeleton } from "antd";
import {
  AlertTriangle,
  CircleCheck,
  Lightbulb,
  RotateCcw,
  Wand2
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "#/components/SectionCard";
import { useProviders } from "#/hooks/useAiCredentials";
import { useRunMatch } from "#/hooks/useMatch";
import type { MatchResultDto } from "#/types/Matching";

const GAUGE_RADIUS = 70;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

/** Sub-score bar — private presentational helper. */
function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-body">{label}</span>
        <span className="text-sm font-bold text-blue-600 dark:text-indigo-400">
          {value}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-blue-600 dark:bg-indigo-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

/** Titled report list (strengths / gaps) — private helper. */
function ReportList({
  icon,
  title,
  items,
  itemIcon
}: {
  icon: React.ReactNode;
  title: string;
  items: Array<string>;
  itemIcon: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-subtle">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-body">{title}</h3>
      </div>
      <ul className="space-y-4">
        {items.map((item, index) => (
          <li key={index} className="flex gap-3">
            {itemIcon}
            <p className="text-sm text-body">{item}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One provider's result inside a run.
 *
 * The card owns its own request. That is what makes progressive reveal fall
 * out for free: each card resolves on its own schedule, so the first provider
 * to answer renders while the others are still skeletons — no queue, no
 * polling, no shared "how many are left" state (ADR #11).
 *
 * A failed result is NOT drawn as a 0% score. Zeroes are what the server
 * stores for a row that never produced a score, and showing them as a gauge
 * would read as "this provider thinks you are a terrible match".
 */
const MatchResultCard = ({
  runId,
  cvDocumentId,
  jdDocumentId,
  credentialId,
  autoRun,
  initialResult,
  expanded
}: {
  runId: string;
  cvDocumentId: string;
  jdDocumentId: string;
  /** null = the system key. */
  credentialId: string | null;
  /** Fire the request on mount. False on the reload path. */
  autoRun: boolean;
  initialResult?: MatchResultDto;
  /** Report sections open by default — true when this is the only card. */
  expanded: boolean;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const providersQuery = useProviders();
  const runMatch = useRunMatch();
  const [result, setResult] = useState<MatchResultDto | undefined>(
    initialResult
  );
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const firedRef = useRef(false);

  const fire = async () => {
    setFailed(false);
    setRunning(true);
    try {
      setResult(
        await runMatch.mutateAsync({
          cvDocumentId,
          jdDocumentId,
          runId,
          // Absent (not null) means "the system key" in the API contract.
          credentialId: credentialId ?? undefined
        })
      );
    } catch {
      setFailed(true);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    // Guarded by a ref, not by state: React 18 mounts effects twice in dev and
    // a second fire would cost a second round of AI calls.
    if (!autoRun || firedRef.current || initialResult) return;
    firedRef.current = true;
    void fire();
  }, [autoRun, initialResult]);

  const providerLabel = (provider: string) =>
    providersQuery.data?.find((p) => p.id === provider)?.label ?? provider;

  const title = result
    ? `${providerLabel(result.provider)} · ${result.chatModel}`
    : credentialId === null
      ? t("credentials.systemKey")
      : t("result.card.pendingTitle");

  if (running || (!result && !failed)) {
    return (
      <SectionCard title={title} aria-busy="true">
        <Skeleton active paragraph={{ rows: 4 }} />
      </SectionCard>
    );
  }

  if (failed || result?.status === "failed") {
    const code = result?.errorCode ?? "unreachable";
    return (
      <SectionCard title={title}>
        <Alert
          type="error"
          showIcon
          role="alert"
          message={t(`result.error.${code}`)}
          action={
            <Button
              size="small"
              icon={<RotateCcw size={14} />}
              onClick={() => void fire()}
              loading={running}
            >
              {t("action.tryAgain")}
            </Button>
          }
        />
      </SectionCard>
    );
  }

  if (!result) return null;

  const dashOffset = GAUGE_CIRCUMFERENCE * (1 - result.overallScore / 100);

  const report = (
    <>
      <div className="grid grid-cols-1 gap-6 md:gap-10 lg:grid-cols-2">
        <ReportList
          icon={
            <CircleCheck
              className="text-green-600 dark:text-green-500"
              size={18}
            />
          }
          title={t("result.strengths")}
          items={result.report.strengths}
          itemIcon={
            <CircleCheck className="mt-0.5 shrink-0 text-green-500" size={18} />
          }
        />
        <ReportList
          icon={
            <AlertTriangle
              className="text-amber-600 dark:text-amber-500"
              size={18}
            />
          }
          title={t("result.gaps")}
          items={result.report.gaps}
          itemIcon={
            <AlertTriangle
              className="mt-0.5 shrink-0 text-amber-500"
              size={18}
            />
          }
        />
      </div>

      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 md:p-6 dark:border-indigo-500/20 dark:bg-indigo-500/5">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-blue-900 dark:text-white">
          <Lightbulb size={18} /> {t("result.suggestions")}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {result.report.suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-xl border border-blue-100 bg-surface p-4 shadow-sm dark:border-indigo-500/20"
            >
              <Lightbulb
                className="mt-0.5 shrink-0 text-blue-600 dark:text-indigo-400"
                size={16}
              />
              <p className="text-sm text-body">{suggestion}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <SectionCard
      title={title}
      bodyClassName="p-0"
      // Entry point for the CV rewrite assistant (Goal 7a). It lives on the
      // card rather than on the step, so reopening an old match from history —
      // which renders this same card — gets the action for free.
      extra={
        <Button
          icon={<Wand2 size={16} />}
          onClick={() =>
            void navigate({
              to: "/cv-rewrite/$matchResultId",
              params: { matchResultId: result.id }
            })
          }
        >
          {t("action.improveCv")}
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-6 border-b border-line bg-surface-subtle p-4 md:flex-row md:gap-12 md:p-6">
        <div className="relative size-32 shrink-0 md:size-40">
          <svg className="-rotate-90" viewBox="0 0 160 160">
            <circle
              cx="80"
              cy="80"
              r={GAUGE_RADIUS}
              fill="none"
              className="stroke-line"
              strokeWidth="8"
            />
            <circle
              cx="80"
              cy="80"
              r={GAUGE_RADIUS}
              fill="none"
              className="stroke-blue-600 transition-[stroke-dashoffset] duration-1000 ease-out dark:stroke-indigo-500"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={GAUGE_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-body">
              {result.overallScore}%
            </span>
            <span className="text-xs font-semibold tracking-wider text-faint uppercase">
              {t("result.overall")}
            </span>
          </div>
        </div>

        <div className="w-full flex-1 space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ScoreBar
              label={t("result.semantic")}
              value={result.semanticScore}
            />
            <ScoreBar label={t("result.keyword")} value={result.keywordScore} />
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {expanded ? (
          report
        ) : (
          // Collapsed when several providers are on screen: three full reports
          // open at once means scrolling past everything just to compare scores.
          <Collapse
            ghost
            items={[
              {
                key: "report",
                label: t("result.card.showReport"),
                children: report
              }
            ]}
          />
        )}
      </div>
    </SectionCard>
  );
};

export default MatchResultCard;
