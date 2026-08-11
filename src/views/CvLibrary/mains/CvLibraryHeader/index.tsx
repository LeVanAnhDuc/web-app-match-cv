import { useTranslation } from "react-i18next";

/**
 * Page header of the saved-CV library: title plus the saved-CV count. `count`
 * is null while the list is loading or failed — the subtitle then stays out
 * rather than claiming "0 documents".
 */
const CvLibraryHeader = ({ count }: { count: number | null }) => {
  const { t } = useTranslation();

  return (
    <header>
      <h1 className="text-2xl font-bold tracking-tight text-body">
        {t("library.title.cv")}
      </h1>
      {count !== null && (
        <p className="mt-1 text-sm text-muted">
          {t("library.subtitle", { count })}
        </p>
      )}
    </header>
  );
};

export default CvLibraryHeader;
