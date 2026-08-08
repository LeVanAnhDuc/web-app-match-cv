import { Tag, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { AiTestStatus } from "#/types/AiCredentials";

// Enum -> antd preset colour. The raw enum value is never shown to a user.
const COLOR: Record<AiTestStatus, string> = {
  ok: "green",
  invalid_key: "red",
  no_quota: "orange",
  model_unavailable: "orange",
  timeout: "orange",
  unreachable: "default"
};

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/**
 * Render a past timestamp as "3 minutes ago" in the active locale. Chosen over
 * a raw date so a stale verdict reads as stale at a glance; the exact instant
 * stays available in the tooltip.
 */
function relativeTime(iso: string, locale: string): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.round(
    (new Date(iso).getTime() - Date.now()) / MS_PER_MINUTE
  );
  if (Math.abs(minutes) < MINUTES_PER_HOUR)
    return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / MINUTES_PER_HOUR);
  if (Math.abs(hours) < HOURS_PER_DAY) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / HOURS_PER_DAY), "day");
}

/** Last connection-test verdict for a credential, with a relative timestamp. */
const TestStatusTag = ({
  status,
  testedAt
}: {
  status: AiTestStatus | null;
  testedAt: string | null;
}) => {
  const { t, i18n } = useTranslation();

  const tag = (
    <Tag color={status ? COLOR[status] : "default"} className="!me-0">
      {status
        ? t(`credentials.status.${status}`)
        : t("credentials.status.untested")}
    </Tag>
  );

  if (testedAt === null) return tag;

  return (
    <span className="inline-flex items-center gap-2">
      {tag}
      <Tooltip title={new Date(testedAt).toLocaleString(i18n.language)}>
        <span className="text-xs text-muted">
          {relativeTime(testedAt, i18n.language)}
        </span>
      </Tooltip>
    </span>
  );
};

export default TestStatusTag;
