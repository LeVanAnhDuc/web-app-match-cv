import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * One before → after pair with its signed change.
 *
 * Direction is never carried by colour alone: the sign is printed and the
 * arrow has an accessible label, so the number reads the same to a screen
 * reader and to someone who cannot separate the red from the green.
 *
 * Zero is drawn as "0" — not "+0", not an up arrow. A rewrite that changed
 * nothing must not look like an improvement.
 */
const ScoreDelta = ({
  label,
  before,
  after,
  delta
}: {
  label: string;
  before: number;
  after: number;
  delta: number;
}) => {
  const { t } = useTranslation();
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const tone =
    direction === "up"
      ? "text-green-600 dark:text-green-500"
      : direction === "down"
        ? "text-red-600 dark:text-red-500"
        : "text-muted";
  const Icon =
    direction === "up"
      ? TrendingUp
      : direction === "down"
        ? TrendingDown
        : Minus;

  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface-subtle p-4">
      <p className="text-xs font-semibold tracking-wider text-faint uppercase">
        {label}
      </p>
      <p className="text-sm text-muted">
        <span data-testid="score-before">{before}%</span>
        {" → "}
        <span className="text-2xl font-bold text-body">{after}%</span>
      </p>
      <p className={`flex items-center gap-1.5 text-sm font-semibold ${tone}`}>
        <Icon size={16} aria-hidden />
        {/* The number is its own node so it can be read — and asserted — on its
            own; the direction words live beside it rather than inside it. */}
        <span data-testid="delta-value">
          {direction === "up" ? `+${delta}` : String(delta)}
        </span>
        <span className="sr-only">{t(`compare.delta.${direction}`)}</span>
      </p>
    </div>
  );
};

export default ScoreDelta;
