import { Button, Popconfirm, Tag } from "antd";
import { Pencil, PlugZap, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import TestStatusTag from "#/components/TestStatusTag";
import type { AiCredentialDto, ProviderInfoDto } from "#/types/AiCredentials";

const MASK = "••••";

const CredentialRow = ({
  credential,
  providerLabel,
  testing,
  deleting,
  onTest,
  onEdit,
  onDelete
}: {
  credential: AiCredentialDto;
  providerLabel: ProviderInfoDto["label"];
  testing: boolean;
  deleting: boolean;
  onTest: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const { t } = useTranslation();

  const modelLine = [
    credential.chatModel ?? t("credentials.defaultModel"),
    credential.embedModel ?? t("credentials.defaultModel")
  ].join(" · ");

  return (
    <li className="flex flex-col gap-3 border-b border-line px-4 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between md:px-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Tag className="!me-0">{providerLabel}</Tag>
          <span className="truncate text-sm font-semibold text-body">
            {credential.label}
          </span>
          <span className="font-mono text-sm text-muted">
            {MASK}
            {credential.keyLast4}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">{modelLine}</p>
        <div className="mt-2">
          <TestStatusTag
            status={credential.lastTestStatus}
            testedAt={credential.lastTestedAt}
          />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="small"
          icon={<PlugZap size={14} />}
          loading={testing}
          onClick={onTest}
        >
          {t("credentials.actions.test")}
        </Button>
        <Button size="small" icon={<Pencil size={14} />} onClick={onEdit}>
          {t("credentials.actions.edit")}
        </Button>
        <Popconfirm
          title={t("credentials.delete.confirm")}
          description={t("credentials.delete.hint")}
          okText={t("credentials.actions.delete")}
          cancelText={t("action.cancel")}
          okButtonProps={{ danger: true }}
          onConfirm={onDelete}
        >
          <Button
            size="small"
            danger
            icon={<Trash2 size={14} />}
            loading={deleting}
          >
            {t("credentials.actions.delete")}
          </Button>
        </Popconfirm>
      </div>
    </li>
  );
};

export default CredentialRow;
