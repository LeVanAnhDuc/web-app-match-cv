import { CircleCheck, CirclePlus, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { GapPair } from "#/types/Comparison";

const TONE = {
  closed: {
    icon: CircleCheck,
    color: "text-green-600 dark:text-green-500"
  },
  persisted: {
    icon: TriangleAlert,
    color: "text-amber-600 dark:text-amber-500"
  },
  introduced: {
    icon: CirclePlus,
    color: "text-red-600 dark:text-red-500"
  }
} as const;

const GapDiffList = ({
  kind,
  items
}: {
  kind: "closed" | "persisted" | "introduced";
  items: Array<string> | Array<GapPair>;
}) => {
  const { t } = useTranslation();
  const { icon: Icon, color } = TONE[kind];
  const heading = t(`compare.gaps.${kind}`);

  return (
    <section className="space-y-3" aria-labelledby={`gap-diff-${kind}`}>
      <h3
        id={`gap-diff-${kind}`}
        className="flex items-center gap-2 text-sm font-semibold text-body"
      >
        <Icon className={color} size={18} aria-hidden />
        {heading}
        <span className="text-muted">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        // An empty bucket is information, not a blank space.
        <p className="text-sm text-faint">{t("compare.gaps.none")}</p>
      ) : (
        <ul aria-label={heading} className="space-y-2">
          {items.map((item, index) => (
            <li
              key={index}
              className="rounded-lg border border-line bg-surface-subtle p-3 text-sm text-body"
            >
              {typeof item === "string" ? (
                item
              ) : (
                <>
                  <span className="block text-muted line-through">
                    {item.base}
                  </span>
                  <span className="mt-1 block">{item.revision}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default GapDiffList;
