import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

const RunPrivacyNotice = ({
  providers = [],
  none = false,
  systemOnly = false
}: {
  providers?: Array<string>;
  none?: boolean;
  systemOnly?: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <p className="flex items-start gap-2 text-sm text-muted">
      <ShieldCheck size={14} className="mt-0.5 shrink-0" />
      {none
        ? t("credentials.runWith.privacyNone")
        : systemOnly
          ? t("credentials.runWith.privacySystem")
          : t("credentials.runWith.privacyList", {
              providers: providers.join(", ")
            })}
    </p>
  );
};

export default RunPrivacyNotice;
