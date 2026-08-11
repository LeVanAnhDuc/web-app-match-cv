import { Alert, Modal, Select } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentSummaryDto } from "#/types/Documents";

/**
 * "This document is a newer version of…" — the manual half of Goal 9's
 * lineage, for a CV edited by hand rather than produced by the rewrite
 * assistant.
 *
 * Shared and presentational: the calling page hook owns the mutation. Clearing
 * the selection sends null, which is how a wrong link is undone.
 */
const DocumentLineageModal = ({
  open,
  doc,
  candidates,
  confirmLoading,
  error,
  onCancel,
  onConfirm
}: {
  open: boolean;
  doc: DocumentSummaryDto | null;
  candidates: Array<DocumentSummaryDto>;
  confirmLoading: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (parentId: string | null) => void;
}) => {
  const { t } = useTranslation();
  const [parentId, setParentId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setParentId(doc?.parentId ?? null);
  }, [open, doc]);

  const unchanged = parentId === (doc?.parentId ?? null);

  return (
    <Modal
      open={open}
      title={t("library.lineage.title")}
      okText={t("library.lineage.confirm")}
      cancelText={t("action.cancel")}
      confirmLoading={confirmLoading}
      // Disabled while nothing changed and while a request is in flight, so a
      // double click cannot produce two writes.
      okButtonProps={{ disabled: unchanged || confirmLoading }}
      onCancel={onCancel}
      onOk={() => onConfirm(parentId)}
    >
      <p className="mb-3 text-sm text-muted">
        {t("library.lineage.description", { title: doc?.title ?? "" })}
      </p>
      <Select
        aria-label={t("library.lineage.label")}
        className="w-full"
        allowClear
        placeholder={t("library.lineage.placeholder")}
        value={parentId ?? undefined}
        onChange={(next: string | undefined) => setParentId(next ?? null)}
        options={candidates
          .filter((candidate) => candidate.id !== doc?.id)
          .map((candidate) => ({
            value: candidate.id,
            label: candidate.title
          }))}
      />
      {error && (
        <Alert className="mt-3" type="error" showIcon message={error} />
      )}
    </Modal>
  );
};

export default DocumentLineageModal;
