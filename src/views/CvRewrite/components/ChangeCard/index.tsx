import { Checkbox, Tag } from "antd";
import { useTranslation } from "react-i18next";
import type { CvRewriteChange } from "#/types/CvRewrite";

/**
 * One proposed edit, shown as the CV's real wording next to what would replace
 * it. Nothing is pre-ticked anywhere in this flow: the user has to approve each
 * change on its own, which is the only defence against the model quietly
 * inflating a line it was allowed to touch (ADR #13).
 */
const ChangeCard = ({
  change,
  checked,
  onToggle
}: {
  change: CvRewriteChange;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) => {
  const { t } = useTranslation();
  const isRemoval = change.replacement.trim() === "";
  const label = change.sectionHint ?? t("rewrite.change.untitled");

  return (
    <li
      role="group"
      aria-label={label}
      className="rounded-xl border border-line bg-surface p-4 md:p-5"
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={checked}
          onChange={(event) => onToggle(event.target.checked)}
          aria-label={label}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-wider text-faint uppercase">
              {label}
            </span>
            {change.addressesGap && (
              <Tag color="warning" className="!me-0">
                {change.addressesGap}
              </Tag>
            )}
            {isRemoval && (
              <Tag className="!me-0">{t("rewrite.change.removal")}</Tag>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted">
              {t("rewrite.change.original")}
            </p>
            <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm whitespace-pre-wrap text-body line-through dark:border-red-500/20 dark:bg-red-500/5">
              {change.original}
            </p>
          </div>

          {!isRemoval && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted">
                {t("rewrite.change.suggested")}
              </p>
              <p className="rounded-lg border border-green-100 bg-green-50 p-3 text-sm whitespace-pre-wrap text-body dark:border-green-500/20 dark:bg-green-500/5">
                {change.replacement}
              </p>
            </div>
          )}

          {change.rationale && (
            <p className="text-sm text-muted">{change.rationale}</p>
          )}
        </div>
      </div>
    </li>
  );
};

export default ChangeCard;
