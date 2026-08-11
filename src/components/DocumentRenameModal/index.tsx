import { Input, Modal } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Rename dialog (shared molecule, presentational). Holds the editable title
 * locally and hands the trimmed value back through `onConfirm`; the calling
 * page hook owns the mutation.
 */
const DocumentRenameModal = ({
  open,
  initialTitle,
  confirmLoading,
  onCancel,
  onConfirm
}: {
  open: boolean;
  initialTitle: string;
  confirmLoading: boolean;
  onCancel: () => void;
  onConfirm: (title: string) => void;
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    if (open) setTitle(initialTitle);
  }, [open, initialTitle]);

  const trimmed = title.trim();

  return (
    <Modal
      open={open}
      title={t("library.rename.title")}
      okText={t("library.rename.confirm")}
      cancelText={t("action.cancel")}
      confirmLoading={confirmLoading}
      okButtonProps={{ disabled: trimmed.length === 0 }}
      onCancel={onCancel}
      onOk={() => onConfirm(trimmed)}
    >
      <label
        htmlFor="rename-doc-title"
        className="mb-1 block text-sm text-slate-600 dark:text-slate-300"
      >
        {t("library.rename.label")}
      </label>
      <Input
        id="rename-doc-title"
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
        onPressEnter={() => trimmed.length > 0 && onConfirm(trimmed)}
      />
    </Modal>
  );
};

export default DocumentRenameModal;
