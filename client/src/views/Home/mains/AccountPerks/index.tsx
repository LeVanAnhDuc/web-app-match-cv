import { Clock, FileText, KeyRound, PenLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionCard from "#/components/SectionCard";

const PERKS = [
  { key: "documents", Icon: FileText },
  { key: "history", Icon: Clock },
  { key: "rewrite", Icon: PenLine },
  { key: "keys", Icon: KeyRound }
] as const;

const AccountPerks = () => {
  const { t } = useTranslation();

  return (
    <SectionCard
      eyebrow={t("home.perks.eyebrow")}
      title={t("home.perks.title")}
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line">
        {PERKS.map(({ key, Icon }) => (
          <li key={key} className="flex items-center gap-3 px-4 py-3 md:px-6">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-accent"
            >
              <Icon size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-body">
                {t(`home.perks.${key}.title`)}
              </p>
              <p className="text-sm text-muted">
                {t(`home.perks.${key}.meta`)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
};

export default AccountPerks;
