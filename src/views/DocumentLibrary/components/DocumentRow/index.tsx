import { Button, Popconfirm, Tag } from "antd";
import {
  Download,
  Eye,
  FileText,
  GitBranch,
  GitCompareArrows,
  Pencil,
  Trash2
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { documentFileUrl } from "#/requests/documents";
import type { DocumentSummaryDto } from "#/types/Documents";

/**
 * One saved-document row (molecule, presentational). Actions are surfaced as
 * icon buttons with aria-labels; delete is guarded by a Popconfirm. All data
 * and behaviour arrive via props from the DocumentList organism.
 */
const DocumentRow = ({
  doc,
  onPreview,
  onRename,
  onDelete,
  onCompare,
  onSetLineage,
  deleting
}: {
  doc: DocumentSummaryDto;
  onPreview: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCompare: () => void;
  onSetLineage: () => void;
  deleting: boolean;
}) => {
  const { t, i18n } = useTranslation();
  const date = new Intl.DateTimeFormat(i18n.language).format(
    new Date(doc.createdAt)
  );
  const canDownload = doc.sourceFormat !== "text";

  return (
    <li className="flex items-center gap-4 px-4 py-3 md:px-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-muted">
        <FileText size={18} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-body">
            {doc.title}
          </p>
          <Tag className="shrink-0" bordered={false}>
            {t(`format.${doc.sourceFormat}`)}
          </Tag>
        </div>
        <p className="truncate text-xs text-muted">{date}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="text"
          aria-label={t("library.action.preview")}
          icon={<Eye size={16} />}
          onClick={onPreview}
        />
        <Button
          type="text"
          aria-label={t("library.action.rename")}
          icon={<Pencil size={16} />}
          onClick={onRename}
        />
        {/* Only a document that descends from another one has anything to
            compare against, so the action simply does not exist otherwise. */}
        {doc.parentId !== null && (
          <Button
            type="text"
            aria-label={t("library.action.compare")}
            icon={<GitCompareArrows size={16} />}
            onClick={onCompare}
          />
        )}
        <Button
          type="text"
          aria-label={t("library.action.setLineage")}
          icon={<GitBranch size={16} />}
          onClick={onSetLineage}
        />
        {canDownload && (
          <Button
            type="text"
            aria-label={t("library.action.download")}
            icon={<Download size={16} />}
            href={documentFileUrl(doc.id, true)}
            download
          />
        )}
        <Popconfirm
          title={t("library.delete.confirm")}
          okText={t("library.action.delete")}
          cancelText={t("action.cancel")}
          okButtonProps={{ danger: true }}
          onConfirm={onDelete}
        >
          <Button
            type="text"
            danger
            loading={deleting}
            aria-label={t("library.action.delete")}
            icon={<Trash2 size={16} />}
          />
        </Popconfirm>
      </div>
    </li>
  );
};

export default DocumentRow;
