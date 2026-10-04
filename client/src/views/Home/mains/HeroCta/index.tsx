import { useNavigate } from "@tanstack/react-router";
import { Button } from "antd";
import { FileSearch, Info, Sparkles } from "lucide-react";
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "#/components/SectionCard";
import { useReturnTo } from "#/hooks/useReturnTo";
import { signInUrl } from "#/libs/api";

const HeroCta = ({ guestLimit }: { guestLimit?: number }) => {
  const { t } = useTranslation();
  const returnTo = useReturnTo();
  const navigate = useNavigate();
  const goToWizard = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    void navigate({ to: "/wizard" });
  };

  if (guestLimit !== undefined) {
    return (
      <SectionCard
        footer={
          <p className="flex items-start gap-2 text-sm text-muted">
            <Info
              aria-hidden="true"
              size={16}
              className="mt-0.5 shrink-0 text-faint"
            />
            {t("home.guest.note", { limit: guestLimit })}
          </p>
        }
      >
        <p className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">
          {t("home.guest.eyebrow")}
        </p>
        <h1 className="mb-2 font-head text-2xl font-bold tracking-tight text-body">
          {t("home.guest.title")}
        </h1>
        <p className="mb-6 max-w-xl text-sm text-muted">
          {t("home.guest.subtitle")}
        </p>
        <div className="flex flex-col gap-3 md:flex-row">
          <Button
            type="primary"
            href="/wizard"
            onClick={goToWizard}
            className="!h-11 w-full md:w-auto"
          >
            {t("home.guest.cta")}
          </Button>
          <Button href={signInUrl(returnTo)} className="!h-11 w-full md:w-auto">
            {t("home.guest.signIn")}
          </Button>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard className="relative overflow-hidden">
      <div className="relative z-10 max-w-md">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-body">
          {t("home.hero.title")}
        </h1>
        <p className="mb-6 text-muted">{t("home.hero.subtitle")}</p>
        <Button
          type="primary"
          size="large"
          href="/wizard"
          onClick={goToWizard}
          icon={<Sparkles size={18} />}
        >
          {t("home.hero.cta")}
        </Button>
      </div>
      <FileSearch
        className="pointer-events-none absolute -right-4 -bottom-8 hidden text-line md:block"
        size={160}
      />
    </SectionCard>
  );
};

export default HeroCta;
