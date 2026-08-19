import { useTranslation } from "react-i18next";

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
