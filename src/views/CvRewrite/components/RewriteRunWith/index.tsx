import { Select, Tag } from "antd";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAiCredentials, useProviders } from "#/hooks/useAiCredentials";

// antd Select values must be primitives, so the system key needs a sentinel;
// it is mapped back to `null` at the component boundary.
const SYSTEM_KEY_VALUE = "__system__";
const MASK = "••••";

const RewriteRunWith = ({
  value,
  onChange
}: {
  value: string | null;
  onChange: (credentialId: string | null) => void;
}) => {
  const { t } = useTranslation();
  const credentialsQuery = useAiCredentials();
  const providersQuery = useProviders();

  const credentials = credentialsQuery.data ?? [];
  const providerLabel = (id: string) =>
    providersQuery.data?.find((p) => p.id === id)?.label ?? id;

  const selected = credentials.find((c) => c.id === value);
  const providerName = selected
    ? providerLabel(selected.provider)
    : t("credentials.systemKey");

  const options = [
    ...credentials.map((credential) => ({
      value: credential.id,
      label: `${providerLabel(credential.provider)} · ${credential.label} · ${MASK}${credential.keyLast4}`
    })),
    { value: SYSTEM_KEY_VALUE, label: t("credentials.systemKey") }
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold tracking-wider text-faint uppercase">
        {t("credentials.runWith.title")}
      </p>
      <Select
        aria-label={t("credentials.runWith.title")}
        className="w-full md:max-w-md"
        value={value ?? SYSTEM_KEY_VALUE}
        options={options}
        onChange={(next) => onChange(next === SYSTEM_KEY_VALUE ? null : next)}
      />
      {selected && selected.lastTestStatus !== "ok" && (
        <Tag color="warning">{t("credentials.runWith.untestedWarning")}</Tag>
      )}
      <p className="flex items-start gap-2 text-sm text-muted">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        {value === null
          ? t("credentials.runWith.privacySystem")
          : t("credentials.runWith.privacy", { provider: providerName })}
      </p>
    </div>
  );
};

export default RewriteRunWith;
