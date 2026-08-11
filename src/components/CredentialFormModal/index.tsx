import { Alert, Form, Input, Modal, Select, Spin } from "antd";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "#/libs/api";
import {
  useCreateCredential,
  useProviders,
  useTestCredential,
  useUpdateCredential
} from "#/hooks/useAiCredentials";
import type {
  AiCredentialDto,
  AiProvider,
  AiTestStatus,
  TestResultDto
} from "#/types/AiCredentials";

// Mirrors the server-side DTO constraints exactly (see
// server/src/modules/ai-credentials/dto/create-ai-credential.dto.ts).
const LABEL_MAX = 60;
const KEY_MIN = 20;
const KEY_MAX = 400;
const MODEL_MAX = 120;
const NO_WHITESPACE = /^\S+$/;
const CONFLICT = 409;

interface FormValues {
  provider: AiProvider;
  label: string;
  apiKey?: string;
  chatModel?: string;
  embedModel?: string;
}

function CapabilityLine({
  name,
  status,
  okLabel
}: {
  name: string;
  status: AiTestStatus;
  okLabel: string;
}) {
  const passed = status === "ok";
  return (
    <div className="flex items-center gap-2 text-sm">
      {passed ? (
        <CheckCircle2
          size={16}
          className="text-green-600 dark:text-green-500"
        />
      ) : (
        <TriangleAlert
          size={16}
          className="text-amber-600 dark:text-amber-500"
        />
      )}
      <span className="text-body">
        {name}: {okLabel}
      </span>
    </div>
  );
}

const CredentialFormModal = ({
  open,
  credential,
  onClose,
  onSaved
}: {
  open: boolean;
  /** null = create mode. */
  credential: AiCredentialDto | null;
  onClose: () => void;
  onSaved?: (saved: AiCredentialDto) => void;
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<FormValues>();
  const providersQuery = useProviders();
  const createMutation = useCreateCredential();
  const updateMutation = useUpdateCredential();
  const testMutation = useTestCredential();

  const [testResult, setTestResult] = useState<TestResultDto | null>(null);
  const [testing, setTesting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isEdit = credential !== null;
  const providers = providersQuery.data ?? [];
  // useWatch is undefined on the first render, before the form is populated.
  const watchedProvider = Form.useWatch("provider", form) as
    AiProvider | undefined;
  const selectedProvider: AiProvider =
    watchedProvider ?? credential?.provider ?? "openrouter";
  const descriptor = providers.find((p) => p.id === selectedProvider);

  useEffect(() => {
    if (!open) return;
    setTestResult(null);
    setSaveError(null);
    form.setFieldsValue({
      provider: credential?.provider ?? "openrouter",
      label: credential?.label ?? "",
      // Never pre-fill the key: the plaintext does not exist on the client.
      apiKey: undefined,
      chatModel: credential?.chatModel ?? undefined,
      embedModel: credential?.embedModel ?? undefined
    });
  }, [open, credential, form]);

  const pending = createMutation.isPending || updateMutation.isPending;

  const runTest = async (id: string) => {
    setTesting(true);
    try {
      setTestResult(await testMutation.mutateAsync(id));
    } catch {
      // A failed test is not a failed save — the credential is stored either
      // way, and the row will simply show "Not tested".
      setTestResult(null);
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    setSaveError(null);
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // antd already surfaced the field errors
    }

    try {
      let saved: AiCredentialDto;
      let shouldTest: boolean;

      if (isEdit) {
        const input = {
          label: values.label,
          apiKey: values.apiKey || undefined,
          chatModel: values.chatModel ?? "",
          embedModel: values.embedModel ?? ""
        };
        shouldTest =
          Boolean(input.apiKey) ||
          input.chatModel !== (credential.chatModel ?? "") ||
          input.embedModel !== (credential.embedModel ?? "");
        saved = await updateMutation.mutateAsync({ id: credential.id, input });
      } else {
        saved = await createMutation.mutateAsync({
          provider: values.provider,
          label: values.label,
          apiKey: values.apiKey as string,
          chatModel: values.chatModel,
          embedModel: values.embedModel
        });
        shouldTest = true;
      }

      onSaved?.(saved);
      if (shouldTest) await runTest(saved.id);
      else onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === CONFLICT) {
        form.setFields([
          { name: "label", errors: [t("credentials.errors.labelTaken")] }
        ]);
        return;
      }
      setSaveError(t("credentials.errors.saveFailed"));
    }
  };

  return (
    <Modal
      open={open}
      title={t(
        isEdit ? "credentials.form.editTitle" : "credentials.form.addTitle"
      )}
      okText={t("credentials.form.save")}
      cancelText={t("action.cancel")}
      confirmLoading={pending || testing}
      okButtonProps={{ disabled: pending || testing }}
      onCancel={onClose}
      onOk={() => void handleSubmit()}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="provider"
          label={t("credentials.form.provider")}
          extra={isEdit ? t("credentials.form.providerLocked") : undefined}
        >
          <Select
            disabled={isEdit}
            loading={providersQuery.isLoading}
            options={providers.map((p) => ({ value: p.id, label: p.label }))}
          />
        </Form.Item>
        <Form.Item
          name="label"
          label={t("credentials.form.label")}
          rules={[
            { required: true, message: t("credentials.form.required") },
            { max: LABEL_MAX, message: t("credentials.form.labelTooLong") }
          ]}
        >
          <Input placeholder={t("credentials.form.labelPlaceholder")} />
        </Form.Item>
        <Form.Item
          name="apiKey"
          label={t("credentials.form.apiKey")}
          extra={t(
            isEdit
              ? "credentials.form.apiKeyKeepHint"
              : "credentials.form.apiKeyStoredHint"
          )}
          rules={[
            { required: !isEdit, message: t("credentials.form.required") },
            { min: KEY_MIN, message: t("credentials.form.keyTooShort") },
            { max: KEY_MAX, message: t("credentials.form.keyTooLong") },
            {
              pattern: NO_WHITESPACE,
              message: t("credentials.form.noWhitespace")
            }
          ]}
        >
          <Input.Password autoComplete="off" placeholder="sk-…" />
        </Form.Item>
        <Form.Item
          name="chatModel"
          label={t("credentials.form.chatModel")}
          rules={[
            { max: MODEL_MAX, message: t("credentials.form.labelTooLong") },
            {
              pattern: NO_WHITESPACE,
              message: t("credentials.form.noWhitespace")
            }
          ]}
        >
          <Input placeholder={descriptor?.defaultChatModel} />
        </Form.Item>
        <Form.Item
          name="embedModel"
          label={t("credentials.form.embedModel")}
          extra={t("credentials.form.modelHint")}
          rules={[
            { max: MODEL_MAX, message: t("credentials.form.labelTooLong") },
            {
              pattern: NO_WHITESPACE,
              message: t("credentials.form.noWhitespace")
            }
          ]}
        >
          <Input placeholder={descriptor?.defaultEmbedModel} />
        </Form.Item>
      </Form>
      {saveError && <Alert type="error" showIcon message={saveError} />}
      {testing && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spin size="small" />
          {t("credentials.form.testing")}
        </div>
      )}
      {testResult && !testing && (
        <div className="mt-2 space-y-1 rounded-md border border-line p-3">
          <CapabilityLine
            name={t("credentials.chatLabel")}
            status={testResult.chat}
            okLabel={t(`credentials.status.${testResult.chat}`)}
          />
          <CapabilityLine
            name={t("credentials.embedLabel")}
            status={testResult.embed}
            okLabel={t(`credentials.status.${testResult.embed}`)}
          />
        </div>
      )}
    </Modal>
  );
};

export default CredentialFormModal;
