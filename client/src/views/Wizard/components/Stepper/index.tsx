import { Button, Tooltip } from "antd";
import { Check, CheckCircle, Eye, FileText, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ComponentType } from "react";
import type { WizardStep } from "#/types/Wizard";

interface StepDef {
  step: WizardStep;
  icon: ComponentType<{ size?: number }>;
  labelKey: string;
}

// Icon mapping per docs/design-system/match-cv/icon-map.md §1 (wizard/navigation).
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
  isDone,
  isBlocked,
  describedBy
}: {
  step: WizardStep;
  Icon: ComponentType<{ size?: number }>;
  isActive: boolean;
  isDone: boolean;
  isBlocked: boolean;
  describedBy?: string;
}) {
  return (
    <div
      data-testid={`stepper-step-${step}`}
      data-status={isActive ? "active" : isDone ? "done" : "idle"}
      aria-current={isActive ? "step" : undefined}
      aria-disabled={isBlocked ? "true" : undefined}
      aria-describedby={isBlocked ? describedBy : undefined}
      className={[
        "z-10 flex size-9 shrink-0 items-center justify-center rounded-full font-bold transition-colors lg:size-10",
        isActive
          ? "bg-primary text-white shadow-sm"
          : isDone
            ? "border border-primary/40 bg-primary/10 text-accent"
            : "border-2 border-line bg-surface text-faint"
      ].join(" ")}
    >
      <Icon size={18} />
    </div>
  );
}

const Stepper = ({
  current,
  blockedFrom,
  onJump
}: {
  current: WizardStep;
  blockedFrom: WizardStep | 5;
  onJump: (step: WizardStep) => void;
}) => {
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
        const isBlocked = !isDone && !isActive && s.step >= blockedFrom;
        const Icon = isDone ? Check : s.icon;
        const label = t(s.labelKey);
        const describedById = `step-blocked-${s.step}`;
        const cell = (
          <div className="flex min-h-10 flex-col items-center gap-2">
            <Dot
              step={s.step}
              Icon={Icon}
              isActive={isActive}
              isDone={isDone}
              isBlocked={isBlocked}
              describedBy={describedById}
            />
            <span className={labelClass(isActive)}>{label}</span>
          </div>
        );
        return (
          <div key={s.step} className="flex flex-1 items-center last:flex-none">
            {isDone ? (
              <Button
                type="text"
                className="!h-auto !p-0"
                aria-label={t("step.jumpTo", { label })}
                onClick={() => onJump(s.step)}
              >
                {cell}
              </Button>
            ) : isBlocked ? (
              <Tooltip title={t(`step.blocked.${s.step}`)}>
                <div className="cursor-not-allowed">
                  {cell}
                  <span id={describedById} className="sr-only">
                    {t(`step.blocked.${s.step}`)}
                  </span>
                </div>
              </Tooltip>
            ) : (
              cell
            )}
            {idx < STEPS.length - 1 && (
              <div
                className={`mx-2 h-[2px] flex-1 ${
                  s.step < current ? "bg-primary" : "bg-line"
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
