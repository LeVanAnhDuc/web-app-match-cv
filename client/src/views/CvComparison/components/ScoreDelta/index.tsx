import { useTranslation } from "react-i18next";
import Readout from "#/components/Readout";

const ScoreDelta = ({
  label,
  after,
  delta,
  comparable
}: {
  label: string;
  after: number;
  delta: number;
  /** Invariant #10: a delta only means something on the same chat AND embed
   * model — the caller derives this once and this component never guesses it
   * again from the numbers alone. */
  comparable: boolean;
}) => {
  const { t } = useTranslation();
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  return (
    <Readout
      label={label}
      value={after}
      unit="%"
      scale
      delta={{ direction: comparable ? direction : "na" }}
      deltaValue={delta}
      deltaLabel={comparable ? t(`compare.delta.${direction}`) : undefined}
    />
  );
};

export default ScoreDelta;
