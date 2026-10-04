import { Button } from "antd";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWizardStore } from "#/stores";

const ResultActionBar = () => {
  const { t } = useTranslation();
  const reset = useWizardStore((s) => s.reset);

  return (
    <div className="flex items-center">
      <Button
        type="text"
        size="large"
        icon={<RotateCcw size={16} />}
        onClick={reset}
        className="!h-11 !text-muted max-md:w-full"
      >
        {t("action.startOver")}
      </Button>
    </div>
  );
};

export default ResultActionBar;
