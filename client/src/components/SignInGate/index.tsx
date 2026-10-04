import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "antd";
import { Clock, KeyRound } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import SectionCard from "#/components/SectionCard";
import { signInUrl } from "#/libs/api";
import { timeUntil } from "#/utils";

const SignInGate = ({
  variant,
  title,
  description,
  resetsAt,
  backTo
}: {
  variant: "route" | "quota";
  title: string;
  description: string;
  resetsAt?: string;
  backTo: "/" | "/wizard";
}) => {
  const { t } = useTranslation();
  const returnTo = useRouterState({
    select: (s) => s.location.pathname + s.location.searchStr
  });
  const Icon = variant === "quota" ? Clock : KeyRound;
  const { hours, minutes } = timeUntil(resetsAt ?? new Date().toISOString());
  const time = hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;

  return (
    <SectionCard className="mx-auto mt-8 max-w-[440px] md:mt-16 lg:mt-24">
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-accent"
        >
          <Icon size={22} />
        </div>
        <h2 className="font-head text-xl font-bold text-body">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
        {variant === "quota" && resetsAt && (
          <p className="text-sm text-muted">
            <Trans
              i18nKey="gate.resetsIn"
              values={{ time }}
              components={{
                time: <span className="font-mono text-body tabular-nums" />
              }}
            />
          </p>
        )}
        <div className="flex w-full flex-col gap-2">
          <Button
            type="primary"
            href={signInUrl(returnTo)}
            className="!h-11 w-full"
          >
            {t("auth.signInWithDucker")}
          </Button>
          <Link
            to={backTo}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-medium text-body hover:bg-surface-subtle"
          >
            {backTo === "/" ? t("gate.backHome") : t("gate.backMatching")}
          </Link>
        </div>
      </div>
    </SectionCard>
  );
};

export default SignInGate;
