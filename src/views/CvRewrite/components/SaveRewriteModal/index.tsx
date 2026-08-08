import { Form, Input, Modal } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const MAX_TITLE_LENGTH = 200;

/** Names the new CV. The rewrite is always saved as a NEW document (ADR #13). */
const SaveRewriteModal = ({
  open,
  defaultTitle,
  saving,
  onClose,
  onConfirm
}: {
  open: boolean;
  defaultTitle: string;
  saving: boolean;
  onClose: () => void;
  onConfirm: (title: string) => void;
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<{ title: string }>();

  useEffect(() => {
    if (open) form.setFieldsValue({ title: defaultTitle });
  }, [open, defaultTitle, form]);

  return (
    <Modal
      open={open}
      title={t("rewrite.save.title")}
      okText={t("rewrite.save.confirm")}
      cancelText={t("action.cancel")}
      confirmLoading={saving}
      onCancel={onClose}
      onOk={() => void form.submit()}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ title: defaultTitle }}
        onFinish={({ title }) => onConfirm(title.trim())}
      >
        <Form.Item
          name="title"
          label={t("rewrite.save.nameLabel")}
          rules={[
            { required: true, message: t("save.nameRequired") },
            { max: MAX_TITLE_LENGTH, message: t("rewrite.save.nameTooLong") }
          ]}
        >
          {/* No autoFocus: antd already traps focus inside the dialog, and the
              two existing modals in the app rely on that same behaviour. */}
          <Input maxLength={MAX_TITLE_LENGTH} />
        </Form.Item>
        <p className="text-sm text-muted">{t("rewrite.save.hint")}</p>
      </Form>
    </Modal>
  );
};

export default SaveRewriteModal;
