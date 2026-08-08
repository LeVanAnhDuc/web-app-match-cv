import { useNavigate } from "@tanstack/react-router";
import { Alert, Button, Checkbox, Collapse, Skeleton, message } from "antd";
import { Save, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "#/components/SectionCard";
import { useAcceptCvRewrite, useGenerateCvRewrite } from "#/hooks/useCvRewrite";
import { useDocument } from "#/hooks/useDocuments";
import { useMatchResult } from "#/hooks/useMatch";
import { ApiError } from "#/libs/api";
import type { CvRewriteProposalDto } from "#/types/CvRewrite";
import ChangeCard from "../../components/ChangeCard";
import RewriteRunWith from "../../components/RewriteRunWith";
import SaveRewriteModal from "../../components/SaveRewriteModal";

/** Local preview of the CV with the ticked changes applied. */
function previewText(
  rawText: string,
  proposal: CvRewriteProposalDto,
  checked: Set<string>
): string {
  return proposal.changes
    .filter((change) => checked.has(change.id))
    .reduce(
      // Anchors are unique in the CV (the server guarantees it), so replacing
      // the first occurrence is the same span the server will replace. The
      // function form is deliberate: a literal replacement would let `$&` or
      // `$'` in model-authored text act as a substitution pattern, and this
      // preview is the evidence the user approves each change on.
      (text, change) => text.replace(change.original, () => change.replacement),
      rawText
    );
}

/**
 * The whole rewrite flow: pick a key → generate → approve individual changes →
 * save as a NEW CV.
 *
 * Generation is never automatic. Each press spends a chat completion on the
 * user's key and sends the CV to a named third party, so it stays an explicit
 * action behind an explicit privacy notice.
 *
 * Nothing is ticked by default, and re-generating clears the previous ticks —
 * a tick refers to an anchor in the proposal it came from, and carrying it over
 * would silently approve a different edit.
 */
const RewriteReview = ({ matchResultId }: { matchResultId: string }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();

  const matchQuery = useMatchResult(matchResultId);
  const cvQuery = useDocument(matchQuery.data?.cvDocumentId ?? null);
  const generate = useGenerateCvRewrite();
  const accept = useAcceptCvRewrite();

  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [seededCredential, setSeededCredential] = useState(false);
  const [proposal, setProposal] = useState<CvRewriteProposalDto | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);

  // Default to whatever key produced the match — the user already consented to
  // that provider seeing this CV once.
  if (!seededCredential && matchQuery.data) {
    setSeededCredential(true);
    setCredentialId(matchQuery.data.credentialId);
  }

  if (matchQuery.isLoading) {
    return (
      <SectionCard>
        <Skeleton active paragraph={{ rows: 4 }} />
      </SectionCard>
    );
  }

  if (matchQuery.isError || !matchQuery.data) {
    const notFound =
      matchQuery.error instanceof ApiError && matchQuery.error.status === 404;
    return (
      <SectionCard>
        <p role="alert" className="text-center font-medium text-red-600">
          {notFound ? t("rewrite.err.matchNotFound") : t("err.matchFailed")}
        </p>
      </SectionCard>
    );
  }

  const match = matchQuery.data;
  const gaps = match.report.gaps;

  const runGenerate = async () => {
    setError(null);
    try {
      const next = await generate.mutateAsync({
        matchResultId,
        // Absent (not null) means "the system key" in the API contract.
        credentialId: credentialId ?? undefined
      });
      setProposal(next);
      setChecked(new Set());
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 404
          ? t("rewrite.err.matchNotFound")
          : t("rewrite.err.generateFailed")
      );
    }
  };

  const runAccept = async (title: string) => {
    if (!proposal) return;
    setError(null);
    try {
      await accept.mutateAsync({
        matchResultId,
        title,
        changes: proposal.changes
          .filter((change) => checked.has(change.id))
          .map(({ original, replacement }) => ({ original, replacement }))
      });
      setSaveOpen(false);
      messageApi.success(t("rewrite.save.success"));
      void navigate({ to: "/cv" });
    } catch (caught) {
      // Deliberately keeps the modal open and the ticks intact: losing an
      // approval pass to a transient 500 would be the worst part of this flow.
      setError(
        caught instanceof ApiError && caught.status === 400
          ? t("rewrite.err.notGrounded")
          : t("rewrite.err.saveFailed")
      );
    }
  };

  const toggle = (id: string, next: boolean) =>
    setChecked((current) => {
      const updated = new Set(current);
      if (next) updated.add(id);
      else updated.delete(id);
      return updated;
    });

  const allChecked =
    proposal !== null &&
    proposal.changes.length > 0 &&
    checked.size === proposal.changes.length;

  return (
    <>
      {contextHolder}

      <SectionCard
        // The document title is only known once its own query lands, so the
        // heading always has a defined value to interpolate — an undefined one
        // would leak the raw "{{title}}" placeholder into the page.
        title={t("rewrite.setup.title", {
          title: cvQuery.data?.title ?? t("rewrite.setup.thisCv")
        })}
        description={t("rewrite.setup.description")}
      >
        <div className="space-y-4">
          {gaps.length === 0 ? (
            <Alert type="info" showIcon message={t("rewrite.noGaps")} />
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wider text-faint uppercase">
                {t("rewrite.gapsTitle")}
              </p>
              <ul className="space-y-1">
                {gaps.map((gap, index) => (
                  <li key={index} className="flex gap-2 text-sm text-body">
                    <TriangleAlert
                      className="mt-0.5 shrink-0 text-amber-500"
                      size={16}
                    />
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <RewriteRunWith value={credentialId} onChange={setCredentialId} />

          <Button
            type="primary"
            size="large"
            icon={<Sparkles size={16} />}
            loading={generate.isPending}
            onClick={() => void runGenerate()}
          >
            {proposal ? t("rewrite.regenerate") : t("rewrite.generate")}
          </Button>

          {error && <Alert type="error" showIcon message={error} />}
        </div>
      </SectionCard>

      {/* polite, not assertive: the suggestions arriving should be announced,
          not interrupt whatever the user is reading. */}
      <div aria-live="polite" className="space-y-4">
        {generate.isPending && (
          <SectionCard aria-busy="true">
            <Skeleton active paragraph={{ rows: 6 }} />
          </SectionCard>
        )}

        {proposal && !generate.isPending && (
          <SectionCard
            title={t("rewrite.changes.title")}
            description={t("rewrite.changes.description")}
            extra={
              proposal.changes.length > 0 ? (
                <Checkbox
                  checked={allChecked}
                  onChange={(event) =>
                    setChecked(
                      event.target.checked
                        ? new Set(proposal.changes.map((change) => change.id))
                        : new Set()
                    )
                  }
                >
                  {t("rewrite.changes.selectAll")}
                </Checkbox>
              ) : null
            }
            footer={
              proposal.changes.length > 0 ? (
                <>
                  <span className="text-sm text-muted">
                    {t("rewrite.changes.selectedCount", {
                      count: checked.size
                    })}
                  </span>
                  <Button
                    type="primary"
                    size="large"
                    icon={<Save size={16} />}
                    disabled={checked.size === 0}
                    onClick={() => setSaveOpen(true)}
                  >
                    {t("rewrite.saveAsNew")}
                  </Button>
                </>
              ) : null
            }
          >
            {proposal.changes.length === 0 ? (
              <Alert
                type="info"
                showIcon
                message={t("rewrite.changes.empty")}
                description={t("rewrite.changes.emptyHint")}
              />
            ) : (
              <ul className="space-y-4">
                {proposal.changes.map((change) => (
                  <ChangeCard
                    key={change.id}
                    change={change}
                    checked={checked.has(change.id)}
                    onToggle={(next) => toggle(change.id, next)}
                  />
                ))}
              </ul>
            )}

            {proposal.unaddressedGaps.length > 0 && (
              <Alert
                className="mt-4"
                type="warning"
                showIcon
                message={t("rewrite.unaddressed.title")}
                description={
                  <>
                    <p className="mb-2 text-sm">
                      {t("rewrite.unaddressed.hint")}
                    </p>
                    <ul className="list-disc ps-5">
                      {proposal.unaddressedGaps.map((gap, index) => (
                        <li key={index} className="text-sm">
                          {gap}
                        </li>
                      ))}
                    </ul>
                  </>
                }
              />
            )}

            {proposal.changes.length > 0 && cvQuery.data && (
              <Collapse
                ghost
                className="mt-4"
                items={[
                  {
                    key: "preview",
                    label: t("rewrite.preview"),
                    children: (
                      <pre className="max-h-96 overflow-auto rounded-lg border border-line bg-surface-subtle p-4 text-sm whitespace-pre-wrap text-body">
                        {previewText(cvQuery.data.rawText, proposal, checked)}
                      </pre>
                    )
                  }
                ]}
              />
            )}
          </SectionCard>
        )}
      </div>

      <SaveRewriteModal
        open={saveOpen}
        defaultTitle={t("rewrite.save.defaultTitle", {
          title: cvQuery.data?.title ?? ""
        })}
        saving={accept.isPending}
        onClose={() => setSaveOpen(false)}
        onConfirm={(title) => void runAccept(title)}
      />
    </>
  );
};

export default RewriteReview;
