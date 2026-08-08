import {
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Segmented,
  Select,
  Skeleton,
  Tag,
  Tooltip
} from "antd";
import {
  Copy,
  Download,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAiCredentials, useProviders } from "#/hooks/useAiCredentials";
import {
  useCoverLetters,
  useDeleteCoverLetter,
  useGenerateCoverLetter,
  useUpdateCoverLetter
} from "#/hooks/useCoverLetters";
import type {
  CoverLetterDto,
  CoverLetterLanguage,
  CoverLetterLength,
  CoverLetterTone
} from "#/types/CoverLetters";

// antd Select values must be primitives, so the system key needs a sentinel.
const SYSTEM_KEY_VALUE = "__system__";
const MASK = "••••";
// Matches the server cap (UpdateCoverLetterDto). Anything longer is a whole CV
// pasted by accident, and the request would come back 400 anyway.
const CONTENT_MAX_LENGTH = 20_000;
const DRAFT_ROWS = 14;

/** Trigger a plain-text download without leaving the modal. */
function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Deferred: revoking synchronously after click() aborts the download in
  // some browsers before they have read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Write a cover letter from one match result.
 *
 * Every generation is persisted server-side, so the tone/length/language knobs
 * are worth turning: the earlier draft is still in the list when the next one
 * lands, and the two can be read side by side. A failed generation is a row
 * too, which is why this component renders an error state for a stored letter
 * rather than treating failure as a thrown request.
 *
 * The block under the draft lists what the model refused to claim
 * (`omittedRequirements`). That is the visible half of ADR #13: the letter is
 * grounded in the CV, and the things it could NOT support are stated instead
 * of quietly invented.
 */
const CoverLetterModal = ({
  open,
  matchResultId,
  defaultCredentialId,
  onClose
}: {
  open: boolean;
  matchResultId: string;
  /** The credential that produced the match — the sensible default. */
  defaultCredentialId: string | null;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const lettersQuery = useCoverLetters(matchResultId, open);
  const credentialsQuery = useAiCredentials();
  const providersQuery = useProviders();
  const generateMutation = useGenerateCoverLetter(matchResultId);
  const updateMutation = useUpdateCoverLetter(matchResultId);
  const deleteMutation = useDeleteCoverLetter(matchResultId);

  const [tone, setTone] = useState<CoverLetterTone>("formal");
  const [length, setLength] = useState<CoverLetterLength>("standard");
  const [language, setLanguage] = useState<CoverLetterLanguage>("en");
  const [credentialValue, setCredentialValue] = useState<string>(
    defaultCredentialId ?? SYSTEM_KEY_VALUE
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const letters = lettersQuery.data ?? [];
  const active = letters.find((letter) => letter.id === activeId) ?? null;

  // Adopt the newest draft when the list first arrives, and let go of one that
  // was deleted — otherwise the editor would keep offering to PATCH a row that
  // no longer exists.
  useEffect(() => {
    if (!open) return;
    if (activeId && letters.some((letter) => letter.id === activeId)) return;
    const next = letters.at(0);
    setActiveId(next?.id ?? null);
    setDraft(next?.content ?? "");
  }, [open, letters, activeId]);

  const openDraft = (letter: CoverLetterDto) => {
    setActiveId(letter.id);
    setDraft(letter.content);
    setActionError(null);
  };

  const providerLabel = (id: string) =>
    providersQuery.data?.find((provider) => provider.id === id)?.label ?? id;

  const credentials = credentialsQuery.data ?? [];
  const selectedCredential = credentials.find(
    (credential) => credential.id === credentialValue
  );
  const privacyTarget = selectedCredential
    ? providerLabel(selectedCredential.provider)
    : t("credentials.systemKey");

  const describe = (letter: CoverLetterDto) =>
    [
      t(`coverLetter.toneValue.${letter.tone}`),
      t(`coverLetter.lengthValue.${letter.length}`),
      t(`coverLetter.languageValue.${letter.language}`)
    ].join(" · ");

  // mutateAsync + try/catch: the onSuccess/onError callbacks passed to
  // `mutate` do not fire reliably in this codebase.
  const runGenerate = async () => {
    setActionError(null);
    try {
      const created = await generateMutation.mutateAsync({
        matchResultId,
        tone,
        length,
        language,
        // Absent (not null) means "the system key" in the API contract.
        credentialId:
          credentialValue === SYSTEM_KEY_VALUE ? undefined : credentialValue
      });
      setActiveId(created.id);
      setDraft(created.content);
    } catch {
      setActionError(t("coverLetter.err.generate"));
    }
  };

  const runSave = async () => {
    if (!active) return;
    setActionError(null);
    try {
      await updateMutation.mutateAsync({
        id: active.id,
        input: { content: draft }
      });
    } catch {
      // Deliberately does NOT reset `draft`: throwing away what the user just
      // typed because the network hiccuped is the worse failure.
      setActionError(t("coverLetter.err.save"));
    }
  };

  const runDelete = async (id: string) => {
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(id);
      if (id === activeId) {
        setActiveId(null);
        setDraft("");
      }
    } catch {
      setActionError(t("coverLetter.err.delete"));
    }
  };

  const runCopy = async () => {
    setActionError(null);
    try {
      await navigator.clipboard.writeText(draft);
    } catch {
      // Non-secure contexts have no clipboard API. Say so rather than looking
      // like the button did nothing.
      setActionError(t("coverLetter.err.copy"));
    }
  };

  const generating = generateMutation.isPending;
  const dirty = active !== null && draft !== active.content;
  const canSave =
    dirty &&
    draft.trim().length > 0 &&
    draft.length <= CONTENT_MAX_LENGTH &&
    active.status === "succeeded";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={880}
      destroyOnHidden
      title={t("coverLetter.title")}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div role="group" aria-label={t("coverLetter.tone")}>
            <p className="mb-1 text-xs font-semibold tracking-wider text-faint uppercase">
              {t("coverLetter.tone")}
            </p>
            <Segmented<CoverLetterTone>
              block
              value={tone}
              onChange={setTone}
              options={[
                { label: t("coverLetter.toneValue.formal"), value: "formal" },
                {
                  label: t("coverLetter.toneValue.friendly"),
                  value: "friendly"
                }
              ]}
            />
          </div>
          <div role="group" aria-label={t("coverLetter.length")}>
            <p className="mb-1 text-xs font-semibold tracking-wider text-faint uppercase">
              {t("coverLetter.length")}
            </p>
            <Segmented<CoverLetterLength>
              block
              value={length}
              onChange={setLength}
              options={[
                { label: t("coverLetter.lengthValue.short"), value: "short" },
                {
                  label: t("coverLetter.lengthValue.standard"),
                  value: "standard"
                }
              ]}
            />
          </div>
          <div role="group" aria-label={t("coverLetter.language")}>
            <p className="mb-1 text-xs font-semibold tracking-wider text-faint uppercase">
              {t("coverLetter.language")}
            </p>
            <Segmented<CoverLetterLanguage>
              block
              value={language}
              onChange={setLanguage}
              options={[
                { label: t("coverLetter.languageValue.en"), value: "en" },
                { label: t("coverLetter.languageValue.vi"), value: "vi" }
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <p className="mb-1 text-xs font-semibold tracking-wider text-faint uppercase">
              {t("credentials.runWith.title")}
            </p>
            <Select
              className="w-full"
              aria-label={t("credentials.runWith.title")}
              value={credentialValue}
              onChange={setCredentialValue}
              options={[
                ...credentials.map((credential) => ({
                  value: credential.id,
                  label: `${providerLabel(credential.provider)} · ${credential.label} · ${MASK}${credential.keyLast4}`
                })),
                {
                  value: SYSTEM_KEY_VALUE,
                  label: t("credentials.systemKey")
                }
              ]}
            />
          </div>
          <Button
            type="primary"
            icon={<Sparkles size={16} />}
            loading={generating}
            onClick={() => void runGenerate()}
          >
            {t("coverLetter.generate")}
          </Button>
        </div>

        <p className="flex items-start gap-2 text-sm text-muted">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          {t("credentials.runWith.privacyList", { providers: privacyTarget })}
        </p>

        {actionError && (
          <Alert type="error" showIcon role="alert" message={actionError} />
        )}

        <div aria-live="polite" aria-busy={generating}>
          {generating && <Skeleton active paragraph={{ rows: 6 }} />}

          {!generating && active?.status === "failed" && (
            <Alert
              type="error"
              showIcon
              role="alert"
              message={t(`result.error.${active.errorCode ?? "unreachable"}`)}
              action={
                <Button
                  size="small"
                  icon={<RotateCcw size={14} />}
                  onClick={() => void runGenerate()}
                >
                  {t("action.tryAgain")}
                </Button>
              }
            />
          )}

          {!generating && active?.status === "succeeded" && (
            <div className="space-y-3">
              <label
                className="block text-xs font-semibold tracking-wider text-faint uppercase"
                htmlFor="cover-letter-draft"
              >
                {t("coverLetter.draft")}
              </label>
              {/* Plain text on purpose (no markdown renderer): its destination
                  is an email box, and it removes the injection surface. */}
              <Input.TextArea
                id="cover-letter-draft"
                rows={DRAFT_ROWS}
                value={draft}
                maxLength={CONTENT_MAX_LENGTH}
                onChange={(event) => setDraft(event.target.value)}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  icon={<Copy size={16} />}
                  onClick={() => void runCopy()}
                >
                  {t("coverLetter.copy")}
                </Button>
                <Button
                  icon={<Download size={16} />}
                  onClick={() =>
                    downloadText(`cover-letter-${active.id}.txt`, draft)
                  }
                >
                  {t("coverLetter.download")}
                </Button>
                <Button
                  type="primary"
                  ghost
                  icon={<Save size={16} />}
                  disabled={!canSave}
                  loading={updateMutation.isPending}
                  onClick={() => void runSave()}
                >
                  {t("coverLetter.save")}
                </Button>
              </div>

              {active.omittedRequirements.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-400">
                    <TriangleAlert size={16} />
                    {t("coverLetter.omitted.title")}
                  </h3>
                  <p className="mb-2 text-sm text-muted">
                    {t("coverLetter.omitted.hint")}
                  </p>
                  <ul className="list-disc space-y-1 ps-5">
                    {active.omittedRequirements.map((item, index) => (
                      <li key={index} className="text-sm text-body">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-line pt-4">
          <p className="mb-2 text-xs font-semibold tracking-wider text-faint uppercase">
            {t("coverLetter.drafts")}
          </p>

          {lettersQuery.isLoading && (
            <Skeleton active paragraph={{ rows: 2 }} />
          )}

          {lettersQuery.isError && (
            <Alert
              type="error"
              showIcon
              role="alert"
              message={t("coverLetter.err.list")}
            />
          )}

          {!lettersQuery.isLoading &&
            !lettersQuery.isError &&
            letters.length === 0 && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t("coverLetter.empty")}
              />
            )}

          <ul className="space-y-2">
            {letters.map((letter) => (
              <li
                key={letter.id}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                  letter.id === activeId
                    ? "border-accent bg-surface-subtle"
                    : "border-line"
                }`}
              >
                <Button
                  type="text"
                  className="!h-auto !min-w-0 flex-1 !justify-start !px-0 !text-left !whitespace-normal"
                  aria-current={letter.id === activeId ? "true" : undefined}
                  onClick={() => openDraft(letter)}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-body">
                      {describe(letter)}
                    </span>
                    {letter.edited && (
                      <Tag className="!me-0">{t("coverLetter.editedTag")}</Tag>
                    )}
                    {letter.status === "failed" && (
                      <Tag color="error" className="!me-0">
                        {t("coverLetter.failedTag")}
                      </Tag>
                    )}
                  </span>
                </Button>
                <Tooltip title={t("coverLetter.delete")}>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<Trash2 size={14} />}
                    aria-label={`${t("coverLetter.delete")}: ${describe(letter)}`}
                    loading={deleteMutation.isPending}
                    onClick={() => void runDelete(letter.id)}
                  />
                </Tooltip>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
};

export default CoverLetterModal;
