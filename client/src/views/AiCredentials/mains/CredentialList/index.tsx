import { Alert, Button, message, Skeleton } from "antd";
import { KeyRound, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import PageContainer from "#/components/PageContainer";
import SectionCard from "#/components/SectionCard";
import CredentialFormModal from "#/components/CredentialFormModal";
import { ApiError } from "#/libs/api";
import {
  useAiCredentials,
  useDeleteCredential,
  useProviders,
  useTestCredential
} from "#/hooks/useAiCredentials";
import type { AiCredentialDto, AiProvider } from "#/types/AiCredentials";
import CredentialRow from "../../components/CredentialRow";

const NOT_CONFIGURED = 503;

const CredentialList = () => {
  const { t } = useTranslation();
  const [messageApi, contextHolder] = message.useMessage();

  const credentialsQuery = useAiCredentials();
  const providersQuery = useProviders();
  const testMutation = useTestCredential();
  const deleteMutation = useDeleteCredential();

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AiCredentialDto | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const credentials = credentialsQuery.data ?? [];

  const providerLabel = (id: AiProvider) =>
    providersQuery.data?.find((p) => p.id === id)?.label ?? id;

  const handleTest = (id: string) => {
    setTestingId(id);
    testMutation.mutate(id, {
      onSuccess: () => void messageApi.success(t("credentials.test.success")),
      onError: () => void messageApi.error(t("credentials.test.failed")),
      onSettled: () => setTestingId(null)
    });
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    deleteMutation.mutate(id, {
      onSuccess: () => void messageApi.success(t("credentials.delete.success")),
      onError: () => void messageApi.error(t("credentials.delete.failed")),
      onSettled: () => setDeletingId(null)
    });
  };

  // A missing CREDENTIAL_ENCRYPTION_KEY is an operator problem, not a user
  // one — say so instead of showing a generic failure.
  const loadErrorMessage =
    credentialsQuery.error instanceof ApiError &&
    credentialsQuery.error.status === NOT_CONFIGURED
      ? t("credentials.errors.notConfigured")
      : t("credentials.errors.loadFailed");

  return (
    <PageContainer className="space-y-6">
      {contextHolder}
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-body">
          {t("credentials.title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("credentials.subtitle")}</p>
      </header>
      <SectionCard
        extra={
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => setAddOpen(true)}
          >
            {t("credentials.add")}
          </Button>
        }
        bodyClassName="p-0"
      >
        {credentialsQuery.isLoading && (
          <div className="p-4 md:p-6">
            <Skeleton active paragraph={{ rows: 4 }} />
          </div>
        )}
        {credentialsQuery.isError && (
          <div className="p-4 md:p-6">
            <Alert
              type="error"
              showIcon
              role="alert"
              message={loadErrorMessage}
            />
          </div>
        )}
        {!credentialsQuery.isLoading &&
          !credentialsQuery.isError &&
          credentials.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
              <KeyRound className="text-faint" size={32} />
              <p className="text-sm font-medium text-body">
                {t("credentials.empty")}
              </p>
              <p className="max-w-md text-sm text-muted">
                {t("credentials.emptyHint")}
              </p>
              <Button type="primary" onClick={() => setAddOpen(true)}>
                {t("credentials.add")}
              </Button>
            </div>
          )}
        {credentials.length > 0 && (
          <ul>
            {credentials.map((credential) => (
              <CredentialRow
                key={credential.id}
                credential={credential}
                providerLabel={providerLabel(credential.provider)}
                testing={testingId === credential.id}
                deleting={deletingId === credential.id}
                onTest={() => handleTest(credential.id)}
                onEdit={() => setEditTarget(credential)}
                onDelete={() => handleDelete(credential.id)}
              />
            ))}
          </ul>
        )}
      </SectionCard>
      <p className="text-sm text-muted">{t("credentials.fallbackNote")}</p>
      <CredentialFormModal
        open={addOpen}
        credential={null}
        onClose={() => setAddOpen(false)}
      />
      <CredentialFormModal
        open={editTarget !== null}
        credential={editTarget}
        onClose={() => setEditTarget(null)}
      />
    </PageContainer>
  );
};

export default CredentialList;
