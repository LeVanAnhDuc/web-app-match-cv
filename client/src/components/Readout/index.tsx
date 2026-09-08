import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

const TONE = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning"
} as const;

function Delta({
  direction,
  value,
  deltaLabel
}: {
  direction: "up" | "down" | "flat" | "na";
  value: number;
  deltaLabel?: string;
}) {
  const { t } = useTranslation();
  if (direction === "na") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <Minus size={14} aria-hidden />
        {t("readout.notComparable")}
      </span>
    );
  }
  const Icon =
    direction === "up"
      ? TrendingUp
      : direction === "down"
        ? TrendingDown
        : Minus;
  const tone =
    direction === "up"
      ? "text-success"
      : direction === "down"
        ? "text-error"
        : "text-muted";
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${tone}`}>
      <Icon size={14} aria-hidden />
      <span className="font-mono tabular-nums" data-testid="delta-value">
        {direction === "up" ? `+${value}` : String(value)}
      </span>
      {deltaLabel && <span className="sr-only">{deltaLabel}</span>}
    </span>
  );
}

const Readout = ({
  label,
  value,
  unit = "",
  scale = false,
  delta,
  deltaValue = 0,
  tone = "primary",
  deltaLabel
}: {
  label: string;
  value: number;
  unit?: string;
  scale?: boolean;
  delta?: { direction: "up" | "down" | "flat" | "na" };
  deltaValue?: number;
  tone?: keyof typeof TONE;
  /** Already-localized, consumer-specific phrase spelling out the delta's
   * direction for a screen reader (e.g. "better than the previous version") —
   * Readout has no wording of its own for this since it's meaningful only in
   * context. Ignored when `delta.direction` is "na" (the visible "Not
   * comparable" text already covers that case). */
  deltaLabel?: string;
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold tracking-wider text-muted uppercase">
        {label}
      </p>
      <div className="flex flex-wrap items-baseline gap-2.5">
        <span className="font-mono text-3xl leading-none font-medium text-body tabular-nums md:text-4xl">
          {value}
          {unit && <span className="text-lg text-muted">{unit}</span>}
        </span>
        {delta && (
          <Delta
            direction={delta.direction}
            value={deltaValue}
            deltaLabel={delta.direction === "na" ? undefined : deltaLabel}
          />
        )}
      </div>
      {scale && (
        <div
          role="meter"
          aria-label={label}
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          className="relative mt-1"
        >
          <div className="h-1.5 overflow-hidden rounded-full border border-line bg-surface-subtle">
            <div
              className={`h-1 rounded-full ${TONE[tone]}`}
              style={{ width: `${value}%` }}
            />
          </div>
          <span className="absolute top-[-2px] left-1/4 h-2.5 w-px bg-line-strong" />
          <span className="absolute top-[-2px] left-1/2 h-2.5 w-px bg-line-strong" />
          <span className="absolute top-[-2px] left-3/4 h-2.5 w-px bg-line-strong" />
        </div>
      )}
      {scale && (
        <div className="flex justify-between font-mono text-xs text-muted">
          <span>{t("readout.scaleMin")}</span>
          <span>{t("readout.scaleMax")}</span>
        </div>
      )}
    </div>
  );
};

export default Readout;
