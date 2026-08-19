import { Button } from "antd";
import { Link } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";

const CvLibraryEmpty = () => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line py-16 text-center">
      <SearchX className="text-faint" size={32} />
      <p className="text-sm font-medium text-body">{t("library.empty.cv")}</p>
      <p className="text-xs text-muted">{t("library.emptyHint")}</p>
      <Link to="/wizard">
        <Button type="primary">{t("library.emptyCta")}</Button>
      </Link>
    </div>
  );
};

export default CvLibraryEmpty;
