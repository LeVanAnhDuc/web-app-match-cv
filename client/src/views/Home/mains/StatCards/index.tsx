import { Skeleton } from "antd";
import { Award, FileText, FileUser, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import Readout from "#/components/Readout";
import SectionCard from "#/components/SectionCard";
import { useSavedDocuments } from "#/hooks/useDocuments";
import { useMatchHistory } from "#/hooks/useMatch";
import LoadErrorAlert from "../../components/LoadErrorAlert";

function StatTile({
  testId,
  icon,
  value,
  label,
  subtext,
  loading,
  scale = false,
  tone
}: {
  testId: string;
  icon: React.ReactNode;
  /** null = no data yet, or it failed to load — shown as a dash, not a fake 0. */
  value: number | null;
  label: string;
  subtext?: string;
  loading: boolean;
  /** Only a real percentage may draw a 0-100 axis — a count has no such range. */
  scale?: boolean;
  tone?: "primary" | "success" | "warning";
}) {
  return (
    <SectionCard className="h-full">
      <div data-testid={testId}>
        {loading ? (
          <Skeleton active title={false} paragraph={{ rows: 2 }} />
        ) : (
          <>
            <div className="mb-4 w-fit rounded-lg bg-surface-subtle p-2 text-muted">
              {icon}
            </div>
            {value === null ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold tracking-wider text-muted uppercase">
                  {label}
                </p>
                <span className="font-mono text-3xl leading-none font-medium text-body tabular-nums md:text-4xl">
                  —
                </span>
              </div>
            ) : (
              <Readout
                label={label}
                value={value}
                unit={scale ? "%" : ""}
                scale={scale}
                tone={tone}
              />
            )}
            {subtext && (
              <p className="mt-1 text-xs text-muted italic">{subtext}</p>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}

const StatCards = () => {
  const { t } = useTranslation();
  const savedCvs = useSavedDocuments("CV");
  const savedJds = useSavedDocuments("JD");
  const history = useMatchHistory();

  const failedDocuments = [savedCvs, savedJds].filter((query) => query.isError);
  const countOf = (query: { data?: Array<unknown>; isError: boolean }) =>
    query.isError ? null : (query.data?.length ?? 0);

  const scores = history.data?.map((match) => match.overallScore) ?? [];
  const highest = scores.length > 0 ? Math.max(...scores) : null;
  const avg =
    scores.length > 0
      ? Math.round(
          scores.reduce((sum, score) => sum + score, 0) / scores.length
        )
      : null;

  return (
    <>
      {failedDocuments.length > 0 && (
        <LoadErrorAlert
          message={t("home.error.documents")}
          onRetry={() =>
            failedDocuments.forEach((query) => void query.refetch())
          }
        />
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          testId="home-stat-saved-cvs"
          icon={<FileUser size={20} />}
          value={countOf(savedCvs)}
          label={t("home.stat.savedCvs")}
          loading={savedCvs.isLoading}
        />
        <StatTile
          testId="home-stat-saved-jds"
          icon={<FileText size={20} />}
          value={countOf(savedJds)}
          label={t("home.stat.savedJds")}
          loading={savedJds.isLoading}
        />
        <StatTile
          testId="home-stat-total-matches"
          icon={<Zap size={20} />}
          value={countOf(history)}
          label={t("home.stat.totalMatches")}
          loading={history.isLoading}
        />
        <StatTile
          testId="home-stat-highest"
          icon={<Award size={20} />}
          value={highest}
          label={t("home.stat.highest")}
          subtext={
            avg === null ? undefined : t("home.stat.avg", { value: avg })
          }
          loading={history.isLoading}
          scale
          tone="success"
        />
      </div>
    </>
  );
};

export default StatCards;
