import { useTranslation } from "react-i18next";
import PageContainer from "#/components/PageContainer";
import RewriteReview from "./mains/RewriteReview";

/**
 * CV rewrite assistant (Goal 7a) — reached from the result card in wizard step
 * 4 and from a match reopened out of history, both of which render that same
 * card.
 */
const CvRewrite = ({ matchResultId }: { matchResultId: string }) => {
  const { t } = useTranslation();

  return (
    <PageContainer className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-body">
          {t("rewrite.title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("rewrite.subtitle")}</p>
      </div>
      <RewriteReview matchResultId={matchResultId} />
    </PageContainer>
  );
};

export default CvRewrite;
