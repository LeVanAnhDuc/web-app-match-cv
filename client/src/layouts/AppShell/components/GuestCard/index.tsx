import { Button, Tooltip } from "antd";
import { LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "#/hooks/useAuth";
import { useReturnTo } from "#/hooks/useReturnTo";
import { signInUrl } from "#/libs/api";
import { quotaLeftPercent } from "#/utils";

const GuestCard = ({ collapsed = false }: { collapsed?: boolean }) => {
  const { t } = useTranslation();
  const { guestQuota } = useAuth();
  const returnTo = useReturnTo();
  const href = signInUrl(returnTo);

  if (collapsed) {
    return (
      <div className="mt-auto flex justify-center px-2 py-3">
        <Tooltip title={t("auth.signInWithDucker")} placement="right">
          <Button
            type="primary"
            href={href}
            aria-label={t("auth.signInWithDucker")}
            icon={<LogIn size={18} />}
            className="!h-11 !w-11"
          />
        </Tooltip>
      </div>
    );
  }

  const limit = guestQuota?.limit ?? 0;
  const left = Math.max(0, limit - (guestQuota?.used ?? 0));

  return (
    <div className="mt-auto p-4">
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-subtle p-4">
        <span className="text-xs font-semibold tracking-wider text-muted uppercase">
          {t("auth.guest.eyebrow")}
        </span>
        <p className="text-sm text-body">{t("auth.guest.pitch")}</p>
        <Button type="primary" href={href} className="!h-11 w-full">
          {t("auth.signInWithDucker")}
        </Button>
        {guestQuota && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted">
                {t("auth.quota.label")}
              </span>
              <span className="font-mono text-xs text-body tabular-nums">
                {t("auth.quota.left", { left, limit })}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${quotaLeftPercent(limit, left)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuestCard;
