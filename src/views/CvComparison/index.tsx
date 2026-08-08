import { useTranslation } from "react-i18next";
import PageContainer from "#/components/PageContainer";
import ComparisonReport from "./mains/ComparisonReport";

/**
 * CV version comparison (Goal 9) — reached from the library row of a CV that
 * descends from another one, and from the result card of a match run on it.
 */
const CvComparison = ({
  documentId,
  jdDocumentId
}: {
  documentId: string;
  jdDocumentId?: string;
}) => {
  const { t } = useTranslation();

  return (
    <PageContainer className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-body">
          {t("compare.title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("compare.subtitle")}</p>
      </div>
      <ComparisonReport documentId={documentId} jdDocumentId={jdDocumentId} />
    </PageContainer>
  );
};

export default CvComparison;
