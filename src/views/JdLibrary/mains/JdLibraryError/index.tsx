import { useTranslation } from "react-i18next";

/** Load-failure state of the saved-JD library, announced to screen readers. */
const JdLibraryError = () => {
  const { t } = useTranslation();

  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {t("library.loadError")}
    </p>
  );
};

export default JdLibraryError;
