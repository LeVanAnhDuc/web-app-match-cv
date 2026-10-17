import type { InputRef } from "antd";
import { Form, Input, Modal } from "antd";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

const MAX_TITLE_LENGTH = 200;

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
  const nameRef = useRef<InputRef>(null);

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
      afterOpenChange={(visible) => {
        // The dialog focuses its own wrapper on open; move focus to the name
        // field, the only thing a keyboard user edits here.
        if (visible) nameRef.current?.focus();
      }}
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
            // A whitespace-only name trims to "" and the server rejects it
            // with a 400 the page would misreport as an ungrounded change.
            {
              required: true,
              whitespace: true,
              message: t("save.nameRequired")
            },
            { max: MAX_TITLE_LENGTH, message: t("rewrite.save.nameTooLong") }
          ]}
        >
          <Input ref={nameRef} maxLength={MAX_TITLE_LENGTH} />
        </Form.Item>
        <p className="text-sm text-muted">{t("rewrite.save.hint")}</p>
      </Form>
    </Modal>
  );
};

export default SaveRewriteModal;
