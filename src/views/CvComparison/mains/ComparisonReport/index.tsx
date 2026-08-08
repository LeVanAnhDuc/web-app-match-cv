import { useNavigate } from "@tanstack/react-router";
import { Alert, Button, Select, Skeleton } from "antd";
import { ArrowRight, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionCard from "#/components/SectionCard";
import { useComparison } from "#/hooks/useComparison";
import { ApiError } from "#/libs/api";
import { useWizardStore } from "#/stores";
import GapDiffList from "../../components/GapDiffList";
import ScoreDelta from "../../components/ScoreDelta";

/**
 * The comparison itself: pick a JD, read the delta, read the gap diff.
 *
 * Strictly read-only. Nothing on this screen starts a match — a version with
 * no match on the selected JD gets an explicit call to action that hands the
 * user to the wizard, which already owns credential choice and the privacy
 * notice (design.md §2).
 */
const ComparisonReport = ({
  documentId,
  jdDocumentId
}: {
  documentId: string;
  jdDocumentId?: string;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useComparison(documentId, jdDocumentId);

  if (query.isLoading) {
    return (
      // aria-busy sits on a wrapper, not on SectionCard: SectionCard takes an
      // explicit prop list and does not spread the rest onto its root, so an
      // aria-* attribute passed to it is silently dropped.
      <div aria-busy="true">
        <SectionCard>
          <Skeleton active paragraph={{ rows: 6 }} />
        </SectionCard>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <SectionCard>
        <p role="alert" className="text-center font-medium text-red-600">
          {errorMessage(query.error, Boolean(jdDocumentId), t)}
        </p>
        <div className="mt-4 text-center">
          <Button onClick={() => void navigate({ to: "/cv" })}>
            {t("compare.backToLibrary")}
          </Button>
        </div>
      </SectionCard>
    );
  }

  const data = query.data;

  const runMatchFor = (cvId: string) => {
    if (!data.jdDocumentId) return;
    // Seeds the wizard and drops the user at Review — the one place that owns
    // provider choice and the "this leaves the system" notice.
    useWizardStore.setState({
      cvDocId: cvId,
      jdDocId: data.jdDocumentId,
      matchId: null,
      runId: null,
      credentialIds: [],
      pendingCredentialIds: [],
      step: 3
    });
    void navigate({ to: "/wizard" });
  };

  return (
    <>
      <SectionCard
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span>{t("compare.version", { n: data.base.version })}</span>
            <ArrowRight size={18} className="text-muted" aria-hidden />
            <span>{t("compare.version", { n: data.revision.version })}</span>
          </span>
        }
        description={`${data.base.title} → ${data.revision.title}`}
        extra={
          data.jdOptions.length > 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <span>{t("compare.jdLabel")}</span>
              <Select
                aria-label={t("compare.jdLabel")}
                className="min-w-56"
                value={data.jdDocumentId ?? undefined}
                onChange={(next: string) =>
                  void navigate({
                    to: "/compare/$documentId",
                    params: { documentId },
                    // The URL is the source of truth, so a reload or a shared
                    // link keeps showing the same job description.
                    search: { jd: next }
                  })
                }
                options={data.jdOptions.map((option) => ({
                  value: option.id,
                  label: option.title
                }))}
              />
            </div>
          ) : null
        }
      >
        {data.jdOptions.length === 0 ? (
          <Alert
            type="info"
            showIcon
            message={t("compare.empty.title")}
            description={t("compare.empty.hint")}
            action={
              <Button
                type="primary"
                icon={<Play size={14} />}
                onClick={() => void navigate({ to: "/wizard" })}
              >
                {t("compare.empty.cta")}
              </Button>
            }
          />
        ) : (
          <div aria-live="polite" className="space-y-4">
            {data.delta ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <ScoreDelta
                  label={t("result.overall")}
                  before={data.baseResult?.overallScore ?? 0}
                  after={data.revisionResult?.overallScore ?? 0}
                  delta={data.delta.overall}
                />
                <ScoreDelta
                  label={t("result.semantic")}
                  before={data.baseResult?.semanticScore ?? 0}
                  after={data.revisionResult?.semanticScore ?? 0}
                  delta={data.delta.semantic}
                />
                <ScoreDelta
                  label={t("result.keyword")}
                  before={data.baseResult?.keywordScore ?? 0}
                  after={data.revisionResult?.keywordScore ?? 0}
                  delta={data.delta.keyword}
                />
              </div>
            ) : (
              // Never a zeroed table: that would read as "no improvement".
              <Alert
                type="warning"
                showIcon
                message={t(
                  data.revisionResult
                    ? "compare.missing.base"
                    : "compare.missing.revision"
                )}
                description={t("compare.missing.hint")}
                action={
                  <Button
                    type="primary"
                    icon={<Play size={14} />}
                    onClick={() =>
                      runMatchFor(
                        data.revisionResult ? data.base.id : data.revision.id
                      )
                    }
                  >
                    {t("compare.missing.cta")}
                  </Button>
                }
              />
            )}

            {(!data.sameChatModel || !data.sameEmbedModel) && (
              <Alert
                type="warning"
                showIcon
                message={t("compare.modelWarning.title")}
                description={t("compare.modelWarning.hint", {
                  base: data.baseResult?.chatModel ?? "",
                  revision: data.revisionResult?.chatModel ?? ""
                })}
              />
            )}
          </div>
        )}
      </SectionCard>

      {data.gapDiff && (
        <SectionCard
          title={t("compare.gaps.title")}
          description={t("compare.gaps.caveat")}
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <GapDiffList kind="closed" items={data.gapDiff.closed} />
            <GapDiffList kind="persisted" items={data.gapDiff.persisted} />
            <GapDiffList kind="introduced" items={data.gapDiff.introduced} />
          </div>
        </SectionCard>
      )}
    </>
  );
};

/**
 * 404, "no previous version" and everything else are different problems and
 * get different sentences.
 *
 * The server localises its own messages, but only from Accept-Language, which
 * this client does not send — so the copy is resolved here instead. The two
 * 400s are told apart by whether a JD was pinned in the URL: a stale `?jd=`
 * that is no longer comparable is the only 400 reachable with one present.
 */
function errorMessage(
  error: unknown,
  hadPinnedJd: boolean,
  t: (key: string) => string
): string {
  if (!(error instanceof ApiError)) return t("compare.err.failed");
  if (error.status === 404) return t("compare.err.notFound");
  if (error.status === 400) {
    return hadPinnedJd
      ? t("compare.err.jdNotComparable")
      : t("compare.err.noParent");
  }
  return t("compare.err.failed");
}

export default ComparisonReport;
