import { useNavigate } from "@tanstack/react-router";
import { Alert, Button, Collapse, Skeleton } from "antd";
import {
  AlertTriangle,
  CircleCheck,
  GitCompareArrows,
  Lightbulb,
  Mail,
  RotateCcw,
  Wand2
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Readout from "#/components/Readout";
import SectionCard from "#/components/SectionCard";
import { useProviders } from "#/hooks/useAiCredentials";
import { useDocument } from "#/hooks/useDocuments";
import { useRunMatch } from "#/hooks/useMatch";
import type { MatchResultDto } from "#/types/Matching";
import CoverLetterModal from "../CoverLetterModal";

/**
 * One class string for all header actions, the way the sidebar nav items share
 * one (MASTER.md §8): below `md` they stack full-width at 44px, which is what
 * meets the NFR-A11Y-03 touch target — antd's default Button is 32px, so the
 * height has to be asked for explicitly. From `md` up they return to the
 * compact inline row.
 */
const HEADER_ACTION_CLASS = "!h-11 w-full justify-center md:!h-8 md:w-auto";

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
  // Only to learn whether this CV descends from an earlier version. React Query
  // dedupes by key, so N provider cards on the same run share one request.
  const cvQuery = useDocument(cvDocumentId);
  const runMatch = useRunMatch();
  const [result, setResult] = useState<MatchResultDto | undefined>(
    initialResult
  );
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
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

  const report = (
    <>
      <div className="grid grid-cols-1 gap-6 md:gap-10 lg:grid-cols-2">
        <ReportList
          icon={<CircleCheck className="text-success" size={18} />}
          title={t("result.strengths")}
          items={result.report.strengths}
          itemIcon={
            <CircleCheck className="mt-0.5 shrink-0 text-success" size={18} />
          }
        />
        <ReportList
          icon={<AlertTriangle className="text-warning" size={18} />}
          title={t("result.gaps")}
          items={result.report.gaps}
          itemIcon={
            <AlertTriangle className="mt-0.5 shrink-0 text-warning" size={18} />
          }
        />
      </div>
      <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4 md:p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-body">
          <Lightbulb size={18} /> {t("result.suggestions")}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {result.report.suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-xl border border-primary/20 bg-surface p-4 shadow-sm"
            >
              <Lightbulb className="mt-0.5 shrink-0 text-accent" size={16} />
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
      // Everything you can do with one report lives on the card rather than on
      // the step, so reopening an old match from history — which renders this
      // same card — gets all of it for free.
      //
      // Two groups, in this order deliberately: the Goal 7 pair PRODUCES
      // something new from the report and is always present; comparing (Goal 9)
      // LOOKS BACK at whether the CV improved and only exists for a CV that has
      // a previous version. The conditional one goes last so its absence cannot
      // reflow the two that are always there.
      // `Space` is not used here: it wraps each child in a fixed-width item, so
      // `w-full` on the button would never reach the row.
      extra={
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:flex-wrap md:gap-2">
          <Button
            className={HEADER_ACTION_CLASS}
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
          <Button
            className={HEADER_ACTION_CLASS}
            icon={<Mail size={16} />}
            onClick={() => setLetterOpen(true)}
          >
            {t("coverLetter.open")}
          </Button>
          {cvQuery.data?.parentId && (
            <Button
              className={HEADER_ACTION_CLASS}
              icon={<GitCompareArrows size={16} />}
              onClick={() =>
                void navigate({
                  to: "/compare/$documentId",
                  params: { documentId: result.cvDocumentId },
                  // Compare on the JD the user is looking at right now.
                  search: { jd: result.jdDocumentId }
                })
              }
            >
              {t("action.compareVersions")}
            </Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 border-b border-line bg-surface-subtle p-4 md:grid-cols-3 md:gap-6 md:p-6">
        <Readout
          label={t("result.overall")}
          value={result.overallScore}
          unit="%"
          scale
        />
        <Readout
          label={t("result.semantic")}
          value={result.semanticScore}
          unit="%"
          scale
          tone="success"
        />
        <Readout
          label={t("result.keyword")}
          value={result.keywordScore}
          unit="%"
          scale
          tone="warning"
        />
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
      {letterOpen && (
        <CoverLetterModal
          open
          matchResultId={result.id}
          defaultCredentialId={result.credentialId}
          onClose={() => setLetterOpen(false)}
        />
      )}
    </SectionCard>
  );
};

export default MatchResultCard;
