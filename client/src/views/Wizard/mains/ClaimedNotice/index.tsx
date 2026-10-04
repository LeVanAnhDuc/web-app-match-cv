import { useNavigate, useSearch } from "@tanstack/react-router";
import { Alert } from "antd";
import { CircleCheck, X } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "#/hooks/useAuth";
import { useWizardStore } from "#/stores";

const ClaimedNotice = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { runId, claimed } = useSearch({ from: "/_app/wizard" });
  const { isUser } = useAuth();
  const step = useWizardStore((s) => s.step);

  const dismiss = useCallback(
    () =>
      void navigate({
        to: ".",
        search: (prev) => ({ ...prev, claimed: undefined }),
        replace: true
      }),
    [navigate]
  );

  // The notice belongs to the run it came back with. Once the user leaves
  // step 4 (Start over, the stepper) it must not resurface on the next result.
  useEffect(() => {
    if (claimed && !runId && step !== 4) dismiss();
  }, [claimed, runId, step, dismiss]);

  if (!claimed || !isUser || step !== 4) return null;

  return (
    <div className="mb-4">
      <Alert
        type="success"
        showIcon
        icon={<CircleCheck size={18} aria-hidden="true" />}
        role="status"
        message={t("wizard.claimed.title")}
        description={t("wizard.claimed.body")}
        closable={{
          closeIcon: <X size={16} aria-hidden="true" />,
          "aria-label": t("action.dismiss")
        }}
        onClose={dismiss}
      />
    </div>
  );
};

export default ClaimedNotice;
