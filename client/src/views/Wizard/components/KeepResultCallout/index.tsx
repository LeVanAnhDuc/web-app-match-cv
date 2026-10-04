import { Button } from "antd";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionCard from "#/components/SectionCard";
import { signInUrl } from "#/libs/api";

const KeepResultCallout = ({ runId }: { runId: string }) => {
  const { t } = useTranslation();

  return (
    <SectionCard>
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-accent"
        >
          <Clock size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-body">
            {t("result.keep.title")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("result.keep.body")}</p>
        </div>
        <Button
          type="primary"
          size="large"
          href={signInUrl(`/wizard?runId=${encodeURIComponent(runId)}`)}
          className="!h-11 shrink-0 max-md:w-full"
        >
          {t("result.keep.cta")}
        </Button>
      </div>
    </SectionCard>
  );
};

export default KeepResultCallout;
