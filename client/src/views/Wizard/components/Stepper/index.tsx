import { Check, CheckCircle, Eye, FileText, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ComponentType } from "react";
import type { WizardStep } from "#/types/Wizard";

interface StepDef {
  step: WizardStep;
  icon: ComponentType<{ size?: number }>;
  labelKey: string;
}

// Icon mapping per .claude/uiux/icon-map.md §1 (wizard/navigation).
const STEPS: Array<StepDef> = [
  { step: 1, icon: FileText, labelKey: "step.jd" },
  { step: 2, icon: User, labelKey: "step.cv" },
  { step: 3, icon: Eye, labelKey: "step.review" },
  { step: 4, icon: CheckCircle, labelKey: "step.result" }
];

function Dot({
  step,
  Icon,
  isActive,
  isDone
}: {
  step: WizardStep;
  Icon: ComponentType<{ size?: number }>;
  isActive: boolean;
  isDone: boolean;
}) {
  return (
    <div
      data-testid={`stepper-step-${step}`}
      data-status={isActive ? "active" : isDone ? "done" : "idle"}
      aria-current={isActive ? "step" : undefined}
      className={[
        "z-10 flex size-9 shrink-0 items-center justify-center rounded-full font-bold transition-colors lg:size-10",
        isActive
          ? "bg-blue-600 text-white shadow-lg shadow-blue-200 dark:bg-indigo-600 dark:shadow-indigo-500/40"
          : isDone
            ? "border border-blue-200 bg-blue-100 text-blue-600 dark:border-indigo-600/50 dark:bg-indigo-600/20 dark:text-indigo-400"
            : "border-2 border-line bg-surface text-faint"
      ].join(" ")}
    >
      <Icon size={18} />
    </div>
  );
}

const Stepper = ({ current }: { current: WizardStep }) => {
  const { t } = useTranslation();

  const labelClass = (isActive: boolean) =>
    [
      // `sr-only` (not `hidden`) below md: the label leaves the screen but
      // stays in the accessibility tree, so screen readers and role/text-based
      // tests still find it at mobile widths.
      "sr-only md:not-sr-only md:text-xs lg:text-sm",
      isActive ? "text-body font-semibold" : "text-muted font-medium"
    ].join(" ");

  return (
    <div className="mb-6 flex items-center justify-between">
      {STEPS.map((s, idx) => {
        const isDone = s.step < current;
        const isActive = s.step === current;
        const Icon = isDone ? Check : s.icon;
        return (
          <div key={s.step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <Dot
                step={s.step}
                Icon={Icon}
                isActive={isActive}
                isDone={isDone}
              />
              <span className={labelClass(isActive)}>{t(s.labelKey)}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`mx-2 h-[2px] flex-1 ${
                  s.step < current
                    ? "bg-blue-600 dark:bg-indigo-600"
                    : "bg-line"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Stepper;
