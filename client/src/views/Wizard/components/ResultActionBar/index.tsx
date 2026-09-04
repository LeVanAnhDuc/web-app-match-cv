import { Button } from "antd";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWizardStore } from "#/stores";

const ResultActionBar = () => {
  const { t } = useTranslation();
  const reset = useWizardStore((s) => s.reset);

  return (
    <div className="flex items-center justify-between">
      <Button
        type="text"
        size="large"
        icon={<RotateCcw size={16} />}
        onClick={reset}
        className="!text-muted"
      >
        {t("action.startOver")}
      </Button>
      <Button type="primary" size="large">
        {t("action.saveReport")}
      </Button>
    </div>
  );
};

export default ResultActionBar;
