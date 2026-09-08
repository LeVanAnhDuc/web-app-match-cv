import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSavedDocuments } from "#/hooks/useDocuments";
import type { DocumentKind } from "#/types/Documents";

const SavedDocRadioList = ({
  kind,
  selectedId,
  onSelect
}: {
  kind: DocumentKind;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) => {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useSavedDocuments(kind);

  if (isLoading) {
    return null;
  }

  if (!data || data.length === 0) {
    const emptyKey = kind === "JD" ? "reuse.empty.jd" : "reuse.empty.cv";
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-surface-subtle px-6 py-10">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-subtle text-faint">
          <SearchX size={22} />
        </div>
        <p className="text-sm font-medium text-body">{t(emptyKey)}</p>
        <p className="mt-1 max-w-[220px] text-center text-xs text-muted">
          {t("reuse.empty.hint")}
        </p>
      </div>
    );
  }

  const groupName = `saved-${kind}`;

  return (
    <div role="radiogroup" className="flex flex-col gap-2">
      {data.map((doc) => {
        const selected = doc.id === selectedId;
        return (
          <label
            key={doc.id}
            className={[
              "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
              selected
                ? "border-primary bg-primary/10"
                : "border-line hover:bg-surface-subtle"
            ].join(" ")}
          >
            {/* Native radio, not antd Radio: the inline-flex label of antd
                wraps and breaks this single-line row layout. */}
            <input
              type="radio"
              name={groupName}
              value={doc.id}
              checked={selected}
              onChange={() => onSelect(doc.id)}
              className="size-4 shrink-0 accent-(--color-primary)"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold text-body">
                {doc.title}
              </span>
              <span className="truncate text-xs text-muted">
                {new Date(doc.createdAt).toLocaleDateString(i18n.language)}
              </span>
            </span>
            <span className="shrink-0 rounded bg-surface-subtle px-2 py-0.5 text-[10px] font-bold tracking-tight text-muted uppercase">
              {t(`format.${doc.sourceFormat}`)}
            </span>
          </label>
        );
      })}
    </div>
  );
};

export default SavedDocRadioList;
