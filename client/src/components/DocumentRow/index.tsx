import { Button, Dropdown, Popconfirm, Tag } from "antd";
import {
  Download,
  Eye,
  FileText,
  GitBranch,
  GitCompareArrows,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MenuProps } from "antd";
import type { DocumentSummaryDto } from "#/types/Documents";
import { documentFileUrl } from "#/requests/documents";

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
  onCompare?: () => void;
  onSetLineage: () => void;
  deleting: boolean;
}) => {
  const { t, i18n } = useTranslation();
  const date = new Intl.DateTimeFormat(i18n.language).format(
    new Date(doc.createdAt)
  );
  const canDownload = doc.sourceFormat !== "text";
  // The delete item's label wraps Popconfirm's trigger in a <span> that stops
  // the click from bubbling to antd's Dropdown overlay, which closes the menu
  // on any inner click — that would dismiss the Popconfirm before the user
  // can confirm the destructive action.
  const items: MenuProps["items"] = [
    {
      key: "preview",
      label: t("library.action.preview"),
      icon: <Eye size={16} aria-hidden="true" />,
      onClick: onPreview
    },
    {
      key: "rename",
      label: t("library.action.rename"),
      icon: <Pencil size={16} aria-hidden="true" />,
      onClick: onRename
    },
    ...(doc.parentId !== null && onCompare
      ? [
          {
            key: "compare",
            label: t("library.action.compare"),
            icon: <GitCompareArrows size={16} aria-hidden="true" />,
            onClick: onCompare
          }
        ]
      : []),
    {
      key: "setLineage",
      label: t("library.action.setLineage"),
      icon: <GitBranch size={16} aria-hidden="true" />,
      onClick: onSetLineage
    },
    ...(canDownload
      ? [
          {
            key: "download",
            label: (
              <a href={documentFileUrl(doc.id, true)} download>
                {t("library.action.download")}
              </a>
            ),
            icon: <Download size={16} aria-hidden="true" />
          }
        ]
      : []),
    {
      key: "delete",
      danger: true,
      disabled: deleting,
      icon: deleting ? (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      ) : (
        <Trash2 size={16} aria-hidden="true" />
      ),
      label: (
        <Popconfirm
          title={t("library.delete.confirm")}
          okText={t("library.action.delete")}
          cancelText={t("action.cancel")}
          okButtonProps={{ danger: true }}
          onConfirm={onDelete}
        >
          <span onClick={(event) => event.stopPropagation()}>
            {t("library.action.delete")}
          </span>
        </Popconfirm>
      )
    }
  ];

  return (
    <li className="flex items-center gap-4 px-4 py-3 md:px-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-muted">
        <FileText size={18} aria-hidden="true" />
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
      <div className="flex shrink-0 items-center">
        <Dropdown menu={{ items }} trigger={["click"]} placement="bottomRight">
          <Button
            type="text"
            aria-label={t("library.action.menu")}
            icon={<MoreVertical size={16} aria-hidden="true" />}
          />
        </Dropdown>
      </div>
    </li>
  );
};

export default DocumentRow;
