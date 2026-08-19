import { Link } from "@tanstack/react-router";
import { Button } from "antd";
import { FileSearch, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionCard from "#/components/SectionCard";

const HeroCta = () => {
  const { t } = useTranslation();

  return (
    <SectionCard className="relative overflow-hidden">
      <div className="relative z-10 max-w-md">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-body">
          {t("home.hero.title")}
        </h1>
        <p className="mb-6 text-muted">{t("home.hero.subtitle")}</p>
        <Link to="/wizard">
          <Button type="primary" size="large" icon={<Sparkles size={18} />}>
            {t("home.hero.cta")}
          </Button>
        </Link>
      </div>
      <FileSearch
        className="pointer-events-none absolute -right-4 -bottom-8 hidden text-line md:block"
        size={160}
      />
    </SectionCard>
  );
};

export default HeroCta;
