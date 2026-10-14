import { Button, Checkbox, Tag } from "antd";
import { Plus, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import CredentialFormModal from "#/components/CredentialFormModal";
import TestStatusTag from "#/components/TestStatusTag";
import { useAiCredentials, useProviders } from "#/hooks/useAiCredentials";
import type { AiCredentialDto } from "#/types/AiCredentials";
import RunPrivacyNotice from "../RunPrivacyNotice";

// antd Checkbox values must be primitives, so the system key needs a sentinel;
// it is mapped back to `null` at the component boundary.
const SYSTEM_KEY_VALUE = "__system__";
const MASK = "••••";

const toValue = (id: string | null) => id ?? SYSTEM_KEY_VALUE;
const toId = (value: string) => (value === SYSTEM_KEY_VALUE ? null : value);

function pickDefault(
  credentials: Array<AiCredentialDto>
): Array<string | null> {
  if (credentials.length === 0) return [null];
  const sorted = [...credentials].sort((a, b) =>
    (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "")
  );
  return [sorted[0].id];
}

const RunWithSelector = ({
  value,
  onChange
}: {
  value: Array<string | null>;
  onChange: (ids: Array<string | null>) => void;
}) => {
  const { t } = useTranslation();
  const credentialsQuery = useAiCredentials();
  const providersQuery = useProviders();
  const [addOpen, setAddOpen] = useState(false);

  const credentials = credentialsQuery.data ?? [];
  const seededRef = useRef(false);

  // Two separate jobs, deliberately not merged:
  //  - seed a sensible default ONCE, when the list first arrives;
  //  - afterwards only drop ids that no longer exist (deleted in another tab)
  //    and keep the rest in row order.
  // Re-seeding on every empty selection would make it impossible to untick
  // everything, which the step has to allow so it can say "pick at least one".
  // Row order matters because step 4 draws one card per id in this order; the
  // group's own onChange only sorts by its `options` prop, which is empty when
  // the checkboxes are children, so it hands back click order.
  useEffect(() => {
    if (!credentialsQuery.isSuccess) return;

    if (!seededRef.current) {
      seededRef.current = true;
      if (value.length === 0) {
        onChange(pickDefault(credentials));
        return;
      }
    }

    const rows: Array<string | null> = [...credentials.map((c) => c.id), null];
    const ordered = rows.filter((id) => value.includes(id));
    if (
      ordered.length !== value.length ||
      ordered.some((id, index) => id !== value[index])
    ) {
      onChange(ordered);
    }
  }, [credentialsQuery.isSuccess, credentials, value, onChange]);

  const providerLabel = (id: AiCredentialDto["provider"]) =>
    providersQuery.data?.find((p) => p.id === id)?.label ?? id;

  const selected = credentials.filter((c) => value.includes(c.id));
  const warned = selected.filter((c) => c.lastTestStatus !== "ok");

  const providerNames = [
    ...selected.map((c) => providerLabel(c.provider)),
    ...(value.includes(null) ? [t("credentials.systemKey")] : [])
  ];

  return (
    <div className="space-y-3 border-b border-line px-4 py-4 md:px-6">
      <p className="text-xs font-semibold tracking-wider text-muted uppercase">
        {t("credentials.runWith.title")}
      </p>
      <div role="group" aria-label={t("credentials.runWith.title")}>
        <Checkbox.Group
          className="flex w-full flex-col gap-2"
          value={value.map(toValue)}
          onChange={(next) => onChange(next.map((v) => toId(v)))}
        >
          {credentials.map((credential) => (
            <Checkbox key={credential.id} value={credential.id}>
              <span className="inline-flex flex-wrap items-center gap-2">
                <Tag className="!me-0">
                  {providerLabel(credential.provider)}
                </Tag>
                <span className="text-sm text-body">{credential.label}</span>
                <span className="font-mono text-xs text-muted">
                  {MASK}
                  {credential.keyLast4}
                </span>
                <TestStatusTag
                  status={credential.lastTestStatus}
                  testedAt={null}
                />
              </span>
            </Checkbox>
          ))}
          <Checkbox value={SYSTEM_KEY_VALUE}>
            <span className="inline-flex items-center gap-2">
              <span className="text-sm text-body">
                {t("credentials.systemKey")}
              </span>
              <Tag className="!me-0">{t("credentials.systemKeyTag")}</Tag>
            </span>
          </Checkbox>
        </Checkbox.Group>
      </div>
      <Button
        size="small"
        icon={<Plus size={14} />}
        onClick={() => setAddOpen(true)}
      >
        {t("credentials.add")}
      </Button>
      {warned.length > 0 && (
        <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert size={14} />
          {t("credentials.runWith.untestedCount", { count: warned.length })}
        </p>
      )}
      <RunPrivacyNotice providers={providerNames} none={value.length === 0} />
      <CredentialFormModal
        open={addOpen}
        credential={null}
        onClose={() => setAddOpen(false)}
        onSaved={(saved) => onChange([...value, saved.id])}
      />
    </div>
  );
};

export default RunWithSelector;
