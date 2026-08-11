import { useTranslation } from "react-i18next";

/**
 * Page header of the saved-JD library: title plus the saved-JD count. `count`
 * is null while the list is loading or failed — the subtitle then stays out
 * rather than claiming "0 documents".
 */
const JdLibraryHeader = ({ count }: { count: number | null }) => {
  const { t } = useTranslation();

  return (
    <header>
      <h1 className="text-2xl font-bold tracking-tight text-body">
        {t("library.title.jd")}
      </h1>
      {count !== null && (
        <p className="mt-1 text-sm text-muted">
          {t("library.subtitle", { count })}
        </p>
      )}
    </header>
  );
};

export default JdLibraryHeader;
