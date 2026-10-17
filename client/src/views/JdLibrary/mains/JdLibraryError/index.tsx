import { Alert, Button } from "antd";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

const JdLibraryError = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useTranslation();

  return (
    <Alert
      type="error"
      showIcon
      role="alert"
      message={t("library.loadError")}
      action={
        <Button size="small" icon={<RotateCcw size={14} />} onClick={onRetry}>
          {t("action.tryAgain")}
        </Button>
      }
    />
  );
};

export default JdLibraryError;
