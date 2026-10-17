import { Alert, Modal, Select } from "antd";
import { useEffect, useRef, useState } from "react";
import type { RefSelectProps } from "antd";
import { useTranslation } from "react-i18next";
import type { DocumentSummaryDto } from "#/types/Documents";

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
  const selectRef = useRef<RefSelectProps>(null);

  useEffect(() => {
    if (open) setParentId(doc?.parentId ?? null);
  }, [open, doc]);

  // On every open, not via autoFocus: the Select stays mounted between opens.
  // The dialog only focuses its own frame when focus is not already inside it,
  // and it has recorded the element to return focus to by the time this runs.
  useEffect(() => {
    if (open) selectRef.current?.focus();
  }, [open]);

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
        ref={selectRef}
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
